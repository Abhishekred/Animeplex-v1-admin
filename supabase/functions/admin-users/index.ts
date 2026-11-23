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
    if (!input || typeof input !== "object" || !["update", "delete"].includes(input.action) ||
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

    // No account with an admin-membership record may ever be deleted here,
    // including inactive owners/admins. The SQL purge function repeats this guard.
    if (id === actor.id) return json({ error: "You cannot delete your own admin account" }, 403);
    const { data: protectedMember, error: protectedError } = await db.from("admin_members")
      .select("user_id").eq("user_id", id).maybeSingle();
    if (protectedError) return json({ error: "Unable to check admin protection" }, 500);
    if (protectedMember) return json({ error: "Protected admin account cannot be deleted" }, 403);
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
