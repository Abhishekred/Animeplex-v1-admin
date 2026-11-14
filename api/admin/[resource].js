import { audit, fail, requireAdmin, send } from "../_lib/admin.js";
import { validateSetting } from "../_lib/config.js";
import { auditWindow, buildAuditTrend } from "../_lib/analytics.js";
import { updateOwnCredentials, verificationClient } from "../_lib/account.js";

const roles = ["owner", "admin", "release_manager", "moderator", "auditor"];
const writeRoles = ["owner", "admin"];
const releaseRoles = ["owner", "admin", "release_manager"];
const isMissingTable = error => error?.code === "42P01" || error?.code === "PGRST205";

export default async function handler(req, res) {
  const resource = String(req.query.resource || "").toLowerCase();
  const roleAllow = resource === "account" ? roles : resource === "releases" ? releaseRoles : resource === "announcements" ? ["owner","admin","moderator"] : writeRoles;
  const ctx = await requireAdmin(req, res, req.method === "GET" ? [] : roleAllow);
  if (!ctx) return;
  const { supabase, user, role } = ctx;
  try {
    if (resource === "account" && req.method === "POST") {
      const result = await updateOwnCredentials(ctx, req.body || {}, { makeVerifier: verificationClient, recordAudit: audit });
      return send(res, result.status, result.error ? { error: result.error } : { ok: true, emailChanged: result.emailChanged, passwordChanged: result.passwordChanged });
    }
    if (resource === "dashboard" && req.method === "GET") {
      const now = Date.now();
      const [profiles, releases, announcements, backups, admins, recent, auditHistory, quickSettings] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("app_releases").select("id,version,channel,status,created_at,rollout_percent").order("created_at", { ascending: false }).limit(5),
        supabase.from("app_announcements").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("backups").select("user_key,updated_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(5),
        supabase.from("admin_members").select("user_id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("admin_audit_logs").select("id,actor_email,action,target_type,target_id,created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("admin_audit_logs").select("created_at").gte("created_at", auditWindow(now).start).order("created_at", { ascending: false }).limit(1000),
        supabase.from("app_settings").select("key,value").in("key", ["maintenance_mode", "community_popup_enabled", "default_source"]),
      ]);
      const errors = [releases,announcements,admins,recent,auditHistory,quickSettings].filter(x => x.error);
      if (profiles.error && !isMissingTable(profiles.error)) errors.push(profiles);
      if (backups.error && !isMissingTable(backups.error)) errors.push(backups);
      if (errors.length) throw errors[0].error;
      return send(res, 200, {
        role,
        stats: { users: profiles.error ? null : (profiles.count || 0), activeAnnouncements: announcements.count || 0, backupAccounts: backups.error ? null : (backups.count || 0), admins: admins.count || 0 },
        releases: releases.data || [], backups: backups.data || [], activity: recent.data || [],
        auditTrend: buildAuditTrend(auditHistory.data || [], now),
        settings: Object.fromEntries((quickSettings.data || []).map(row => [row.key, row.value])),
      });
    }

    if (resource === "users") {
      if (req.method === "GET") {
        const page = Math.max(1, Number(req.query.page) || 1);
        const perPage = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const ids = (data.users || []).map(x => x.id);
        const { data: profiles, error: profileError } = ids.length
          ? await supabase.from("profiles").select("id,display_name,avatar_path,created_at").in("id", ids)
          : { data: [], error: null };
        if (profileError && !isMissingTable(profileError)) throw profileError;
        const byId = new Map((profiles || []).map(x => [x.id, x]));
        return send(res, 200, { users: (data.users || []).map(x => ({
          id: x.id, email: x.email, created_at: x.created_at, last_sign_in_at: x.last_sign_in_at,
          banned_until: x.banned_until, profile: byId.get(x.id) || null,
        })), nextPage: data.nextPage, lastPage: data.lastPage, total: data.total });
      }
      if (req.method === "POST") {
        const { action, userId, duration } = req.body || {};
        if (!userId || userId === user.id) return send(res, 400, { error: "A different target user is required." });
        if (action === "ban" || action === "unban") {
          const ban_duration = action === "unban" ? "none" : (duration || "720h");
          const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration });
          if (error) throw error;
          await audit(ctx, "user." + action, "user", userId, { duration: ban_duration });
          return send(res, 200, { ok: true });
        }
        if (action === "delete" && role === "owner") {
          await audit(ctx, "user.delete.requested", "user", userId);
          const { error: purgeError } = await supabase.rpc("admin_purge_user_data", { p_user_key: userId, p_user_id: userId });
          if (purgeError) throw purgeError;
          const { error } = await supabase.auth.admin.deleteUser(userId);
          if (error) throw error;
          await audit(ctx, "user.delete", "user", userId);
          return send(res, 200, { ok: true });
        }
        return send(res, 403, { error: "Unsupported action or insufficient permissions." });
      }
    }

    if (resource === "config") {
      if (req.method === "GET") {
        const { data, error } = await supabase.from("app_settings").select("key,value,updated_at").order("key");
        if (error) throw error;
        return send(res, 200, { settings: data || [] });
      }
      if (req.method === "PUT") {
        const { key, value } = req.body || {};
        let validValue;
        try { validValue = validateSetting(key, value); }
        catch (error) { return send(res, 400, { error: error.message }); }
        const { error } = await supabase.from("app_settings").upsert({ key, value: validValue, updated_by: user.id, updated_at: new Date().toISOString() });
        if (error) throw error;
        await audit(ctx, "config.update", "setting", key);
        return send(res, 200, { ok: true });
      }
    }

    if (resource === "content") {
      if (req.method === "GET") {
        const { data, error } = await supabase.from("app_featured_content").select("*").order("position").order("created_at", { ascending: false }).limit(200);
        if (error) throw error;
        return send(res, 200, { content: data || [] });
      }
      if (req.method === "POST") {
        const body = req.body || {};
        if (!body.title || String(body.title).trim().length > 160) return send(res, 400, { error: "Content title is required and must be under 160 characters." });
        for (const key of ["image_url","target_url"]) if (body[key]) {
          try { const parsed = new URL(body[key]); if (!["http:","https:"].includes(parsed.protocol)) throw new Error(); }
          catch { return send(res, 400, { error: key + " must be a valid HTTP or HTTPS URL." }); }
        }
        const row = { title:String(body.title).trim(), description:String(body.description||"").slice(0,3000), category:String(body.category||"featured").slice(0,60), image_url:body.image_url||null, target_url:body.target_url||null, position:Math.max(0,parseInt(body.position,10)||0), is_active:body.is_active!==false, created_by:user.id };
        const { data, error } = await supabase.from("app_featured_content").insert(row).select("*").single();
        if (error) throw error;
        await audit(ctx,"content.create","featured_content",data.id,{title:row.title});
        return send(res,201,{content:data});
      }
      if (req.method === "PATCH") {
        const { id, ...changes } = req.body || {};
        if (!id) return send(res,400,{error:"Content id is required."});
        for (const key of ["image_url","target_url"]) if (changes[key]) {
          try { const parsed = new URL(changes[key]); if (!["http:","https:"].includes(parsed.protocol)) throw new Error(); }
          catch { return send(res,400,{error:key+" must be a valid HTTP or HTTPS URL."}); }
        }
        const patch={};
        for (const key of ["title","description","category","image_url","target_url","position","is_active"]) if(key in changes) patch[key]=changes[key];
        if ("position" in patch) patch.position=Math.max(0,parseInt(patch.position,10)||0);
        patch.updated_at=new Date().toISOString();
        const { data,error }=await supabase.from("app_featured_content").update(patch).eq("id",id).select("*").single();
        if(error)throw error;
        await audit(ctx,"content.update","featured_content",id,{fields:Object.keys(patch)});
        return send(res,200,{content:data});
      }
      if (req.method === "DELETE") {
        const { id }=req.body||{};
        if(!id)return send(res,400,{error:"Content id is required."});
        const {error}=await supabase.from("app_featured_content").delete().eq("id",id);
        if(error)throw error;
        await audit(ctx,"content.delete","featured_content",id);
        return send(res,200,{ok:true});
      }
    }

    if (resource === "announcements") {
      if (req.method === "GET") {
        const { data, error } = await supabase.from("app_announcements").select("*").order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        return send(res, 200, { announcements: data || [] });
      }
      if (req.method === "POST") {
        const body = req.body || {};
        if (!body.title || String(body.title).trim().length > 120) return send(res, 400, { error: "Title is required and must be under 120 characters." });
        if (body.action_url) { try { const parsed = new URL(body.action_url); if (!["http:","https:"].includes(parsed.protocol)) throw new Error(); } catch { return send(res, 400, { error: "Action URL must be a valid HTTP or HTTPS URL." }); } }
        const row = { title: String(body.title).trim(), body: String(body.body || "").slice(0, 5000), type: ["info","warning","update"].includes(body.type) ? body.type : "info", is_active: body.is_active !== false, action_url: body.action_url || null, created_by: user.id };
        const { data, error } = await supabase.from("app_announcements").insert(row).select("*").single();
        if (error) throw error;
        await audit(ctx, "announcement.create", "announcement", data.id, { title: row.title });
        return send(res, 201, { announcement: data });
      }
      if (req.method === "PATCH") {
        const { id, ...changes } = req.body || {};
        if (!id) return send(res, 400, { error: "Announcement id is required." });
        const patch = {};
        if (changes.action_url) { try { const parsed = new URL(changes.action_url); if (!["http:","https:"].includes(parsed.protocol)) throw new Error(); } catch { return send(res, 400, { error: "Action URL must be a valid HTTP or HTTPS URL." }); } }
        for (const key of ["title","body","type","is_active","action_url"]) if (key in changes) patch[key] = changes[key];
        patch.updated_at = new Date().toISOString();
        const { data, error } = await supabase.from("app_announcements").update(patch).eq("id", id).select("*").single();
        if (error) throw error;
        await audit(ctx, "announcement.update", "announcement", id, { fields: Object.keys(patch) });
        return send(res, 200, { announcement: data });
      }
      if (req.method === "DELETE") {
        const { id } = req.body || {};
        if (!id) return send(res, 400, { error: "Announcement id is required." });
        const { error } = await supabase.from("app_announcements").delete().eq("id", id);
        if (error) throw error;
        await audit(ctx, "announcement.delete", "announcement", id);
        return send(res, 200, { ok: true });
      }
    }

    if (resource === "releases") {
      if (req.method === "GET") {
        const { data, error } = await supabase.from("app_releases").select("*").order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        return send(res, 200, { releases: data || [] });
      }
      if (req.method === "POST") {
        const body = req.body || {};
        if (body.action === "create-upload") {
          const name = String(body.fileName || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
          if (!name.toLowerCase().endsWith(".apk")) return send(res, 400, { error: "Direct OTA accepts APK files only. AAB files must be distributed through Google Play." });
          const path = "releases/" + crypto.randomUUID() + "/" + name;
          const { data, error } = await supabase.storage.from("animeplex-releases").createSignedUploadUrl(path);
          if (error) throw error;
          return send(res, 200, { path, token: data.token, signedUrl: data.signedUrl });
        }
        if (body.action === "create") {
          if (!body.version || !Number.isInteger(Number(body.version_code)) || Number(body.version_code) <= 0 || !body.storage_path || !/^[a-f0-9]{64}$/i.test(String(body.sha256||""))) return send(res, 400, { error: "Version, positive integer version code, uploaded APK and SHA-256 checksum are required." });
          const row = {
            version: String(body.version).slice(0, 40), version_code: Number(body.version_code),
            platform: body.platform === "android_tv" ? "android_tv" : "android",
            channel: ["stable","beta","testing"].includes(body.channel) ? body.channel : "stable",
            mandatory: body.mandatory === true, rollout_percent: Math.min(100,Math.max(1,Number(body.rollout_percent)||5)),
            release_notes: String(body.release_notes||"").slice(0,5000), storage_path: body.storage_path,
            sha256: body.sha256 || null, file_size: Number(body.file_size)||null, status: "draft", created_by: user.id,
          };
          const { data, error } = await supabase.from("app_releases").insert(row).select("*").single();
          if (error) throw error;
          await audit(ctx, "release.create", "release", data.id, { version: row.version, channel: row.channel });
          return send(res, 201, { release: data });
        }
        if (["publish","pause","rollback"].includes(body.action)) {
          const { id } = body;
          if (!id) return send(res, 400, { error: "Release id is required." });
          const status = body.action === "publish" ? "published" : body.action === "pause" ? "paused" : "rolled_back";
          if (body.action === "publish") {
            const { data: release, error: readError } = await supabase.from("app_releases").select("id,version_code,storage_path,channel,platform").eq("id",id).single();
            if (readError) throw readError;
            const { data: latest, error: latestError } = await supabase.from("app_releases").select("version_code").eq("channel", release.channel).eq("platform", release.platform).eq("status","published").order("version_code",{ascending:false}).limit(1).maybeSingle();
            if (latestError) throw latestError;
            if (latest && Number(release.version_code) <= Number(latest.version_code)) return send(res, 409, { error: "Version code must be greater than the currently published version in this channel." });
            const { data: urlData } = supabase.storage.from("animeplex-releases").getPublicUrl(release.storage_path);
            const { error } = await supabase.from("app_releases").update({ status, download_url: urlData.publicUrl, published_at: new Date().toISOString() }).eq("id",id);
            if (error) throw error;
          } else {
            const { data: target, error: targetError } = await supabase.from("app_releases").select("id,status,channel,platform,version_code").eq("id",id).single();
            if (targetError) throw targetError;
            if (target.status !== "published") return send(res,409,{error:"Only a currently published release can be paused or rolled back."});
            if (body.action === "rollback") {
              const { data: latest, error: latestError } = await supabase.from("app_releases").select("id").eq("channel",target.channel).eq("platform",target.platform).eq("status","published").order("version_code",{ascending:false}).limit(1).maybeSingle();
              if (latestError) throw latestError;
              if (!latest || latest.id !== id) return send(res,409,{error:"Only the newest published release in its platform/channel can be rolled back."});
            }
            const { error } = await supabase.from("app_releases").update({ status }).eq("id",id);
            if (error) throw error;
          }
          await audit(ctx, "release."+body.action, "release", id);
          return send(res, 200, { ok: true });
        }
      }
      if (req.method === "PATCH") {
        const { id, rollout_percent } = req.body || {};
        if (!id) return send(res, 400, { error: "Release id is required." });
        const { error } = await supabase.from("app_releases").update({ rollout_percent: Math.min(100,Math.max(1,Number(rollout_percent)||1)) }).eq("id",id);
        if (error) throw error;
        await audit(ctx, "release.rollout", "release", id, { rollout_percent });
        return send(res, 200, { ok: true });
      }
    }

    if (resource === "devices") {
      if (req.method === "GET") {
        const { data, error } = await supabase.from("tv_pairings")
          .select("id,code,status,device_name,app_user_id,expires_at,created_at")
          .order("created_at", { ascending: false }).limit(100);
        if (error && isMissingTable(error)) return send(res, 200, { pairings: [], available: false });
        if (error) throw error;
        return send(res, 200, { pairings: data || [] });
      }
      if (req.method === "POST") {
        const { id, action } = req.body || {};
        if (!id || action !== "expire") return send(res, 400, { error: "Pairing id and expire action are required." });
        const { data, error } = await supabase.from("tv_pairings")
          .update({ expires_at: Date.now() }).eq("id", id).eq("status", "pending")
          .select("id").maybeSingle();
        if (error) throw error;
        if (!data) return send(res, 409, { error: "Only pending pairing requests can be expired." });
        await audit(ctx, "device.pairing.expire", "tv_pairing", id);
        return send(res, 200, { ok: true });
      }
    }

    if (resource === "backups" && req.method === "GET") {
      const { data, error } = await supabase.from("backups").select("user_key,updated_at").order("updated_at", { ascending: false }).limit(100);
      if (error && isMissingTable(error)) return send(res, 200, { backups: [], available: false });
      if (error) throw error;
      return send(res, 200, { backups: data || [], note: "Backup payloads are never returned to the admin browser." });
    }

    if (resource === "audit" && req.method === "GET") {
      const { data, error } = await supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return send(res, 200, { events: data || [] });
    }

    if (resource === "admins") {
      if (req.method === "GET") {
        const { data, error } = await supabase.from("admin_members").select("user_id,role,is_active,created_at").order("created_at", { ascending: false });
        if (error) throw error;
        return send(res, 200, { admins: data || [] });
      }
      if (req.method === "POST" && role === "owner") {
        const { email, role: newRole } = req.body || {};
        if (!email || !roles.includes(newRole)) return send(res, 400, { error: "Valid email and role are required." });
        const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listError) throw listError;
        const target = listed.users.find(x => x.email?.toLowerCase() === String(email).toLowerCase());
        if (!target) return send(res, 404, { error: "Create this user account first, then grant admin access." });
        const { error } = await supabase.from("admin_members").upsert({ user_id: target.id, role: newRole, is_active: true, created_by: user.id });
        if (error) throw error;
        await audit(ctx, "admin.grant", "admin", target.id, { role: newRole });
        return send(res, 200, { ok: true });
      }
      if (req.method === "PATCH" && role === "owner") {
        const { user_id, is_active, role: newRole } = req.body || {};
        if (!user_id || user_id === user.id) return send(res, 400, { error: "Cannot change your own owner membership." });
        const patch = {};
        if (typeof is_active === "boolean") patch.is_active = is_active;
        if (roles.includes(newRole)) patch.role = newRole;
        const { error } = await supabase.from("admin_members").update(patch).eq("user_id",user_id);
        if (error) throw error;
        await audit(ctx, "admin.update", "admin", user_id, patch);
        return send(res, 200, { ok: true });
      }
    }

    if (resource === "health" && req.method === "GET") {
      const checks = await Promise.all([
        supabase.from("admin_members").select("user_id",{count:"exact",head:true}),
        supabase.from("app_releases").select("id",{count:"exact",head:true}),
        supabase.from("admin_members").select("user_id",{count:"exact",head:true}),
      ]);
      return send(res, 200, { services: checks.map((x,i)=>({ name:["Supabase database","OTA release registry","Admin access registry"][i], status:x.error?"degraded":"operational", detail:x.error?.message || "Connection successful" })) });
    }

    return send(res, 404, { error: "Unknown admin resource or unsupported method." });
  } catch (error) {
    console.error("[admin-api]", resource, error);
    return fail(res, error, 500);
  }
}
