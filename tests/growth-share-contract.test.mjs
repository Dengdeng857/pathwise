import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const html = await readFile(new URL('../career.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../career.js', import.meta.url), 'utf8');

assert.match(html, /id="growthShare"[^>]*>复制成长摘要/);
assert.match(js, /function buildGrowthShareText\(\)/);
assert.match(js, /按行动难度与成果计算/);
assert.match(js, /最近一次路径变化/);
assert.match(js, /growth_summary_copied/);
assert.match(js, /navigator\.clipboard/);
const shareFunction = js.slice(js.indexOf('function buildGrowthShareText()'), js.indexOf('function stripPrivateExportFields'));
assert.doesNotMatch(shareFunction, /filename|content/, '分享摘要不应包含文件名或证据原文');
assert.match(html, /导出隐私版数据/);
assert.match(js, /function buildPrivacySafeExport\(\)/);
assert.match(js, /privacyMode:'redacted'/);
assert.match(js, /privateFields = new Set\(\['content', 'filename', 'quote', 'excerpt', 'sourceLabel', 'link', 'url'\]\)/);
assert.match(js, /trajectory:stripPrivateExportFields/);
assert.match(js, /verifiedTasks:\[\.\.\.verifiedTasks\]/);

const exportFunctions = js.slice(js.indexOf('function stripPrivateExportFields'), js.indexOf('async function copyText'));
const exportContext = {
  profile:{ stage:'本科大三', school:'211', major:'计算机', target:'安全工程师', evidence:[{
    id:'ev_1', type:'简历', capturedAt:'2026-09-01', source:{ kind:'uploaded_file', label:'private-resume.pdf' },
    filename:'private-resume.pdf', content:'private-resume-text', verification:'supported', confidence:.72,
    supports:['Python'], exposesGap:['项目成果'], impact:'行动优先级调整'
  }] },
  plan:{ actions:['完成代码审计案例'], graduationRoles:[{ title:'安全工程师', evidenceTrace:{
    evidenceId:'ev_1', claim:'private-resume-text', quote:'private-resume-text', sourceLabel:'private-resume.pdf'
  } }] },
  completedTasks:new Set(['完成代码审计案例']), verifiedTasks:new Set(), actionCommitments:{},
  STORAGE:{ trajectory:'trajectory' },
  readJSON:() => [{ delta:{ kind:'priority-shift', evidence:{
    type:'简历', label:'private-resume.pdf', excerpt:'private-resume-text', quote:'private-resume-text'
  } }, narrative:{ headline:'路线已更新', nextMove:'完成代码审计案例' } }]
};
const exported = runInNewContext(`${exportFunctions}\nbuildPrivacySafeExport()`, exportContext);
const serialized = JSON.stringify(exported);
assert.equal(exported.privacyMode, 'redacted');
assert.deepEqual(JSON.parse(JSON.stringify(exported.completedTasks)), ['完成代码审计案例']);
assert.equal(exported.trajectory[0].delta.kind, 'priority-shift');
assert.doesNotMatch(serialized, /private-resume\.pdf|private-resume-text/);

console.log('growth share contract tests passed');
