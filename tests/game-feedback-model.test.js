const assert = require('node:assert/strict');
const { buildMapFeedback, meaningfulTrajectory } = require('../game-feedback-model.js');

const tasks = [
  { title:'整理岗位', effort:2 },
  { title:'完成项目', effort:4 },
  { title:'获得实习', effort:5 }
];

// Merely clicking complete must never unlock a milestone or move the map.
const clickedOnly = buildMapFeedback({ weightedProgress:{ tasks, doneTasks:tasks, verifiedTasks:[], totalWeight:11, verifiedWeight:0 } });
assert.equal(clickedOnly.mapProgress, 0);
assert.deepEqual(clickedOnly.unlocked, []);

const firstProof = buildMapFeedback({ weightedProgress:{ tasks, verifiedTasks:[tasks[0]], totalWeight:11, verifiedWeight:2 } });
assert.deepEqual(firstProof.unlocked, ['first-proof']);
assert.equal(firstProof.newlyUnlocked[0].visual, 'trail-sign');
assert.equal(firstProof.next.id, 'deep-work');

const deepProof = buildMapFeedback({ weightedProgress:{ tasks, verifiedTasks:[tasks[0], tasks[1]], totalWeight:11, verifiedWeight:6 } });
assert.ok(deepProof.unlocked.includes('deep-work'));
assert.ok(!deepProof.unlocked.includes('momentum'), 'momentum also requires enough verified effort');

const routeChange = { delta:{ changed:true, kind:'route-change', impactScore:42 }, narrative:{ headline:'出现新方向', why:'项目形成新证据', confidence:82 } };
assert.equal(meaningfulTrajectory(routeChange), true);
assert.equal(meaningfulTrajectory({ delta:{ changed:true, kind:'fit-update', impactScore:5 }, narrative:{ confidence:90 } }), false);
const withRoute = buildMapFeedback({ weightedProgress:{ tasks, verifiedTasks:[tasks[0]], totalWeight:11, verifiedWeight:2 }, trajectory:[routeChange], previousUnlocked:['first-proof'] });
assert.ok(withRoute.unlocked.includes('route-clarity'));
assert.equal(withRoute.newlyUnlocked.length, 1);
assert.equal(withRoute.activeFeedback.id, 'route-clarity');

const arrived = buildMapFeedback({ weightedProgress:{ tasks, verifiedTasks:tasks, totalWeight:11, verifiedWeight:11 }, previousUnlocked:['first-proof','deep-work','momentum','halfway'] });
assert.equal(arrived.mapProgress, 100);
assert.ok(arrived.unlocked.includes('arrival'));
assert.equal(arrived.activeFeedback.intensity, 'major');

console.log('game feedback model tests passed');
