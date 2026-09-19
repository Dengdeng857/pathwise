import { spawnSync } from 'node:child_process';

const script = process.argv[2];
if (!script) {
  console.error('Usage: node tests/run-python-test.mjs <test.py>');
  process.exit(2);
}

const candidates = process.platform === 'win32'
  ? [['python', []], ['py', ['-3']], ['python3', []]]
  : [['python3', []], ['python', []]];

for (const [command, prefix] of candidates) {
  const result = spawnSync(command, [...prefix, script], { stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') continue;
  if (result.status === 0) process.exit(0);
  if (result.status !== null) process.exit(result.status);
}

console.error('Python 3 is required to run the server regression tests.');
process.exit(1);
