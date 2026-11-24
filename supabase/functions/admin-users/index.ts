// AnimePlex admin-only account editing and deletion.
// No service-role key is ever sent to the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const uuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  try {
    const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!bearer) return json({ error: "Sign in required" }, 401);
    const { data: authData, error: authError } = await db.auth.getUser(bearer);
    const actor = authData?.user;
    if (authError || !actor) return json({ error: "Session expired. Sign in again." }, 401);

    const { data: member, error: memberError } = await db.from("admin_members")
      .select("role,is_active").eq("user_id", actor.id).maybeSingle();
    if (memberError || !member?.is_active || !["owner", "admin"].includes(member.role)) {
      return json({ error: "Owner/admin permission required" }, 403);
    }

    const input = await req.json().catch(() => null);
    if (!input || typeof input !== "object" || !["update", "delete", "provider", "ban", "unban"].includes(input.action) ||
        !uuid(input.userId)) {
      return json({ error: "Invalid account request" }, 400);
    }
    const id: string = input.userId;
    const { data: userData, error: targetError } = await db.auth.admin.getUserById(id);
    const target = userData?.user;
    if (targetError || !target) return json({ error: "Account not found" }, 404);

    if (input.action === "update") {
      const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
      const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
      if (!displayName || displayName.length > 80) {
        return json({ error: "Display name must be 1–80 characters" }, 400);
      }
      if (!validEmail(email)) return json({ error: "Enter a valid email address" }, 400);

      // Preserve the user's account ID and authorization metadata.
      if (email !== target.email?.toLowerCase()) {
        const { error } = await db.auth.admin.updateUserById(id, { email });
        if (error) return json({ error: error.message }, 400);
      }
      const { error: profileError } = await db.from("profiles")
        .upsert({ id, display_name: displayName }, { onConflict: "id" });
      if (profileError) {
        return json({ error: "Email may have changed; profile update failed: " + profileError.message }, 500);
      }
      const { error: logError } = await db.from("admin_audit_logs").insert({
        actor_id: actor.id, actor_email: actor.email || null, actor_role: member.role,
        action: "user_updated", target_type: "user", target_id: id,
        details: { fields: ["display_name", "email"] },
      });
      if (logError) console.error("admin audit insert failed", logError.message);
      return json({ ok: true, user: { id, email, display_name: displayName } });
    }

    // Restrict bans, provider locks and deletion to non-admin user accounts.
    // Protect inactive admins too; self-management cannot bypass this.
    if (id === actor.id) return json({ error: "You cannot restrict your own admin account" }, 403);
    const { data: protectedMember, error: protectedError } = await db.from("admin_members")
      .select("user_id").eq("user_id", id).maybeSingle();
    if (protectedError) return json({ error: "Unable to check admin protection" }, 500);
    if (protectedMember) return json({ error: "Protected admin account cannot be restricted" }, 403);

    if (input.action === "provider") {
      const selected = typeof input.sourceId === "string" ? input.sourceId.trim() : "";
      const locked = input.locked === true;
      if (selected && !/^[A-Za-z0-9_./:@+-]{1,220}$/.test(selected)) {
        return json({ error: "Invalid installed source ID" }, 400);
      }
      if (locked && !selected) return json({ error: "Select a provider before locking" }, 400);
      const { data: existing, error: existingError } = await db.from("animeplex_user_runtime_controls")
        .select("available_providers,current_provider_id,is_banned").eq("user_id",id).maybeSingle();
      if (existingError) return json({ error: existingError.message }, 500);
      if (existing?.is_banned) return json({ error: "Unban user before changing providers" }, 409);
      const available = Array.isArray(existing?.available_providers) ? existing.available_providers : [];
      if (selected && !available.some((item: {id?:string}) => item.id === selected)) {
        return json({ error: "Provider not installed or not yet reported by this user's app" }, 409);
      }
      const payload = {
        user_id:id,
        current_provider_id:selected || existing?.current_provider_id || null,
        forced_provider_id:locked ? selected : null,
        provider_locked:locked,
        updated_at:new Date().toISOString(),
      };
      // Update only the provider fields. Upsert can reset omitted ban columns
      // to defaults, so never use an unrestricted merge here.
      const providerWrite = existing
        ? db.from("animeplex_user_runtime_controls").update(payload).eq("user_id",id)
        : db.from("animeplex_user_runtime_controls").insert(payload);
      const { data: row, error: saveError } = await providerWrite
        .select("current_provider_id,forced_provider_id,provider_locked,is_banned,ban_reason,available_providers,last_seen_at").single();
      if (saveError) return json({ error: saveError.message }, 500);
      const {error:logError}=await db.from("admin_audit_logs").insert({
        actor_id:actor.id,actor_email:actor.email||null,actor_role:member.role,
        action:"user_provider_control",target_type:"user",target_id:id,
        details:{selected_source_id:selected||null,locked},
      });
      if(logError)console.error("provider audit insert failed",logError.message);
      return json({ok:true,controls:row});
    }

    if (input.action === "ban" || input.action === "unban") {
      const banned = input.action === "ban";
      const reason = typeof input.reason === "string" ? input.reason.trim() : "";
      if (banned && (reason.length < 3 || reason.length > 500)) {
        return json({ error: "Ban reason must be 3–500 characters" }, 400);
      }
      const {data:previous,error:lookupError}=await db.from("animeplex_user_runtime_controls")
        .select("is_banned").eq("user_id",id).maybeSingle();
      if(lookupError)return json({error:"Unable to check account status"},500);
      // Auth-level ban prevents future sign-ins and token refresh; a local UI-only
      // flag cannot provide this guarantee.
      const {error:authBanError}=await db.auth.admin.updateUserById(id,{
        ban_duration:banned?"876000h":"none",
      });
      if(authBanError)return json({error:authBanError.message},409);
      const banFields={
        is_banned:banned,ban_reason:banned?reason:null,
        banned_at:banned?new Date().toISOString():null,
        updated_at:new Date().toISOString(),
      };
      // Preserve the user's current and locked provider when changing ban state.
      const banWrite = previous
        ? db.from("animeplex_user_runtime_controls").update(banFields).eq("user_id",id)
        : db.from("animeplex_user_runtime_controls").insert({user_id:id,...banFields});
      const {data:row,error:saveError}=await banWrite
        .select("current_provider_id,forced_provider_id,provider_locked,is_banned,ban_reason,available_providers,last_seen_at").single();
      if(saveError){
        // Best-effort compensation: do not leave Auth and the app dashboard
        // inconsistent if the state record cannot be saved.
        if(previous?.is_banned!==banned){
          const rollback=await db.auth.admin.updateUserById(id,{
            ban_duration:previous?.is_banned?"876000h":"none",
          });
          if(rollback.error)console.error("Auth ban rollback failed",rollback.error.message);
        }
        return json({error:"Auth state was updated but controls could not be saved: "+saveError.message},500);
      }
      const {error:logError}=await db.from("admin_audit_logs").insert({
        actor_id:actor.id,actor_email:actor.email||null,actor_role:member.role,
        action:banned?"user_banned":"user_unbanned",target_type:"user",target_id:id,
        details:banned?{reason}:{},
      });
      if(logError)console.error("ban audit insert failed",logError.message);
      return json({ok:true,controls:row});
    }

    // No account with an admin-membership record may ever be deleted here,
    // including inactive owners/admins. The SQL purge function repeats this guard.
    const expectedEmail = (target.email ?? "").trim().toLowerCase();
    if (!expectedEmail || input.confirmEmail !== expectedEmail) {
      return json({ error: "Type the account's exact email to confirm deletion" }, 400);
    }

    // The deletion routine is executable by service_role only.
    // It removes app data and private profile records before Auth removal.
    const { error: purgeError } = await db.rpc("animeplex_admin_purge_account", { p_user_id: id });
    if (purgeError) return json({ error: "Could not clean user data: " + purgeError.message }, 409);
    const { error: deleteError } = await db.auth.admin.deleteUser(id);
    if (deleteError) {
      return json({
        error: "User data was cleared, but Auth removal failed: " + deleteError.message +
          ". Check storage ownership and retry."
      }, 409);
    }
    const { error: logError } = await db.from("admin_audit_logs").insert({
      actor_id: actor.id, actor_email: actor.email || null, actor_role: member.role,
      action: "user_deleted", target_type: "user", target_id: id,
      details: { deleted: true },
    });
    if (logError) console.error("admin audit insert failed", logError.message);
    return json({ ok: true, deletedId: id });
  } catch (err) {
    console.error("admin-users request failed", err instanceof Error ? err.message : "error");
    return json({ error: "Unable to complete request. Please retry." }, 500);
  }
});
