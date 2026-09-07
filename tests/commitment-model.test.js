const assert = require('assert');
const model = require('../commitment-model.js');

const now = Date.UTC(2026, 8, 7, 8);
const commitment = model.createCommitment(3, now);
assert.equal(commitment.estimatedDays, 3);
assert.equal(model.formatCommitment(commitment, now), '还剩 3 天');
assert.equal(model.formatCommitment(commitment, now + 2 * 86400000), '明天到期');
assert.equal(model.formatCommitment(commitment, now + 3 * 86400000), '今天到期');
assert.equal(model.formatCommitment(commitment, now + 4 * 86400000), '已到期 1 天');

assert.equal(model.pickCommittedTask({ B: commitment, A: commitment }, ['A', 'B']), 'B');
assert.equal(model.pickCommittedTask({ OLD: commitment }, ['A', 'B']), '');
assert.equal(model.createCommitment(0, now).estimatedDays, 3);

console.log('commitment model tests passed');
