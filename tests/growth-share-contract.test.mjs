import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../career.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../career.js', import.meta.url), 'utf8');

assert.match(html, /id="growthShare"[^>]*>复制成长摘要/);
assert.match(js, /function buildGrowthShareText\(\)/);
assert.match(js, /按行动难度与成果计算/);
assert.match(js, /最近一次路径变化/);
assert.match(js, /growth_summary_copied/);
assert.match(js, /navigator\.clipboard/);
assert.doesNotMatch(js, /buildGrowthShareText[\s\S]{0,1200}(filename|content)/, '分享摘要不应包含文件名或证据原文');

console.log('growth share contract tests passed');
