import { createClient } from '@supabase/supabase-js';

/** Update only the authenticated administrator after verifying their current password. */
export async function updateOwnCredentials(ctx, body, { makeVerifier, recordAudit }) {
  const currentPassword = body?.currentPassword;
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 256)
    return { status: 400, error: 'Enter your current password.' };
  const emailChanged = Boolean(email && email.toLowerCase() !== ctx.user.email?.toLowerCase());
  const passwordChanged = Boolean(password);
  if (!emailChanged && !passwordChanged) return { status: 400, error: 'Enter a new email or password.' };
  if (emailChanged && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    return { status: 400, error: 'Enter a valid email address.' };
  if (passwordChanged && (password.length < 8 || password.length > 72))
    return { status: 400, error: 'New password must be between 8 and 72 characters.' };
  if (!ctx.user.email) return { status: 400, error: 'This administrator has no email address.' };

  const verifier = makeVerifier();
  const verification = await verifier.auth.signInWithPassword({ email: ctx.user.email, password: currentPassword });
  if (verification.error || verification.data?.user?.id !== ctx.user.id) {
    await recordAudit(ctx, 'admin.credentials.verify_failed', 'admin', ctx.user.id);
    return { status: 403, error: 'Current password is incorrect or could not be verified.' };
  }
  // The verifier is a separate short-lived client, so this does not log out the browser.
  try { await verifier.auth.signOut({ scope: 'local' }); } catch { /* verification session expires if revocation is unavailable */ }
  const changes = {};
  if (emailChanged) changes.email = email;
  if (passwordChanged) changes.password = password;
  const { error } = await ctx.supabase.auth.admin.updateUserById(ctx.user.id, changes);
  if (error) return { status: 400, error: 'Could not update credentials. Check the email and password, then try again.' };
  await recordAudit(ctx, 'admin.credentials.updated', 'admin', ctx.user.id, { emailChanged, passwordChanged });
  return { status: 200, ok: true, emailChanged, passwordChanged };
}

export function verificationClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Account verification is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
