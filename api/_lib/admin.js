import { createClient } from "@supabase/supabase-js";

export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Admin API is not configured: missing Supabase server environment.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function send(res, status, payload) {
  res.status(status).setHeader("Cache-Control", "no-store").json(payload);
}

export function getBearer(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

export async function requireAdmin(req, res, allowed = []) {
  const token = getBearer(req);
  if (!token) {
    send(res, 401, { error: "Sign in required." });
    return null;
  }
  let supabase;
  try {
    supabase = serviceClient();
  } catch (error) {
    send(res, 503, { error: error.message });
    return null;
  }
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    send(res, 401, { error: "Your session is invalid or expired." });
    return null;
  }
  const { data: membership, error: roleError } = await supabase
    .from("admin_members")
    .select("user_id, role, is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (roleError || !membership || membership.is_active !== true) {
    send(res, 403, { error: "This account does not have active AnimePlex admin access." });
    return null;
  }
  if (allowed.length && !allowed.includes(membership.role)) {
    send(res, 403, { error: "Your administrator role cannot perform this action." });
    return null;
  }
  const { data: withinLimit, error: limitError } = await supabase.rpc("admin_rate_limit_check", {
    p_user_id: authData.user.id,
    p_max_requests: 120,
  });
  if (limitError) {
    console.error("[admin-rate-limit]", limitError);
    send(res, 503, { error: "Admin security controls are temporarily unavailable." });
    return null;
  }
  if (withinLimit !== true) {
    send(res, 429, { error: "Too many admin requests. Wait one minute and try again." });
    return null;
  }
  return { supabase, user: authData.user, role: membership.role };
}

export async function audit(ctx, action, targetType, targetId, details = {}) {
  const safeDetails = JSON.parse(JSON.stringify(details));
  await ctx.supabase.from("admin_audit_logs").insert({
    actor_id: ctx.user.id,
    actor_email: ctx.user.email || null,
    actor_role: ctx.role,
    action,
    target_type: targetType,
    target_id: targetId ? String(targetId).slice(0, 180) : null,
    details: safeDetails,
  });
}

export function fail(res, error, status = 400) {
  send(res, status, { error: error?.message || String(error) });
}
