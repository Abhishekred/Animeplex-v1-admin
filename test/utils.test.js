import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, isHttpsUrl, validateRelease, escapeHtml } from '../src/utils.js';

test('version ordering stable beats prerelease and compares numeric components', () => {
  assert.equal(compareVersions('2.3.10', '2.3.9'), 1);
  assert.equal(compareVersions('2.3.7', '2.3.7-beta2'), 1);
  assert.equal(compareVersions('v2.3.7-beta11', '2.3.7-beta2'), 1);
  assert.equal(compareVersions('2.3.7', '2.3.7'), 0);
});
test('APK URL must be HTTPS without credentials', () => {
  assert.equal(isHttpsUrl('https://github.com/user/repo/releases/download/v1/app.apk'), true);
  assert.equal(isHttpsUrl('javascript:alert(1)'), false);
  assert.equal(isHttpsUrl('http://example.com/app.apk'), false);
  assert.equal(isHttpsUrl('https://user:password@example.com/app.apk'), false);
});
test('published candidate requires a signed-APK link field and valid version', () => {
  assert.ok(validateRelease({version:'2.3.8',channel:'stable',apk_url:'https://example.com/app.apk'}).data);
  assert.ok(validateRelease({version:'wrong',channel:'beta',apk_url:'https://example.com/app.apk'}).error);
  assert.ok(validateRelease({version:'2.3.8',channel:'stable',apk_url:'http://example.com/app.apk'}).error);
});
test('rejects non-APK download links and size values typed in MB', () => {
  assert.match(validateRelease({
    version:'2.3.8',channel:'stable',
    apk_url:'https://d.apkpure.com/b/APK/com.Animeplex.music?version=latest',
    apk_size:24,
  }).error, /signed .apk/);
  assert.match(validateRelease({
    version:'2.3.8',channel:'stable',
    apk_url:'https://example.com/AnimePlex.apk',
    apk_size:24,
  }).error, /BYTES/);
  assert.ok(validateRelease({
    version:'2.3.8',channel:'stable',
    apk_url:'https://example.com/AnimePlex.apk',
    apk_size:120000000,
  }).data);
});
test('dynamic text is escaped', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
});
