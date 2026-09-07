import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const apiDir = resolve(root, 'functions/api');
const files = (await readdir(apiDir)).filter(name => /\.js$/.test(name));
for (const name of files) {
  const path = resolve(apiDir, name);
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const imported = resolve(dirname(path), match[1]);
    await assert.doesNotReject(() => access(imported), `${name} imports missing deployment file ${match[1]}`);
  }
  assert.doesNotMatch(source, /\b(?:process|Buffer|require|__dirname)\b/, `${name} uses a Node-only global unavailable in Pages Functions`);
}

const careerSource = await readFile(resolve(root, 'career.js'), 'utf8');
const requestedApis = [...new Set([...careerSource.matchAll(/['"](\/api\/[a-z-]+)['"]/g)].map(match => match[1]))];
for (const endpoint of requestedApis) {
  const functionFile = resolve(apiDir, `${endpoint.slice('/api/'.length)}.js`);
  await assert.doesNotReject(() => access(functionFile), `browser calls ${endpoint}, but no Pages Function exists`);
  const serverSource = await readFile(resolve(root, 'server.py'), 'utf8');
  assert.ok(serverSource.includes(endpoint), `browser calls ${endpoint}, but local server does not implement it`);
}

console.log('Cloudflare function import tests passed');
