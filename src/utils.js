/** Escape untrusted API/user text before inserting it in HTML templates. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
}

export function isHttpsUrl(value) {
  try {
    const u = new URL(String(value).trim());
    return u.protocol === 'https:' && Boolean(u.hostname) &&
      !u.username && !u.password && !/\s/.test(String(value));
  } catch { return false; }
}

export function compareVersions(a, b) {
  const parts = (v) => {
    const [core, pre] = String(v ?? '').replace(/^v/i, '').split('-', 2);
    return { nums: core.split('.').map(n => Number.parseInt(n, 10) || 0), pre };
  };
  const x = parts(a), y = parts(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    if ((x.nums[i] ?? 0) !== (y.nums[i] ?? 0)) {
      return (x.nums[i] ?? 0) > (y.nums[i] ?? 0) ? 1 : -1;
    }
  }
  if (x.pre === undefined && y.pre !== undefined) return 1;
  if (x.pre !== undefined && y.pre === undefined) return -1;
  return String(x.pre ?? '').localeCompare(String(y.pre ?? ''), undefined, { numeric: true });
}

export function validateRelease(row) {
  const version = String(row.version ?? '').trim().replace(/^v/i, '');
  if (!/^\d+(\.\d+){1,3}(-[a-zA-Z0-9.-]+)?$/.test(version)) {
    return { error: 'Use a version like 2.3.7 or 2.3.7-beta1.' };
  }
  if (!isHttpsUrl(row.apk_url)) {
    return { error: 'Use a public HTTPS direct-download URL for a SIGNED APK.' };
  }
  if (String(row.release_notes ?? '').length > 20000) return { error: 'Release notes are too long.' };
  if (String(row.title ?? '').length > 180) return { error: 'Title is too long.' };
  const size = Number(row.apk_size ?? 0);
  if (!Number.isSafeInteger(size) || size < 0) return { error: 'APK size must be a non-negative number of bytes.' };
  if (!['stable', 'beta'].includes(row.channel)) return { error: 'Choose stable or beta.' };
  return { data: { version, title: String(row.title ?? '').trim(), release_notes: String(row.release_notes ?? '').trim(), apk_url: String(row.apk_url).trim(), apk_size: size, channel: row.channel, mandatory: Boolean(row.mandatory) } };
}

export const shortDate = (value) => value
  ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : 'Not yet';
