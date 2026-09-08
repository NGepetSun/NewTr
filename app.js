const TEAM_COUNT=16;
const DEFAULT={teams:Array.from({length:TEAM_COUNT},(_,i)=>({name:`MPD ${String.fromCharCode(65+i)}`,side:'mixed',players:[]})),scores:{},winners:{},live:{idp:'',ime:''},banned:[]};
const KEY='mapendos-v9-pages';
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const teamLabel=i=>`MPD ${String.fromCharCode(65+i)}`;
function normalize(raw){
  const d=clone(DEFAULT),x=raw&&typeof raw==='object'?raw:d;
  const source=Array.isArray(x.teams)?x.teams:[];
  const teamCount=TEAM_COUNT;
  let teams=Array.from({length:teamCount},(_,i)=>({
    name:`MPD ${String.fromCharCode(65+i)}`,
    side:'mixed',
    players:Array.isArray(source[i]?.players)?source[i].players.map(v=>{
      if(v&&typeof v==='object')return {name:v.name??'',side:v.side??''};
      return {name:v??'',side:i<4?'idp':i<8?'ime':''};
    }):[]
  }));
  return {teams,scores:x.scores||{},winners:x.winners||{},live:{...d.live,...(x.live||{})},banned:Array.isArray(x.banned)?x.banned.filter(p=>Array.isArray(p)&&p.length===2):[]};
}
let state;try{state=normalize(JSON.parse(localStorage.getItem(KEY)||'null'))}catch{state=clone(DEFAULT)}
if(!state||!Array.isArray(state.teams))state=clone(DEFAULT);
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const winner=(k,a,b)=>{
  const w=state.winners[k];
  if(w===a||w===b)return w;
  if(a==='TBD'&&b!=='TBD')return b;
  if(b==='TBD'&&a!=='TBD')return a;
  return 'TBD';
};
const loser=(k,a,b)=>{const w=state.winners[k];return !w?'TBD':w===a?b:a};
function matches(){
  const t=state.teams.map(x=>x.name||'TBD');
  const n=t.length, size=2**Math.ceil(Math.log2(Math.max(2,n)));
  const slots=[...t,...Array(size-n).fill('TBD')];
  const rounds=[];
  let prev=slots;
  let roundNo=1;
  while(prev.length>1){
    const cur=[];
    for(let i=0;i<prev.length;i+=2){
      const id=`r${roundNo}m${i/2+1}`;
      cur.push([id,`ROUND ${roundNo}`,prev[i],prev[i+1]]);
    }
    rounds.push(cur);
    prev=cur.map(m=>winner(m[0],m[2],m[3]));
    roundNo++;
  }
  const all=rounds.flat();
  const final=rounds[rounds.length-1]?.[0];
  // Preserve the existing prize layout: 3rd-place match between semifinal losers when possible.
  if(rounds.length>=2){
    const semis=rounds[rounds.length-2];
    if(semis.length===2){
      all.push(['third','3RD PLACE',loser(semis[0][0],semis[0][2],semis[0][3]),loser(semis[1][0],semis[1][2],semis[1][3])]);
    }
  }
  return all;
}
function refCard(m,interactive=false){
  const[k,label,a,b]=m,s=state.scores[k]||[];
  const row=(name,n)=>`<div class="team-row ${name==='TBD'?'tbd':''} ${state.winners[k]===name?'winner':''}" ${interactive&&name!=='TBD'?`data-result-win="${esc(k)}" data-result-team="${esc(name)}"`:''}><span>${esc(name)}</span><b>${s[n]??''}</b></div>`;
  return `<div class="match-card-ref" data-result-match="${esc(k)}">${row(a,0)}${row(b,1)}</div>`;
}
function renderBracket(){
  const ms=matches(),board=document.querySelector('.bracket-reference-board');
  if(board){
    const rounds={};
    ms.filter(m=>m[0]!=='third').forEach(m=>{const r=m[0].match(/^r(\d+)/)?.[1]||'1';(rounds[r]??=[]).push(m)});
    const labels=['ROUND OF 16','QUARTER FINAL','SEMI FINAL','GRAND FINAL'];
    board.innerHTML=Object.keys(rounds).map((r,idx)=>`<div class="bracket-round round-${idx===0?'q':idx===Object.keys(rounds).length-1?'g':'s'}"><div class="col-title">${rounds[r].length===1?'GRAND FINAL':rounds[r].length===2?'SEMI FINAL':labels[Math.min(idx,labels.length-1)]}</div>${rounds[r].map(m=>`<div class="match-slot" data-match="${m[0]}"></div>`).join('')}</div>`).join('')+`<div class="bracket-lines-ref" aria-hidden="true"></div>`;
    const third=ms.find(m=>m[0]==='third'); if(third)board.insertAdjacentHTML('beforeend',`<div class="bracket-third-result">${refCard(third)}</div>`);
  }
  document.querySelectorAll('[data-match]').forEach(el=>{const m=ms.find(x=>x[0]===el.dataset.match);if(m)el.innerHTML=refCard(m)});
  const final=ms.filter(m=>m[0]!=='third').at(-1),third=ms.find(m=>m[0]==='third');
  if(!final)return;
  const c=winner(final[0],final[2],final[3]),runner=loser(final[0],final[2],final[3]);
  const p3=third?winner('third',third[2],third[3]):'TBD',p4=third?loser('third',third[2],third[3]):'TBD';
  const champ=document.querySelector('#championName');if(champ)champ.textContent=c;
  const standings=document.querySelector('#standings');if(standings)standings.innerHTML=[['JUARA 1',c,'7.000.000'],['JUARA 2',runner,'4.000.000'],['JUARA 3',p3,'2.500.000'],['JUARA 4',p4,'1.500.000']].map(x=>`<div><span>${x[0]}</span><b>${esc(x[1])}</b><small>${x[2]}</small></div>`).join('');
}
function renderRoster(){const el=document.querySelector('#rosterGrid');if(!el)return;const count=document.querySelector('.roster-count');if(count)count.textContent=`${TEAM_COUNT} TEAMS · MAX 5 PLAYERS / TEAM`;el.innerHTML=state.teams.map((t,i)=>`<article class="roster-card ${t.side}"><div class="roster-head"><div class="mini-crest ${t.side}">${String.fromCharCode(65+i%4)}</div><div><span>MAPENDOS · ${teamLabel(i)}</span><h3>${esc(t.name)}</h3></div></div><div class="players">${t.players.map((p,j)=>{const n=typeof p==='object'?p.name:p;const f=typeof p==='object'?p.side:'';return `<div><span class="num">0${j+1}</span><b>${esc(n||'TBD')}</b><em class="${f}">${f?f.toUpperCase():''}</em></div>`}).join('')}</div></article>`).join('')}
function renderAdminTeams(){
  const el=document.querySelector('#adminTeams');if(!el)return;
  el.innerHTML=state.teams.map((t,i)=>{
    const players=t.players||[];
    return `<article class="admin-team mixed"><div class="admin-team-top"><b>${teamLabel(i)}</b><span class="team-status">${players.filter(p=>p&&p.name).length}/5 PLAYERS</span></div><div class="admin-team-player-list">${players.map((p,j)=>`<div class="admin-player"><span>0${j+1}</span><b>${esc(p?.name||p||'TBD')}</b><em class="${p?.side||''}">${p?.side?p.side.toUpperCase():''}</em></div>`).join('')}</div></article>`;
  }).join('');
  updateRosterPoolSummary();
}
function getPool(){
  const idp=[],ime=[];
  state.teams.forEach(t=>(t.players||[]).forEach(p=>{
    const name=typeof p==='object'?p.name:p;
    const side=typeof p==='object'?p.side:'';
    if(!name||name==='TBD')return;
    if(side==='idp')idp.push(name); else if(side==='ime')ime.push(name);
  }));
  return {idp,ime};
}
function updateRosterPoolSummary(){const s=getPool();const el=document.querySelector('#rosterPoolSummary');if(el)el.innerHTML=`<div><span>IDP PARTICIPANTS</span><b>${s.idp.length}</b><small> TOTAL</small></div><div><span>IME PARTICIPANTS</span><b>${s.ime.length}</b><small> TOTAL</small></div><div><span>FORMAT</span><b>5</b><small> PLAYERS / TEAM</small></div>`}
function renderParticipantList(){const el=document.querySelector('#participantList');if(!el)return;const s=getPool();const rows=[...s.idp.map((p,i)=>({p,side:'IDP',i})),...s.ime.map((p,i)=>({p,side:'IME',i}))];el.innerHTML=rows.length?rows.map((x,i)=>`<div class="participant-row"><span class="participant-no">${String(i+1).padStart(2,'0')}</span><b>${esc(x.p)}</b><em class="${x.side.toLowerCase()}">${x.side}</em><button type="button" data-remove-player="${x.side}:${x.i}" aria-label="Hapus">×</button></div>`).join(''):`<div class="empty-participants">Belum ada peserta.</div>`}
function openRosterModal(){document.querySelector('#rosterModal')?.classList.add('show');renderParticipantList();document.querySelector('#rosterName')?.focus()}
function closeRosterModal(){document.querySelector('#rosterModal')?.classList.remove('show')}
function isBanned(a,b){return state.banned.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a))}
function distributeToTeams(idpPool,imePool){
  const total=idpPool.length+imePool.length;
  const teamCount=Math.ceil(total/5);
  const teams=Array.from({length:teamCount},()=>[]);
  const A=shuffleArray([...idpPool]),B=shuffleArray([...imePool]);
  // Proportional composition: e.g. 60/40 over 5 slots => 3 IDP + 2 IME per team.
  const ratio=idpPool.length/Math.max(1,total);
  let ai=0,bi=0,conflict=false;
  for(let i=0;i<teamCount;i++){
    const remainingTeams=teamCount-i,remainingSlots=teams.reduce((s,t)=>s+(5-t.length),0);
    let size=i===teamCount-1?Math.min(5,total-i*5):5;
    let wantIdp=Math.round(size*ratio);
    wantIdp=Math.max(0,Math.min(size,wantIdp));
    wantIdp=Math.min(wantIdp,A.length-ai);
    let wantIme=size-wantIdp;
    if(wantIme>B.length-bi){wantIme=B.length-bi;wantIdp=size-wantIme;}
    if(wantIdp>A.length-ai){wantIdp=A.length-ai;}
    let names=[...A.slice(ai,ai+wantIdp).map(name=>({name,side:'idp'})),...B.slice(bi,bi+wantIme).map(name=>({name,side:'ime'}))];
    ai+=wantIdp;bi+=wantIme;
    for(let tries=0;tries<100;tries++){
      const bad=names.some((p,j)=>names.some((q,k)=>j<k&&isBanned(p.name,q.name)));
      if(!bad)break;
      shuffleArray(names);
      if(tries===99)conflict=true;
    }
    teams[i]=names;
  }
  return {teams,conflict};
}
function applyDistribution(idpPool,imePool){
  const res=distributeToTeams(idpPool,imePool);
  state.teams=Array.from({length:TEAM_COUNT},(_,i)=>({name:teamLabel(i),side:'mixed',players:res.teams[i]||[]}));
  return res.conflict;
}
function addParticipants(names,side){
  const clean=names.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);
  if(!clean.length)return 0;
  const s=getPool();const pool=side==='idp'?s.idp:s.ime;let added=0;
  clean.forEach(name=>{if(!pool.includes(name)){pool.push(name);added++}});
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
  const total=idp.length+ime.length;
  if(total<5||idp.length===0||ime.length===0){
    alert('Kocok membutuhkan minimal 5 peserta dan roster IDP + IME harus sama-sama terisi.');return;
  }
  const conflict=applyDistribution(idp,ime);
  state.winners={};state.scores={};save();renderAll();renderParticipantList();
  const note=document.querySelector('#shuffleNote');
  if(note){
    const idpPer=Math.round(5*idp.length/total),imePer=5-idpPer;
    note.textContent=conflict
      ? `Shuffle selesai. Komposisi mengikuti rasio roster (sekitar ${idpPer} IDP + ${imePer} IME / team), tetapi ada pasangan banned yang terpaksa bertemu.`
      : `Shuffle selesai. Komposisi mengikuti rasio roster: ${idp.length}/${total} IDP dan ${ime.length}/${total} IME. Contoh rasio 60/40 = 3 IDP + 2 IME / team.`;
    note.classList.toggle('success',!conflict);note.classList.toggle('warn',conflict);
  }
}
function renderResults(){
  const el=document.querySelector('#resultGrid');if(!el)return;
  const ms=matches();
  const rounds={};
  ms.filter(m=>m[0]!=='third').forEach(m=>{const r=m[0].match(/^r(\d+)/)?.[1]||'1';(rounds[r]??=[]).push(m)});
  const roundKeys=Object.keys(rounds).sort((a,b)=>+a-+b);
  el.className='result-grid result-bracket';
  el.innerHTML=`<div class="bracket-reference-board admin-result-board">
    ${roundKeys.map((r,idx)=>`<div class="bracket-round round-${idx===0?'q':idx===roundKeys.length-1?'g':'s'}"><div class="col-title">${idx===roundKeys.length-1?'GRAND FINAL':idx===roundKeys.length-2?'SEMI FINAL':idx===roundKeys.length-3?'QUARTER FINAL':'ROUND OF 16'}</div>${rounds[r].map(m=>`<div class="match-slot">${refCard(m,true)}</div>`).join('')}</div>`).join('')}
    <div class="bracket-lines-ref" aria-hidden="true"></div>
  </div>`;
  el.querySelectorAll('[data-result-win]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.resultWin,t=b.dataset.resultTeam;if(!t||t==='TBD')return;
    state.winners[k]=state.winners[k]===t?'':t;invalidate(k);save();renderAll();
  });
}

function renderStats(){const el=document.querySelector('#adminStats');if(!el)return;const played=Object.keys(state.winners).length,ms=matches(),gf=ms.find(m=>m[0]==='r4m1');const pools=getPool();const champion=gf?winner(gf[0],gf[2],gf[3]):'TBD';el.innerHTML=`<div><span>IDP PARTICIPANTS</span><b>${pools.idp.length}</b></div><div><span>IME PARTICIPANTS</span><b>${pools.ime.length}</b></div><div><span>TEAMS</span><b>${state.teams.length}</b></div><div><span>MATCHES PLAYED</span><b>${played}</b></div><div><span>CHAMPION</span><b>${esc(champion)}</b></div>`}
function invalidate(k){
  const ms=matches(),idx=ms.findIndex(m=>m[0]===k);
  if(idx<0)return;
  // Any later match may depend on this winner; clear everything after it.
  ms.slice(idx+1).forEach(m=>{delete state.winners[m[0]];delete state.scores[m[0]]});
}
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
