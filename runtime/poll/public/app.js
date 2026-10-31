/* Only textContent is used for user-authored text; no generated HTML or scripts are evaluated. */
const el = id => document.getElementById(id);
const hostMode = location.pathname === '/host';
let hostToken = '', state = null, busy = false, refreshing = false, stopped = false;
el('host-panel').hidden = !hostMode;
const messages = {
  vi: { open:'Đang nhận bình chọn',closed:'Bình chọn đã đóng',expired:'Ứng dụng đã hết hạn.',ended:'Ứng dụng đã kết thúc.',forbidden:'Khóa quản lý không đúng.',closedError:'Bình chọn đã đóng. Bạn chưa thể gửi phiếu.',invalid_vote:'Lựa chọn không hợp lệ.',name_required:'Vui lòng nhập tên.',capacity_reached:'Bình chọn đã đạt giới hạn số người.',generic:'Không thể kết nối. Vui lòng thử lại.',saved:'Đã lưu bình chọn. Bạn có thể đổi lựa chọn.',submit:'Gửi bình chọn',change:'Đổi bình chọn',sending:'Đang gửi…',results:'Kết quả chưa được công bố.',total:n=>`${n} phiếu`,expiry:d=>`Hết hạn: ${d}` },
  en: { open:'Voting is open',closed:'Voting is closed',expired:'This app has expired.',ended:'This app has ended.',forbidden:'Invalid host key.',closedError:'Voting is closed.',invalid_vote:'Invalid option.',name_required:'Enter your name.',capacity_reached:'The participant limit has been reached.',generic:'Could not connect. Please try again.',saved:'Vote saved. You can change your choice.',submit:'Send vote',change:'Change vote',sending:'Sending…',results:'Results are not available yet.',total:n=>`${n} votes`,expiry:d=>`Expires: ${d}` }
};
const words = () => messages[state?.locale ?? 'vi'];
function showError(code) {
  el('error').textContent = (code === 'closed' ? words().closedError : words()[code]) ?? words().generic;
  if (['expired','ended'].includes(code)) { stopped = true; el('status').textContent = el('error').textContent; el('poll').hidden = true; el('results').hidden = true; el('host-actions').hidden = true; }
}
async function api(path, data) {
  const response = await fetch(path, { method:data ? 'POST':'GET', headers:{ ...(data ? {'content-type':'application/json'} : {}), ...(hostToken ? {authorization:`Bearer ${hostToken}`} : {}) }, ...(data ? {body:JSON.stringify(data)} : {}), cache:'no-store', signal:AbortSignal.timeout(8000) });
  const body = await response.json();
  if (!response.ok) { showError(body.code); return null; }
  return body;
}
function render(next) {
  const first = !state; state = next;
  document.documentElement.lang = next.locale; document.documentElement.dataset.theme = next.theme;
  document.title = `${next.title} · MinintApp`;
  for (const [id,key] of [['title','title'],['description','description'],['block-title','blockTitle'],['note','note'],['question','question'],['results-title','resultsTitle']]) el(id).textContent = next[key] ?? '';
  el('status').textContent = words()[next.status];
  el('expiry').textContent = words().expiry(new Date(next.expiresAt).toLocaleString(next.locale));
  el('poll').hidden = false; el('name-field').hidden = !next.requireName; el('display-name').required = next.requireName;
  if (first) {
    el('display-name').value = next.myDisplayName ?? '';
    el('options').replaceChildren(...next.options.map(option => {
      const label = document.createElement('label'); label.className = 'option';
      const input = document.createElement('input'); input.type = 'radio'; input.name = 'option'; input.value = option.id; input.required = true; input.checked = next.myOptionId === option.id;
      const text = document.createElement('span'); text.textContent = option.label; label.append(input,text); return label;
    }));
    if (next.locale === 'en') {
      document.querySelector('.eyebrow').textContent = 'One choice. Decide together.';
      el('name-field').firstChild.textContent = 'Display name';
      document.querySelector('footer').textContent = 'MinintApp · For small decisions, together.';
      document.querySelector('.skip').textContent = 'Skip to content';
    }
  }
  document.querySelectorAll('#options input').forEach(input => { input.disabled = busy || next.status !== 'open'; });
  el('display-name').disabled = busy || next.status !== 'open';
  el('submit').disabled = busy || next.status !== 'open';
  el('submit').textContent = busy ? words().sending : next.myOptionId ? words().change : words().submit;
  el('results').hidden = !next.results; el('hidden-results').hidden = !!next.results; el('hidden-results').textContent = words().results;
  if (next.results) {
    el('total').textContent = words().total(next.results.total);
    el('bars').replaceChildren(...next.options.map(option => {
      const li=document.createElement('li'), label=document.createElement('span'), meter=document.createElement('meter');
      const count=next.results.counts[option.id] ?? 0;
      label.textContent=`${option.label}: ${count}`; meter.min=0; meter.max=Math.max(next.results.total,1); meter.value=count; meter.setAttribute('aria-label',label.textContent); li.append(label,meter); return li;
    }));
  }
}
async function refresh() {
  if (refreshing || busy || stopped || document.hidden) return;
  refreshing=true;
  try { const next=await api('/api/state'); if(next && !busy && !stopped) render(next); } catch { showError('generic'); } finally { refreshing=false; }
}
el('vote').addEventListener('submit',async event => {
  event.preventDefault(); if(busy || !state || state.status !== 'open') return;
  const optionId = new FormData(el('vote')).get('option'); if(!optionId) return;
  busy=true; render(state); el('error').textContent=''; el('message').textContent='';
  try { const next=await api('/api/votes',{optionId,...(state.requireName ? {displayName:el('display-name').value.trim()} : {})}); if(next){render(next);el('message').textContent=words().saved;} } catch {showError('generic');} finally {busy=false;if(!stopped)render(state);}
});
el('host-login').addEventListener('submit',async event => {
  event.preventDefault(); hostToken=el('host-token').value.trim(); el('error').textContent='';
  try {const next=await api('/api/state'); if(next){el('host-login').hidden=true;el('host-actions').hidden=false;el('host-token').value='';render(next);}else hostToken='';}catch{hostToken='';showError('generic');}
});
el('end-request').addEventListener('click',()=>{el('end-confirm').hidden=false;});
el('end-cancel').addEventListener('click',()=>{el('end-confirm').hidden=true;});
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click',async()=>{
  if(busy)return; busy=true;document.querySelectorAll('[data-action]').forEach(b=>{b.disabled=true;});el('error').textContent='';
  try{const next=await api('/api/host',{action:button.dataset.action});if(next?.status==='ended')showError('ended');else if(next)render(next);}catch{showError('generic');}finally{busy=false;if(state && !stopped)render(state);document.querySelectorAll('[data-action]').forEach(b=>{b.disabled=false;});}
}));
refresh();
setInterval(refresh,1500);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
