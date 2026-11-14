// Keep Supabase's default storage key so existing users keep their saved session.
export const AUTH_OPTIONS = Object.freeze({
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
});

/** Keep auth events authoritative if an older restore finishes after sign-in/out. */
export function observeAuthSession(auth, { onSession, onUnavailable }) {
  let active = true;
  let eventVersion = 0;
  let requestVersion = 0;
  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    if (!active || event === 'INITIAL_SESSION') return;
    eventVersion += 1;
    requestVersion += 1;
    onSession(session, event);
  });
  async function restore() {
    const request = ++requestVersion;
    const eventAtStart = eventVersion;
    try {
      const { data, error } = await auth.getSession();
      if (!active || request !== requestVersion || eventAtStart !== eventVersion) return;
      if (error) onUnavailable(error);
      else onSession(data?.session ?? null, 'RESTORED');
    } catch (error) {
      if (active && request === requestVersion && eventAtStart === eventVersion) onUnavailable(error);
    }
  }
  return { restore, close() { active = false; subscription.unsubscribe(); } };
}

/** A 401 is returned before the admin API performs a mutation; retry once with a renewed token. */
export async function requestWithSessionRetry(auth, token, execute) {
  const response = await execute(token);
  if (response.status !== 401) return response;
  try {
    const current = await auth.getSession();
    if (current.error || !current.data?.session) return response;
    let next = current.data.session.access_token;
    if (next === token) {
      const refreshed = await auth.refreshSession();
      if (refreshed.error) return response;
      next = refreshed.data?.session?.access_token;
    }
    return next && next !== token ? await execute(next) : response;
  } catch {
    return response;
  }
}
