const DEFAULT={teams:Array.from({length:8},(_,i)=>({name:`${i<4?'IDP':'IME'} TEAM ${String.fromCharCode(65+i%4)}`,side:i<4?'idp':'ime',players:Array.from({length:5},()=>'')})),scores:{},winners:{},live:{idp:'',ime:''},banned:[]};
const KEY='mapendos-v8-pages';
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const teamLabel=i=>`${i<4?'IDP':'IME'} TEAM ${String.fromCharCode(65+i%4)}`;
function normalize(raw){
  const d=clone(DEFAULT),x=raw&&typeof raw==='object'?raw:d;
  let teams=Array.from({length:8},(_,i)=>({
    name:x.teams?.[i]?.name??d.teams[i].name,
    side:i<4?'idp':'ime',
    players:Array.from({length:5},(_,p)=>x.teams?.[i]?.players?.[p]??'')
  }));
  return {teams,scores:x.scores||{},winners:x.winners||{},live:{...d.live,...(x.live||{})},banned:Array.isArray(x.banned)?x.banned.filter(p=>Array.isArray(p)&&p.length===2):[]};
}
let state;try{state=normalize(JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('mapendos-v7-pages')))}catch{state=clone(DEFAULT)}
if(!state||!Array.isArray(state.teams))state=clone(DEFAULT);
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const winner=(k,a,b)=>{const w=state.winners[k];return w===a||w===b?w:'TBD'};
const loser=(k,a,b)=>{const w=state.winners[k];return !w?'TBD':w===a?b:a};
function matches(){
  const t=state.teams.map(x=>x.name||'TBD');
  const q=[['q1','QUARTER FINAL 01',t[0],t[4]],['q2','QUARTER FINAL 02',t[1],t[5]],['q3','QUARTER FINAL 03',t[2],t[6]],['q4','QUARTER FINAL 04',t[3],t[7]]];
  const s=[['s1','SEMI FINAL 01',winner('q1',t[0],t[4]),winner('q2',t[1],t[5])],['s2','SEMI FINAL 02',winner('q3',t[2],t[6]),winner('q4',t[3],t[7])]];
  const gf=['gf','GRAND FINAL',winner('s1',s[0][2],s[0][3]),winner('s2',s[1][2],s[1][3])];
  const third=['third','3RD PLACE',loser('s1',s[0][2],s[0][3]),loser('s2',s[1][2],s[1][3])];
  return [...q,...s,gf,third]
}
function refCard(m){const[k,label,a,b]=m,s=state.scores[k]||[];const side=x=>state.teams.find(t=>t.name===x)?.side||'';return `<div class="match-card-ref"><div class="team-row ${side(a)} ${a==='TBD'?'tbd':''} ${state.winners[k]===a?'winner':''}"><span>${esc(a)}</span><b>${s[0]??''}</b></div><div class="team-row ${side(b)} ${b==='TBD'?'tbd':''} ${state.winners[k]===b?'winner':''}"><span>${esc(b)}</span><b>${s[1]??''}</b></div></div>`}
function renderBracket(){const ms=matches();document.querySelectorAll('[data-match]').forEach(el=>{const m=ms.find(x=>x[0]===el.dataset.match);if(m)el.innerHTML=refCard(m)});const gf=ms.find(m=>m[0]==='gf'),third=ms.find(m=>m[0]==='third');if(!gf)return;const c=winner('gf',gf[2],gf[3]);const runner=loser('gf',gf[2],gf[3]);const p3=winner('third',third[2],third[3]);const p4=loser('third',third[2],third[3]);const champ=document.querySelector('#championName');if(champ)champ.textContent=c;const standings=document.querySelector('#standings');if(standings)standings.innerHTML=[['JUARA 1',c,'7.000.000'],['JUARA 2',runner,'4.000.000'],['JUARA 3',p3,'2.500.000'],['JUARA 4',p4,'1.500.000']].map(x=>`<div><span>${x[0]}</span><b>${esc(x[1])}</b><small>${x[2]}</small></div>`).join('')}
function renderRoster(){const el=document.querySelector('#rosterGrid');if(!el)return;el.innerHTML=state.teams.map((t,i)=>`<article class="roster-card ${t.side}"><div class="roster-head"><div class="mini-crest ${t.side}">${String.fromCharCode(65+i%4)}</div><div><span>MAPENDOS ${t.side.toUpperCase()} · TEAM ${String.fromCharCode(65+i%4)}</span><h3>${esc(t.name)}</h3></div></div><div class="players">${t.players.map((p,j)=>`<div><span class="num">0${j+1}</span><b>${esc(p||'TBD')}</b></div>`).join('')}</div></article>`).join('')}
function renderAdminTeams(){
  const el=document.querySelector('#adminTeams');if(!el)return;
  const all=state.teams.map((t,i)=>`<article class="admin-team ${t.side}"><div class="admin-team-top"><b>${teamLabel(i)}</b><span class="team-status">${t.players.filter(Boolean).length}/5 PLAYERS</span></div><div class="admin-team-player-list">${t.players.map((p,j)=>`<div class="admin-player"><span>0${j+1}</span><b>${esc(p||'TBD')}</b></div>`).join('')}</div></article>`).join('');
  el.innerHTML=all;
  updateRosterPoolSummary();
}
function getPool(){const idp=[],ime=[];state.teams.forEach(t=>(t.side==='idp'?idp:ime).push(...t.players.filter(p=>p&&p!=='TBD')));return {idp,ime}}
function updateRosterPoolSummary(){const s=getPool();const el=document.querySelector('#rosterPoolSummary');if(el)el.innerHTML=`<div><span>IDP PARTICIPANTS</span><b>${s.idp.length}</b><small>/ 20</small></div><div><span>IME PARTICIPANTS</span><b>${s.ime.length}</b><small>/ 20</small></div><div><span>FORMAT</span><b>5</b><small> PLAYERS / TEAM</small></div>`}
function renderParticipantList(){const el=document.querySelector('#participantList');if(!el)return;const s=getPool();const rows=[...s.idp.map((p,i)=>({p,side:'IDP',i})),...s.ime.map((p,i)=>({p,side:'IME',i}))];el.innerHTML=rows.length?rows.map((x,i)=>`<div class="participant-row"><span class="participant-no">${String(i+1).padStart(2,'0')}</span><b>${esc(x.p)}</b><em class="${x.side.toLowerCase()}">${x.side}</em><button type="button" data-remove-player="${x.side}:${x.i}" aria-label="Hapus">×</button></div>`).join(''):`<div class="empty-participants">Belum ada peserta.</div>`}
function openRosterModal(){document.querySelector('#rosterModal')?.classList.add('show');renderParticipantList();document.querySelector('#rosterName')?.focus()}
function closeRosterModal(){document.querySelector('#rosterModal')?.classList.remove('show')}
function isBanned(a,b){return state.banned.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a))}
function distributeToTeams(names){
  const teams=[[],[],[],[]];let conflict=false;
  names.forEach(name=>{
    const order=[0,1,2,3].sort((x,y)=>teams[x].length-teams[y].length);
    let placed=false;
    for(const idx of order){if(teams[idx].length<5&&!teams[idx].some(other=>isBanned(name,other))){teams[idx].push(name);placed=true;break}}
    if(!placed){for(const idx of order){if(teams[idx].length<5){teams[idx].push(name);placed=true;conflict=true;break}}}
  });
  return {teams:teams.map(t=>Array.from({length:5},(_,j)=>t[j]||'')),conflict};
}
function applyDistribution(idpPool,imePool){
  const idpRes=distributeToTeams(idpPool),imeRes=distributeToTeams(imePool);
  for(let team=0;team<4;team++){state.teams[team].players=idpRes.teams[team];state.teams[team+4].players=imeRes.teams[team]}
  return idpRes.conflict||imeRes.conflict;
}
function addParticipants(names,side){
  const clean=names.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);
  if(!clean.length)return 0;
  const s=getPool();const pool=side==='idp'?s.idp:s.ime;let added=0;
  clean.forEach(name=>{if(pool.length<20&&!pool.includes(name)){pool.push(name);added++}});
  const idp=side==='idp'?pool:s.idp,ime=side==='ime'?pool:s.ime;
  applyDistribution(idp,ime);
  save();renderAll();renderParticipantList();renderBannedOptions();return added;
}
function removeParticipant(side,index){
  const f=String(side).toLowerCase();
  const s=getPool(),arr=f==='idp'?s.idp:s.ime;arr.splice(+index,1);
  applyDistribution(f==='idp'?arr:s.idp,f==='ime'?arr:s.ime);
  save();renderAll();renderParticipantList();renderBannedOptions();
}
function shuffleArray(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
function shufflePlayers(){
  const {idp,ime}=getPool();
  if(idp.length!==20||ime.length!==20){alert(`Kocok membutuhkan tepat 20 peserta IDP dan 20 peserta IME (masing-masing 4 team × 5 player). Saat ini IDP ${idp.length}/20, IME ${ime.length}/20.`);return}
  shuffleArray(idp);shuffleArray(ime);
  const conflict=applyDistribution(idp,ime);
  state.winners={};state.scores={};save();renderAll();renderParticipantList();
  const note=document.querySelector('#shuffleNote');if(note){note.textContent=conflict?'Peserta dikocok, namun ada pasangan banned yang terpaksa satu team karena keterbatasan slot.':'Peserta berhasil dikocok. IDP tetap bersama IDP, IME tetap bersama IME, pasangan banned dihindari.';note.classList.toggle('success',!conflict);note.classList.toggle('warn',conflict)}
}
function renderResults(){const el=document.querySelector('#resultGrid');if(!el)return;el.innerHTML=matches().map(m=>{const[k,label,a,b]=m,s=state.scores[k]||[];return `<article class="result-card"><header><div><small>${label}</small><h4>${esc(a)} <i>VS</i> ${esc(b)}</h4></div><span>${state.winners[k]?'COMPLETED':'PENDING'}</span></header><div class="score-inputs"><label>${esc(a)}<input type="number" min="0" data-score="${k}:0" value="${s[0]??''}" ${a==='TBD'?'disabled':''}></label><strong>:</strong><label>${esc(b)}<input type="number" min="0" data-score="${k}:1" value="${s[1]??''}" ${b==='TBD'?'disabled':''}></label></div><div class="winner-buttons"><button data-win="${k}" data-team="${esc(a)}" ${a==='TBD'?'disabled':''}>${state.winners[k]===a?'✓ ':''}${esc(a)}</button><button data-win="${k}" data-team="${esc(b)}" ${b==='TBD'?'disabled':''}>${state.winners[k]===b?'✓ ':''}${esc(b)}</button></div></article>`}).join('');bindResults()}
function renderStats(){const el=document.querySelector('#adminStats');if(!el)return;const played=Object.keys(state.winners).length,ms=matches(),gf=ms.find(m=>m[0]==='gf');el.innerHTML=`<div><span>IDP TEAMS</span><b>04</b></div><div><span>IME TEAMS</span><b>04</b></div><div><span>MATCHES PLAYED</span><b>${played}<small>/ 8</small></b></div><div><span>CHAMPION</span><b>${esc(winner('gf',gf[2],gf[3]))}</b></div>`}
function invalidate(k){const deps={q1:['s1','gf','third'],q2:['s1','gf','third'],q3:['s2','gf','third'],q4:['s2','gf','third'],s1:['gf','third'],s2:['gf','third'],gf:[],third:[]};(deps[k]||[]).forEach(d=>{delete state.winners[d];delete state.scores[d]})}
function bindResults(){document.querySelectorAll('[data-win]').forEach(b=>b.onclick=()=>{const k=b.dataset.win,t=b.dataset.team;if(t==='TBD')return;state.winners[k]=state.winners[k]===t?'':t;invalidate(k);save();renderAll()});document.querySelectorAll('[data-score]').forEach(i=>i.onchange=()=>{const[k,n]=i.dataset.score.split(':');const v=i.value===''?'':Math.max(0,+i.value);state.scores[k]=state.scores[k]||['',''];state.scores[k][+n]=v;if(state.scores[k][0]!==''&&state.scores[k][1]!==''&&state.scores[k][0]!==state.scores[k][1]){const m=matches().find(x=>x[0]===k);state.winners[k]=state.scores[k][0]>state.scores[k][1]?m[2]:m[3];invalidate(k)}save();renderAll()})}
function bindAdminTeamInputs(){/* roster is managed from the single modal */}
function renderLive(){const idp=document.querySelector('#idpThumb'),ime=document.querySelector('#imeThumb');if(idp)idp.onclick=()=>state.live.idp&&window.open(state.live.idp,'_blank');if(ime)ime.onclick=()=>state.live.ime&&window.open(state.live.ime,'_blank');const a=document.querySelector('#admin-live-idp'),b=document.querySelector('#admin-live-ime');if(a)a.value=state.live.idp;if(b)b.value=state.live.ime}
function renderBannedOptions(){
  const a=document.querySelector('#bannedPlayerA'),b=document.querySelector('#bannedPlayerB');if(!a||!b)return;
  const s=getPool();const list=[...s.idp.map(n=>({n,f:'IDP'})),...s.ime.map(n=>({n,f:'IME'}))];
  const opts=list.map(x=>`<option value="${esc(x.n)}">${esc(x.n)} (${x.f})</option>`).join('');
  const keepA=a.value,keepB=b.value;
  a.innerHTML=`<option value="">PILIH PLAYER A</option>${opts}`;
  b.innerHTML=`<option value="">PILIH PLAYER B</option>${opts}`;
  if(list.some(x=>x.n===keepA))a.value=keepA;
  if(list.some(x=>x.n===keepB))b.value=keepB;
}
function renderBannedList(){
  const el=document.querySelector('#bannedList');if(!el)return;
  el.innerHTML=state.banned.length?state.banned.map((pair,i)=>`<div class="banned-row"><b>${esc(pair[0])}</b><span>✕</span><b>${esc(pair[1])}</b><button type="button" data-remove-banned="${i}" aria-label="Hapus">×</button></div>`).join(''):`<div class="empty-participants">Belum ada pasangan banned.</div>`;
}
function addBannedPair(a,b){
  if(!a||!b||a===b)return false;
  if(isBanned(a,b))return false;
  state.banned.push([a,b]);
  const s=getPool();applyDistribution(s.idp,s.ime);
  save();renderAll();renderBannedList();renderBannedOptions();return true;
}
function removeBannedPair(index){
  state.banned.splice(+index,1);
  const s=getPool();applyDistribution(s.idp,s.ime);
  save();renderAll();renderBannedList();renderBannedOptions();
}
function setupBannedSystem(){
  document.querySelector('#addBanned')?.addEventListener('click',()=>{
    const a=document.querySelector('#bannedPlayerA')?.value,b=document.querySelector('#bannedPlayerB')?.value;
    if(!a||!b||a===b){alert('Pilih dua peserta yang berbeda.');return}
    if(!addBannedPair(a,b))alert('Pasangan ini sudah ada di banned system.');
    else{const sa=document.querySelector('#bannedPlayerA'),sb=document.querySelector('#bannedPlayerB');if(sa)sa.value='';if(sb)sb.value=''}
  });
  document.querySelector('#bannedList')?.addEventListener('click',e=>{const btn=e.target.closest('[data-remove-banned]');if(!btn)return;removeBannedPair(btn.dataset.removeBanned)});
}
function renderAll(){renderBracket();renderRoster();renderAdminTeams();renderResults();renderStats();renderLive();renderBannedOptions();renderBannedList()}
function setupNav(){const nav=document.querySelector('#mainNav'),menu=document.querySelector('#menu');if(menu&&nav)menu.onclick=()=>nav.classList.toggle('open');document.querySelectorAll('#mainNav a').forEach(a=>a.onclick=()=>nav?.classList.remove('open'))}
function setupRosterModal(){
  const modal=document.querySelector('#rosterModal');if(!modal)return;
  document.querySelector('#openRosterModal')?.addEventListener('click',openRosterModal);
  document.querySelector('#closeRosterModal')?.addEventListener('click',closeRosterModal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeRosterModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeRosterModal()});
  document.querySelector('#addRoster')?.addEventListener('click',()=>{const n=document.querySelector('#rosterName')?.value.trim();const side=document.querySelector('#rosterFaction')?.value||'idp';if(!n)return;const added=addParticipants(n,side);if(added)document.querySelector('#rosterName').value='';else alert('Peserta tidak ditambahkan. Pastikan jumlah faction belum mencapai 20 dan nama tidak duplikat.')});
  document.querySelector('#bulkRoster')?.addEventListener('click',()=>{const ta=document.querySelector('#rosterBulkText');const side=document.querySelector('#rosterBulkFaction')?.value||'idp';if(!ta?.value.trim())return;const added=addParticipants(ta.value,side);ta.value='';alert(`${added} peserta ditambahkan ke ${side.toUpperCase()}.`)});
  document.querySelector('#shufflePlayers')?.addEventListener('click',shufflePlayers);
  document.querySelector('#participantList')?.addEventListener('click',e=>{const b=e.target.closest('[data-remove-player]');if(!b)return;const [side,index]=b.dataset.removePlayer.split(':');if(confirm(`Hapus peserta ${side}?`))removeParticipant(side,index)});
}
function setupAdmin(){
  document.querySelectorAll('.admin-sidebar nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.admin-sidebar nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.admin-view').forEach(v=>v.classList.toggle('active',v.dataset.view===b.dataset.tab))});
  document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>document.querySelector(`.admin-sidebar nav button[data-tab="${b.dataset.jump}"]`)?.click());
  const clear=document.querySelector('#clearResults');if(clear)clear.onclick=()=>{state.winners={};state.scores={};save();renderAll()};
  const saveAdmin=document.querySelector('#saveAdmin');if(saveAdmin)saveAdmin.onclick=()=>save();
  const saveLive=document.querySelector('#saveLive');if(saveLive)saveLive.onclick=()=>{state.live.idp=document.querySelector('#admin-live-idp')?.value||'';state.live.ime=document.querySelector('#admin-live-ime')?.value||'';save();renderLive()};
  const exp=document.querySelector('#exportData');if(exp)exp.onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='mapendos-backup.json';a.click()};
  const imp=document.querySelector('#importData');if(imp)imp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=normalize(JSON.parse(r.result));save();renderAll();renderParticipantList()}catch{alert('JSON tidak valid')}};r.readAsText(f)};
  const reset=document.querySelector('#resetAdmin');if(reset)reset.onclick=()=>{if(confirm('Reset semua data?')){state=clone(DEFAULT);save();renderAll();renderParticipantList()}}
}
setupNav();setupRosterModal();setupAdmin();setupBannedSystem();renderAll();renderParticipantList();
