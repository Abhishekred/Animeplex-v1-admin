import { audit, fail, requireAdmin, send } from "../_lib/admin.js";

const roles = ["owner", "admin", "release_manager", "moderator", "auditor"];
const writeRoles = ["owner", "admin"];
const releaseRoles = ["owner", "admin", "release_manager"];

export default async function handler(req, res) {
  const resource = String(req.query.resource || "").toLowerCase();
  const roleAllow = resource === "releases" ? releaseRoles : resource === "announcements" ? ["owner","admin","moderator"] : writeRoles;
  const ctx = await requireAdmin(req, res, req.method === "GET" ? [] : roleAllow);
  if (!ctx) return;
  const { supabase, user, role } = ctx;
  try {
    if (resource === "dashboard" && req.method === "GET") {
      const [profiles, releases, announcements, backups, admins, recent] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("app_releases").select("id,version,channel,status,created_at,rollout_percent").order("created_at", { ascending: false }).limit(5),
        supabase.from("app_announcements").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("backups").select("user_key,updated_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(5),
        supabase.from("admin_members").select("user_id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("admin_audit_logs").select("id,actor_email,action,target_type,target_id,created_at").order("created_at", { ascending: false }).limit(8),
      ]);
      const errors = [profiles,releases,announcements,backups,admins,recent].filter(x => x.error);
      if (errors.length) throw errors[0].error;
      return send(res, 200, {
        stats: { users: profiles.count || 0, activeAnnouncements: announcements.count || 0, backupAccounts: backups.count || 0, admins: admins.count || 0 },
        releases: releases.data || [], backups: backups.data || [], activity: recent.data || [],
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
        if (profileError) throw profileError;
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
        const allowed = ["maintenance_mode","minimum_supported_version","latest_version","support_url","discord_url","feature_flags","home_message"];
        if (!allowed.includes(key)) return send(res, 400, { error: "Unknown configuration key." });
        const { error } = await supabase.from("app_settings").upsert({ key, value, updated_by: user.id, updated_at: new Date().toISOString() });
        if (error) throw error;
        await audit(ctx, "config.update", "setting", key);
        return send(res, 200, { ok: true });
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
        for (const key of ["title","body","type","is_active","action_url"]) if (key in changes) patch[key] = changes[key];
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
          if (!name.toLowerCase().endsWith(".apk") && !name.toLowerCase().endsWith(".aab")) return send(res, 400, { error: "Only APK or AAB files are accepted." });
          const path = "releases/" + crypto.randomUUID() + "/" + name;
          const { data, error } = await supabase.storage.from("animeplex-releases").createSignedUploadUrl(path);
          if (error) throw error;
          return send(res, 200, { path, token: data.token, signedUrl: data.signedUrl });
        }
        if (body.action === "create") {
          if (!body.version || !Number.isInteger(Number(body.version_code)) || !body.storage_path) return send(res, 400, { error: "Version, version code and uploaded APK are required." });
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
            const { data: release, error: readError } = await supabase.from("app_releases").select("id,version_code,storage_path,channel").eq("id",id).single();
            if (readError) throw readError;
            const { data: latest } = await supabase.from("app_releases").select("version_code").eq("channel", release.channel).eq("status","published").order("version_code",{ascending:false}).limit(1).maybeSingle();
            if (latest && Number(release.version_code) <= Number(latest.version_code)) return send(res, 409, { error: "Version code must be greater than the currently published version in this channel." });
            const { data: urlData, error: urlError } = await supabase.storage.from("animeplex-releases").createSignedUrl(release.storage_path, 60*60*24*365);
            if (urlError) throw urlError;
            const { error } = await supabase.from("app_releases").update({ status, download_url: urlData.signedUrl, published_at: new Date().toISOString() }).eq("id",id);
            if (error) throw error;
          } else {
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

    if (resource === "backups" && req.method === "GET") {
      const { data, error } = await supabase.from("backups").select("user_key,updated_at").order("updated_at", { ascending: false }).limit(100);
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
        supabase.from("profiles").select("id",{count:"exact",head:true}),
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
