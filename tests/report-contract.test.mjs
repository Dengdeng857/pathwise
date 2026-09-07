import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../report.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../report.js', import.meta.url), 'utf8');

for (const id of ['profileLine', 'latestChange', 'latestImpact', 'latestTitle', 'latestWhy', 'latestMeta', 'latestNext', 'historyCount', 'historyList', 'historyTemplate']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `report.html should contain #${id}`);
}
assert.match(script, /pathwiseTrajectoryHistory/, 'report should consume trajectory history');
assert.match(script, /pathwiseProfile/, 'report should resolve evidence and profile context');
assert.match(script, /delta\.gaps\?\.resolved/, 'report should surface resolved gaps');
assert.match(script, /delta\.roleChanges/, 'report should surface role changes');
assert.match(script, /aria-expanded/, 'history details should be accessible');
assert.match(script, /history-item\.open/, 'opening an entry should close the previous one');
assert.match(script, /empty-report/, 'empty history should use the compact product state');

console.log('report contract tests passed');
