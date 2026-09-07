const $ = selector => document.querySelector(selector);
const STORAGE = { profile: 'pathwiseProfile', plan: 'pathwisePlan', tasks: 'pathwiseTasks' };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const profile = read(STORAGE.profile, {});
const plan = read(STORAGE.plan, {});
const completed = new Set(read(STORAGE.tasks, []));
const fallbackStages = [{ title:'认识现在的你', why:'先建立真实画像，路径才有起点。', tasks:['建立职业画像'] },{ title:'形成关键能力', why:'用行动和成果补齐目标岗位缺口。', tasks:['完成一项可展示成果'] },{ title:'抵达毕业目标', why:'将能力转化为岗位机会。', tasks:['完成目标岗位投递'] }];
const stages = Array.isArray(plan.stages) && plan.stages.length ? plan.stages.slice(0,3) : fallbackStages;
const guides = Array.isArray(plan.actionGuides) ? plan.actionGuides : [];
const points = [[100,570],[300,485],[515,405],[720,400],[920,245],[1100,155]];
const tasks = stages.flatMap((stage, stageIndex) => (stage.tasks || []).slice(0,2).map(task => ({ title:task, stage, stageIndex })));
const nodes = [{ title: profile.stage ? `${profile.stage} · ${profile.major || '职业画像'}` : '建立职业画像', stage:stages[0], stageIndex:0, start:true }, ...tasks.slice(0,4), { title:(plan.graduationRoles || [])[0]?.title || profile.target || '毕业目标', stage:stages[2], stageIndex:2, goal:true }].slice(0,6);
while (nodes.length < 6) nodes.splice(nodes.length - 1, 0, { title:`第 ${nodes.length} 个行动`, stage:stages[Math.min(2, Math.floor(nodes.length / 2))], stageIndex:Math.min(2, Math.floor(nodes.length / 2)) });
const completedCount = nodes.slice(1,-1).filter(node => completed.has(node.title)).length;
const currentIndex = Math.min(nodes.length - 1, profile.stage ? completedCount + 1 : 0);

function detail(node, index) {
  const guide = guides.find(item => item.title === node.title);
  $('#mapDetailKicker').textContent = node.goal ? 'DESTINATION' : index < currentIndex ? 'VISITED STOP' : index === currentIndex ? 'CURRENT STOP' : 'UPCOMING STOP';
  $('#mapDetailTitle').textContent = node.title;
  $('#mapDetailWhy').textContent = guide?.why || node.stage?.why || '这是当前职业路径中的一个必要站点。';
  const steps = guide?.steps || (node.stage?.tasks || []).slice(0,3);
  $('#mapDetailBody').innerHTML = steps.length ? `<small>抵达这里要做什么</small><ol>${steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol><small>完成标志</small><strong>${escapeHtml(guide?.doneWhen || node.stage?.doneWhen || '留下一个可验证的成果')}</strong>` : '';
  $('#mapDetail').classList.add('open');
}

const group = $('#mapNodes');
nodes.forEach((node,index) => {
  const [x,y] = points[index];
  const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'locked';
  const item = document.createElementNS('http://www.w3.org/2000/svg','g');
  item.setAttribute('class',`map-node ${state}`); item.setAttribute('transform',`translate(${x} ${y})`); item.setAttribute('tabindex','0'); item.setAttribute('role','button'); item.setAttribute('aria-label',node.title);
  item.innerHTML = `<circle class="node-halo" r="28"/><circle class="node-core" r="17"/><text class="node-mark" y="5" text-anchor="middle">${node.goal?'⚑':index===0?'✦':index}</text><g class="node-label" transform="translate(0 -42)"><rect x="-78" y="-24" width="156" height="31" rx="4"/><text y="-5" text-anchor="middle">${escapeHtml(node.title.length>18?node.title.slice(0,17)+'…':node.title)}</text></g>`;
  item.addEventListener('click',()=>detail(node,index)); item.addEventListener('keydown',event=>{ if(event.key==='Enter'||event.key===' ') detail(node,index); }); group.appendChild(item);
});

const route = $('#routeBase');
const total = route.getTotalLength();
const progress = currentIndex / (nodes.length - 1);
$('#routeDone').style.strokeDasharray = `${total * progress} ${total}`;
const position = route.getPointAtLength(total * progress);
$('#traveler').setAttribute('transform',`translate(${position.x} ${position.y - 31})`);
detail(nodes[currentIndex], currentIndex);
$('#mapDetailClose').addEventListener('click',()=>$('#mapDetail').classList.remove('open'));
