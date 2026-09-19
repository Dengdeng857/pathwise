import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../career.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../career.js', import.meta.url), 'utf8');
const mapJs = await readFile(new URL('../map.js', import.meta.url), 'utf8');
const reportJs = await readFile(new URL('../report.js', import.meta.url), 'utf8');

assert.match(html, /<body class="workspace-view-overview is-onboarding">/);
assert.match(html, /id="profileTitle">还没有建立职业画像/);
assert.doesNotMatch(html, /id="profileTitle">本科大三下|id="stageStat">大三下|id="targetStat">软件安全/);
assert.match(html, /id="modalResumeBtn"/);
assert.match(js, /ai-target-suggestion/);
assert.match(js, /采用 AI 建议/);
assert.match(js, /AI 不会静默改写目标/);
assert.match(js, /if \(!target\)/);
assert.match(js, /document\.body\.classList\.toggle\('is-onboarding', !hasStoredProfile\)/);
assert.match(html, /id="startDemo"/, 'empty onboarding must offer an explicit synthetic demo');
assert.match(js, /synthetic_demo/, 'demo evidence must be clearly marked as synthetic');
assert.match(js, /if \(hasStoredProfile\) return/, 'demo must never overwrite an existing user path');
assert.match(js, /pathwiseDemoMode/, 'demo state must remain distinguishable from user data');
assert.match(mapJs, /匿名合成示例 · 仅用于体验/, 'map must keep demo provenance visible');
assert.match(reportJs, /匿名合成示例/, 'report must keep demo provenance visible');
assert.match(js, /\$\('#aiCommandInput'\)\.disabled = true/);

console.log('onboarding contract tests passed');
