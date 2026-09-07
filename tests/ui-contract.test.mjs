import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const careerHtml = await readFile(new URL('../career.html', import.meta.url), 'utf8');
const mapHtml = await readFile(new URL('../map.html', import.meta.url), 'utf8');
const mapJs = await readFile(new URL('../map.js', import.meta.url), 'utf8');
const labHtml = await readFile(new URL('../lab.html', import.meta.url), 'utf8');
const criticalIds = [
  'decisionCta', 'editProfile', 'profileForm', 'stageList',
  'addUpdate', 'addEvidence', 'evidenceFile', 'outcomeForm', 'drawerDone',
  'resetModal', 'themeToggle', 'growthExport', 'aiProgress'
];

for (const id of criticalIds) {
  assert.match(careerHtml, new RegExp(`id=["']${id}["']`), `career.html is missing #${id}`);
}
assert.ok(careerHtml.indexOf('path-model.js') < careerHtml.indexOf('career.js'), 'shared model must load before the workbench');
assert.ok(careerHtml.indexOf('commitment-model.js') < careerHtml.indexOf('career.js'), 'commitment model must load before the workbench');
assert.ok(labHtml.indexOf('path-model.js') < labHtml.indexOf('lab.js'), 'shared model must load before direction comparison');
assert.ok(mapHtml.indexOf('path-model.js') < mapHtml.indexOf('map.js'), 'shared model must load before the map');
assert.ok(mapHtml.indexOf('game-feedback-model.js') < mapHtml.indexOf('map.js'), 'feedback model must load before the map');
for (const id of ['routeLines', 'routeStations', 'stationPanel', 'closeStation', 'centerCurrent', 'rerouteNote']) {
  assert.match(mapHtml, new RegExp(`id=["']${id}["']`), `map is missing #${id}`);
}
for (const storageKey of ['pathwiseProfile', 'pathwisePlan', 'pathwiseTasks', 'pathwiseTaskProofs', 'pathwiseTrajectoryHistory']) {
  assert.ok(mapJs.includes(storageKey), `map no longer reads shared state ${storageKey}`);
}
assert.match(mapJs, /getWeightedProgress\(/, 'map must use the shared weighted progress model');
assert.match(mapJs, /buildBranchSpecs\(/, 'map must build explorable route branches');
assert.match(mapJs, /addEventListener\(['"]click['"]/, 'map stations must remain interactive');
assert.equal((mapHtml.match(/data-map-layer=/g) || []).length, 3, 'map must expose main, quest and destination layers');
assert.match(mapHtml, /class="route-terrain"/, 'map must preserve chapter terrain instead of falling back to a plain chart');
assert.match(mapJs, /destinationFork/, 'career alternatives must share one readable fork point');
assert.match(mapJs, /curvePath\(/, 'career routes must render as a map-like curved path');

console.log('ui contract tests passed');
