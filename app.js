const views={home:'homeView',chores:'choresView',stock:'stockView',bills:'billsView'};
const toastEl=document.querySelector('#toast');
function toast(message){toastEl.textContent=message;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),2300)}
function showView(name){Object.values(views).forEach(id=>document.getElementById(id).classList.remove('active-view'));document.getElementById(views[name]).classList.add('active-view');document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>showView(el.dataset.view)));
document.querySelectorAll('.check-btn').forEach(btn=>btn.addEventListener('click',()=>{btn.textContent='✓';btn.classList.add('done');btn.closest('.task-card').style.opacity='.55';toast('已完成：'+btn.dataset.task)}));
document.querySelectorAll('.claim-btn').forEach(btn=>btn.addEventListener('click',()=>{btn.textContent='已认领';btn.disabled=true;toast('已加入你的待办，室友们会看到') }));
document.querySelectorAll('.outline-btn').forEach(btn=>btn.addEventListener('click',()=>toast('已更新库存数量')));
document.querySelectorAll('.swap-btn').forEach(btn=>btn.addEventListener('click',()=>toast('已发起交换，等室友确认')));
document.querySelectorAll('.room-zone').forEach(btn=>btn.addEventListener('click',()=>toast(btn.dataset.room+'：点击查看相关事项')));
document.querySelector('#spinWheel').addEventListener('click',()=>{document.querySelector('#wheel').style.transform='rotate(385deg)';setTimeout(()=>{document.querySelector('#wheel').style.transform='rotate(0deg)';toast('本周分工已重新分配')},1300)});
document.querySelector('#temperatureBtn').addEventListener('click',()=>toast('已打开匿名温度反馈'));
document.querySelector('#addTask').addEventListener('click',()=>toast('新事项创建入口已准备好'));
document.querySelector('#addStock').addEventListener('click',()=>toast('新物品已加入采购清单'));
document.querySelector('#addBill').addEventListener('click',()=>toast('打开费用记录表单'));
const daysSlider=document.querySelector('#daysSlider'),homeSlider=document.querySelector('#homeSlider');
let splitRule='days';
function updateSplit(){
  const days=Number(daysSlider.value), home=Number(homeSlider.value), total=186.4;
  let amount=splitRule==='head'?total/3:splitRule==='hybrid'?(total*.4/3+total*.6*(days/31*0.7+home/100*.3)):total*(days/31*.65+home/100*.35)/3;
  amount=Math.max(0,Math.min(total,amount));
  document.querySelector('#daysValue').textContent=days+' 天';document.querySelector('#homeValue').textContent=home+'%';
  document.querySelector('#simAmount').textContent='¥ '+amount.toFixed(2);document.querySelector('#amountLin').textContent=amount.toFixed(2);document.querySelector('#myBillTotal').textContent='¥ '+(amount+364).toFixed(2);
  document.querySelector('#barLin').style.height=Math.round(Math.max(35,Math.min(90,amount/90*70)))+'%';
  const delta=amount-total/3;document.querySelector('#simDelta').textContent=(delta<=0?'比平均值少 ¥ ':'比平均值多 ¥ ')+Math.abs(delta).toFixed(2);
  document.querySelector('#simExplain').textContent=splitRule==='head'?'三人均摊，最简单，但没有反映居住时长差异。':splitRule==='hybrid'?'40% 固定费用按人头，60% 按使用强度，兼顾简单和公平。':days<31?'你的居住天数较少，按天数分摊后承担得更少。':'本月居住接近满月，按使用强度分摊更接近实际。';
}
daysSlider.addEventListener('input',updateSplit);homeSlider.addEventListener('input',updateSplit);
document.querySelectorAll('.rule-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.rule-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');splitRule=btn.dataset.rule;document.querySelector('#splitLabel').textContent=splitRule==='head'?'按人头':splitRule==='hybrid'?'混合分摊':'按居住天数';updateSplit()}));
document.querySelector('#viewRules').addEventListener('click',()=>document.querySelector('#modal').classList.add('open'));
document.querySelector('#modalClose').addEventListener('click',()=>document.querySelector('#modal').classList.remove('open'));
document.querySelector('#closeAgreement').addEventListener('click',()=>document.querySelector('#modal').classList.remove('open'));
document.querySelector('#modal').addEventListener('click',e=>{if(e.target.id==='modal')e.currentTarget.classList.remove('open')});
