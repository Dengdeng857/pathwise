import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../report.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../report.js', import.meta.url), 'utf8');

for (const id of ['profileLine', 'latestChange', 'latestImpact', 'latestTitle', 'latestWhy', 'latestMeta', 'latestDelta', 'latestRoleDelta', 'latestGapDelta', 'latestActionDelta', 'latestNext', 'historyCount', 'historyList', 'historyTemplate']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `report.html should contain #${id}`);
}
assert.match(script, /pathwiseTrajectoryHistory/, 'report should consume trajectory history');
assert.match(script, /entry\?\.id === item\.evidenceId/, 'report should link trajectory to stable evidence ids');
assert.match(script, /pathwiseProfile/, 'report should resolve evidence and profile context');
assert.match(html, /evidence-schema-model\.js/, 'report should load the shared evidence schema');
assert.match(script, /PathwiseEvidence/, 'report should normalize legacy evidence through the shared schema');
assert.match(script, /delta\.gaps\?\.resolved/, 'report should surface resolved gaps');
assert.match(script, /delta\.roleChanges/, 'report should surface role changes');
assert.match(html, /id=["']latestQuote["']/, 'report should expose the latest reviewable evidence quote');
assert.match(html, /class=["']history-quote["']/, 'history entries should expose their evidence quote');
assert.match(script, /evidenceQuoteFor/, 'report should resolve evidence quotes from shared trajectory state');
assert.match(script, /latestDeltaText/, 'latest report card should summarize role, gap and action changes');
assert.match(script, /aria-expanded/, 'history details should be accessible');
assert.match(script, /history-item\.open/, 'opening an entry should close the previous one');
assert.match(script, /empty-report/, 'empty history should use the compact product state');

console.log('report contract tests passed');
