import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../career.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../career.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../redesign.css', import.meta.url), 'utf8');

assert.match(css, /prefers-reduced-motion\s*:\s*reduce/, 'motion-heavy UI needs a reduced-motion mode');
for (const dialog of html.matchAll(/role=["']dialog["']/g)) {
  const tag = html.slice(Math.max(0, dialog.index - 100), dialog.index + 180);
  assert.match(tag, /aria-modal=["']true["']/, 'dialogs must declare modal semantics');
}
assert.match(script, /focusBeforeModal/, 'modal opening must preserve keyboard focus');
assert.match(script, /event\.key !== 'Tab'/, 'modal needs a keyboard focus trap');
assert.match(script, /event\.key === 'Escape'/, 'modal must close with Escape');
assert.match(script, /element\.inert = true/, 'closed dialogs must not leave hidden controls in the tab order');
assert.doesNotMatch(script, /raw response prefix.*slice/i, 'AI response content must not be written to console');
assert.match(script, /\['http:', 'https:'\]/, 'external case URLs must use an allowlist');
assert.match(script, /noopener noreferrer/, 'external links must prevent opener access');
assert.match(script, /prepareProfileForStorage/, 'profile writes must be bounded before localStorage');

console.log('privacy and accessibility tests passed');
