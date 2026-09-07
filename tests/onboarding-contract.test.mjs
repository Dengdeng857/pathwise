import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../career.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../career.js', import.meta.url), 'utf8');

assert.match(html, /<body class="workspace-view-overview is-onboarding">/);
assert.match(html, /id="profileTitle">还没有建立职业画像/);
assert.doesNotMatch(html, /id="profileTitle">本科大三下|id="stageStat">大三下|id="targetStat">软件安全/);
assert.match(html, /id="modalResumeBtn"/);
assert.match(js, /ai-target-suggestion/);
assert.match(js, /采用 AI 建议/);
assert.match(js, /AI 不会静默改写目标/);
assert.match(js, /if \(!target\)/);
assert.match(js, /document\.body\.classList\.toggle\('is-onboarding', !hasStoredProfile\)/);
assert.match(js, /\$\('#aiCommandInput'\)\.disabled = true/);

console.log('onboarding contract tests passed');
