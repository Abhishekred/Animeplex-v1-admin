import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, isHttpsUrl, validateRelease, escapeHtml, validUploadParts, APK_CHUNK_BYTES } from '../src/utils.js';

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
test('accepts HTTPS direct downloads even without .apk suffix', () => {
  for (const url of [
    'https://d.apkpure.com/b/APK/com.Animeplex.music?version=latest',
    'https://files.example.org/download?id=12345',
    'https://cdn.example.org/asset',
    'https://example.com/AnimePlex.apk',
  ]) {
    const result = validateRelease({
      version:'2.3.8',channel:'stable',
      delivery_method:'link',apk_url:url,apk_size:0,
    });
    assert.equal(result.error, undefined, url);
    assert.equal(result.data.apk_url, url);
    assert.equal(result.data.delivery_method, 'link');
  }
});
test('link mode still rejects insecure URLs and sizes entered in MB', () => {
  for (const url of [
    'http://example.com/download',
    'javascript:alert(1)',
    'https://user:password@example.com/download',
    'https://example.com/path with spaces',
  ]) {
    assert.ok(validateRelease({
      version:'2.3.8',channel:'stable',
      delivery_method:'link',apk_url:url,apk_size:0,
    }).error);
  }
  assert.match(validateRelease({
    version:'2.3.8',channel:'stable',
    apk_url:'https://d.apkpure.com/b/APK/com.Animeplex.music?version=latest',
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

test('multipart APK upload is valid with ordered, safe, correctly sized chunks', () => {
  const id='12345678-1234-1234-1234-123456789abc';
  const parts=[{path:`releases/${id}/${id}/part-001.bin`,size:APK_CHUNK_BYTES},
   {path:`releases/${id}/${id}/part-002.bin`,size:50331648-APK_CHUNK_BYTES}];
  assert.equal(validUploadParts(parts,50331648),true);
  assert.equal(validUploadParts(parts,12),false);
  assert.equal(validUploadParts([{path:'../credentials',size:123}],123),false);
  const result=validateRelease({version:'2.4.0',channel:'stable',
     delivery_method:'upload',apk_size:50331648,apk_parts:parts});
  assert.equal(result.data.delivery_method,'upload');
  assert.equal(result.data.apk_url,null);
  assert.equal(result.data.apk_parts.length,2);
});
