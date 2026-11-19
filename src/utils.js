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

export const APK_CHUNK_BYTES = 32 * 1024 * 1024;
export const APK_MAX_BYTES = 800 * 1024 * 1024;
export const APK_BUCKET = 'animeplex-releases';

// Link-mode size is entered in decimal MB; Postgres and Android use bytes.
// Uploaded APKs keep their exact file sizes and bypass these helpers.
export const LINK_MB_BYTES = 1000000;
export function linkMbToBytes(value) {
  if (value === '' || value == null) return 0;
  const mb = Number(value);
  if (!Number.isFinite(mb) || mb < 0 || mb > 10000) return NaN;
  return Math.round(mb * LINK_MB_BYTES);
}
export function linkBytesToMb(value) {
  const bytes = Number(value) || 0;
  if (bytes <= 0) return '0';
  return String(Number((bytes / LINK_MB_BYTES).toFixed(2)));
}


/** Upload manifest is public metadata. Require exact part sizes and safe paths. */
export function validUploadParts(parts, expectedSize) {
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > 100 ||
      !Number.isSafeInteger(expectedSize) || expectedSize < 1000000 ||
      expectedSize > APK_MAX_BYTES) return false;
  let total = 0;
  const seen = new Set();
  for (const part of parts) {
    const path = part?.path, size = part?.size;
    if (typeof path !== 'string' ||
        !/^releases\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/part-\d{3}\.bin$/.test(path) ||
        !Number.isSafeInteger(size) || size < 1 || size > APK_CHUNK_BYTES ||
        seen.has(path)) return false;
    seen.add(path);
    total += size;
  }
  return total === expectedSize;
}

export function validateRelease(row) {
  const version = String(row.version ?? '').trim().replace(/^v/i, '');
  if (!/^\d+(\.\d+){1,3}(-[a-zA-Z0-9.-]+)?$/.test(version)) {
    return { error: 'Use a version like 2.3.7 or 2.3.7-beta1.' };
  }
  if (String(row.release_notes ?? '').length > 20000) return { error: 'Release notes are too long.' };
  if (String(row.title ?? '').length > 180) return { error: 'Title is too long.' };
  if (!['stable', 'beta'].includes(row.channel)) return { error: 'Choose stable or beta.' };
  const size = Number(row.apk_size ?? 0);
  if (!Number.isSafeInteger(size) || size < 0) {
    return { error: 'APK size must be a non-negative number of bytes.' };
  }
  const method = row.delivery_method ?? 'link';
  if (!['link', 'upload'].includes(method)) return { error: 'Choose an APK source.' };
  let apkUrl = null, parts = [];
  if (method === 'upload') {
    parts = row.apk_parts ?? [];
    if (!validUploadParts(parts, size)) {
      return { error: 'Select and upload a complete signed APK before saving this release.' };
    }
  } else {
    if (!isHttpsUrl(row.apk_url)) {
      return { error: 'Use a public HTTPS direct-download URL for a SIGNED APK.' };
    }
    // The URL path need not end in .apk: legitimate file hosts and CDNs
    // use /download?id=... or redirects. The app verifies the downloaded
    // content before passing it to Android's package installer.
    if (size > 0 && size < 1000000) {
      return { error: 'APK size is in BYTES, not MB. Enter the exact file size (at least 1,000,000 bytes), or 0.' };
    }
    apkUrl = String(row.apk_url).trim();
  }
  return { data: {
    version, title: String(row.title ?? '').trim(),
    release_notes: String(row.release_notes ?? '').trim(),
    apk_url: apkUrl, apk_parts: parts, delivery_method: method,
    apk_size: size, channel: row.channel, mandatory: Boolean(row.mandatory),
  } };
}

export const shortDate = (value) => value
  ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : 'Not yet';
