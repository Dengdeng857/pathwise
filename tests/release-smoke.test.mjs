import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import net from 'node:net';
import { dirname, extname, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const htmlFiles = (await readdir(root)).filter(name => extname(name) === '.html');
let referenceCount = 0;
for (const name of htmlFiles) {
  const html = await readFile(resolve(root, name), 'utf8');
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const ref = match[1];
    if (/^(?:https?:|data:|mailto:|tel:|#)/.test(ref)) continue;
    const [file, hash] = ref.split('#');
    const target = resolve(dirname(resolve(root, name)), file || name);
    await assert.doesNotReject(() => access(target), `${name} links to missing ${ref}`);
    if (hash && extname(target) === '.html') {
      const targetHtml = await readFile(target, 'utf8');
      const escaped = hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.match(targetHtml, new RegExp(`id=["']${escaped}["']`), `${name} links to missing anchor ${ref}`);
    }
    referenceCount += 1;
  }
}
assert.ok(referenceCount > 10, 'smoke test did not inspect enough local assets');

const port = await new Promise((done, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const selected = server.address().port;
    server.close(error => error ? reject(error) : done(selected));
  });
});
const child = spawn('python3', ['server.py'], { cwd: root, env: { ...process.env, PORT:String(port), HOST:'127.0.0.1' }, stdio:['ignore', 'pipe', 'pipe'] });
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch (_) {}
    await new Promise(wait => setTimeout(wait, 50));
  }
  assert.equal(ready, true, 'local server did not start');
  for (const page of ['/', '/index.html', '/career.html', '/map.html', '/lab.html', '/report.html']) {
    const response = await fetch(`${base}${page}`);
    assert.equal(response.status, 200, `${page} must be locally reachable`);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
  }
  const health = await fetch(`${base}/api/health`);
  assert.equal(typeof (await health.json()).configured, 'boolean');
  const profile = await fetch(`${base}/api/profile-extract`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ content:'2027届 北京大学 软件工程硕士 AI项目' }) });
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).school, '北京大学');
  const malformed = await fetch(`${base}/api/trajectory-update`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{' });
  assert.equal(malformed.status, 400);
  assert.match(malformed.headers.get('content-type') || '', /application\/json/);
  const emptyAction = await fetch(`${base}/api/action-guide`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{}' });
  assert.equal(emptyAction.status, 400, 'local and cloud action-guide validation must agree');
  for (const endpoint of ['/api/profile-extract', '/api/evidence-insight']) {
    const emptyContent = await fetch(`${base}${endpoint}`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{}' });
    assert.equal(emptyContent.status, 400, `local and cloud ${endpoint} validation must agree`);
    assert.match(emptyContent.headers.get('content-type') || '', /application\/json/);
  }
} finally {
  child.kill('SIGTERM');
  await new Promise(done => { child.once('exit', done); setTimeout(done, 1000); });
}

console.log('release smoke tests passed');
