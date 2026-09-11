const TEAM_COUNT=16;
const DEFAULT={teams:Array.from({length:TEAM_COUNT},(_,i)=>({name:`MPD ${String.fromCharCode(65+i)}`,side:'mixed',players:[]})),scores:{},winners:{},live:{idp:'',ime:''},banned:[],killsRanking:{matchLabel:'ALL MATCHES',weekLabel:'WEEK 1',seasonLabel:'REGULAR SEASON',matches:[]}};
const KEY='mapendos-v9-pages';
const API_STATE='/api/state';
let remoteReady=false;
let remoteUpdatedAt=null;
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
  const kr=x.killsRanking&&typeof x.killsRanking==='object'?x.killsRanking:{};
  let matches=Array.isArray(kr.matches)?kr.matches.map(m=>({matchLabel:String(m?.matchLabel??'MATCH'),entries:Array.isArray(m?.entries)?m.entries.map(v=>({name:String(v?.name??''),kills:Math.max(0,Math.floor(Number(v?.kills)||0)),team:String(v?.team??''),side:String(v?.side??'')})).filter(v=>v.name).slice(0,5):[]})).filter(m=>m.entries.length||m.matchLabel):[];
  if(!matches.length&&Array.isArray(kr.entries)&&kr.entries.length)matches=[{matchLabel:String(kr.matchLabel??d.killsRanking.matchLabel),entries:kr.entries.map(v=>({name:String(v?.name??''),kills:Math.max(0,Math.floor(Number(v?.kills)||0)),team:String(v?.team??''),side:String(v?.side??'')})).filter(v=>v.name).slice(0,5)}];
  return {teams,scores:x.scores||{},winners:x.winners||{},live:{...d.live,...(x.live||{})},banned:(()=>{const b=Array.isArray(x.banned)?x.banned:[]; const flat=[]; b.forEach(v=>{if(Array.isArray(v)) v.forEach(n=>{if(n&&!flat.includes(n))flat.push(n)}); else if(typeof v==='string'&&v&&!flat.includes(v))flat.push(v)}); return flat})(),killsRanking:{matchLabel:String(kr.matchLabel??d.killsRanking.matchLabel),weekLabel:String(kr.weekLabel??d.killsRanking.weekLabel),seasonLabel:String(kr.seasonLabel??d.killsRanking.seasonLabel),matches}};
}
let state;try{state=normalize(JSON.parse(localStorage.getItem(KEY)||'null'))}catch{state=clone(DEFAULT)}
if(!state||!Array.isArray(state.teams))state=clone(DEFAULT);
const getAdminPassword=()=>sessionStorage.getItem('mapendos-admin-password')||'';
const save=async()=>{
  localStorage.setItem(KEY,JSON.stringify(state));
  try {
    const headers={'Content-Type':'application/json'};
    const pw=getAdminPassword(); if(pw) headers['X-Admin-Password']=pw;
    const r=await fetch(API_STATE,{method:'POST',headers,body:JSON.stringify(state)});
    if(r.ok){ const data=await r.json(); remoteUpdatedAt=data.state?.updatedAt||new Date().toISOString(); remoteReady=true; }
  } catch(e) { console.warn('Remote save unavailable; local cache kept.',e); }
};
async function loadRemoteState(){
  try{
    const r=await fetch(API_STATE,{cache:'no-store'});
    if(!r.ok) throw new Error('API '+r.status);
    const data=await r.json();
    if(data&&Array.isArray(data.teams)){ state=normalize(data); localStorage.setItem(KEY,JSON.stringify(state)); remoteUpdatedAt=data.updatedAt||null; remoteReady=true; renderAll(); renderParticipantList(); }
  }catch(e){ console.warn('Using local state because remote database is unavailable.',e); }
}
async function syncRemoteState(){
  if(!remoteReady) return;
  try{
    const r=await fetch(API_STATE,{cache:'no-store'}); if(!r.ok)return;
    const data=await r.json();
    if(data?.updatedAt && data.updatedAt!==remoteUpdatedAt){ state=normalize(data); remoteUpdatedAt=data.updatedAt; localStorage.setItem(KEY,JSON.stringify(state)); renderAll(); renderParticipantList(); }
  }catch(e){}
}
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
function drawPremiumBracketLines(board){
  if(!board)return;
  const old=board.querySelector('.bracket-lines-ref');
  if(old)old.remove();
  const rounds=[...board.querySelectorAll('.bracket-round')];
  if(rounds.length<2)return;
  const br=board.getBoundingClientRect();
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.classList.add('bracket-lines-ref');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('width','100%'); svg.setAttribute('height','100%');
  svg.setAttribute('viewBox',`0 0 ${Math.max(1,br.width)} ${Math.max(1,br.height)}`);
  svg.innerHTML=`<defs>
    <filter id="bracketGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="bracketGold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7c5b16"/><stop offset=".5" stop-color="#f5d46a"/><stop offset="1" stop-color="#9b751e"/></linearGradient>
  </defs>`;
  const rel=r=>({x:r.left-br.left,y:r.top-br.top,w:r.width,h:r.height});
  const card=slot=>slot.querySelector('.match-card-ref')||slot;
  const path=(d,stroke,width=1.5,filter=false)=>{
    const q=document.createElementNS(svgNS,'path');
    q.setAttribute('d',d);q.setAttribute('fill','none');q.setAttribute('stroke',stroke);
    q.setAttribute('stroke-width',width);q.setAttribute('stroke-linecap','round');q.setAttribute('stroke-linejoin','round');q.setAttribute('vector-effect','non-scaling-stroke');
    if(filter)q.setAttribute('filter','url(#bracketGlow)');
    svg.appendChild(q);return q;
  };
  // Each connector uses a private vertical corridor between columns, preventing crossings.
  for(let i=0;i<rounds.length-1;i++){
    const from=[...rounds[i].querySelectorAll('.match-slot')];
    const to=[...rounds[i+1].querySelectorAll('.match-slot')];
    to.forEach((target,j)=>{
      const sources=from.slice(j*2,j*2+2).filter(Boolean);
      if(!sources.length)return;
      const tr=rel(card(target).getBoundingClientRect());
      const tx=tr.x,ty=tr.y+tr.h/2;
      const sr=sources.map(x=>rel(card(x).getBoundingClientRect()));
      const sx=Math.max(...sr.map(r=>r.x+r.w));
      const midX=sx+Math.max(24,(tx-sx)*0.5);
      const stroke=i===rounds.length-2?'url(#bracketGold)':'#777b86';
      const width=i===rounds.length-2?2:1.5;
      sr.forEach(r=>{
        const sy=r.y+r.h/2;
        path(`M ${r.x+r.w} ${sy} H ${midX} V ${ty}`,stroke,width,i===rounds.length-2);
      });
      path(`M ${midX} ${ty} H ${tx}`,stroke,width,i===rounds.length-2);
      const dot=document.createElementNS(svgNS,'circle');dot.setAttribute('cx',tx);dot.setAttribute('cy',ty);dot.setAttribute('r',i===rounds.length-2?'3':'2');dot.setAttribute('fill',stroke);svg.appendChild(dot);
    });
  }
  // Champion is visually attached to the Grand Final, not placed below the bracket.
  const finalRound=rounds[rounds.length-1];
  const finalSlot=finalRound?.querySelector('.match-slot:not(.third-match)');
  const champion=board.querySelector('.champion-reference');
  if(finalSlot&&champion){
    const fr=rel(card(finalSlot).getBoundingClientRect()), cr=rel(champion.getBoundingClientRect());
    const sy=fr.y+fr.h/2, ey=cr.y+cr.h/2, sx=fr.x+fr.w, ex=cr.x;
    const mx=sx+Math.max(18,(ex-sx)*0.55);
    path(`M ${sx} ${sy} H ${mx} V ${ey} H ${ex}`,'url(#bracketGold)',2.2,true);
    const dot=document.createElementNS(svgNS,'circle');dot.setAttribute('cx',ex);dot.setAttribute('cy',ey);dot.setAttribute('r','3.2');dot.setAttribute('fill','#f5d46a');dot.setAttribute('filter','url(#bracketGlow)');svg.appendChild(dot);
  }
  board.prepend(svg);
}
function renderBracket(){
  const ms=matches(),board=document.querySelector('.bracket-reference-board');
  if(board){
    const rounds={};
    ms.filter(m=>m[0]!=='third').forEach(m=>{const r=m[0].match(/^r(\d+)/)?.[1]||'1';(rounds[r]??=[]).push(m)});
    const labels=['ROUND OF 16','QUARTER FINAL','SEMI FINAL','GRAND FINAL'];
    const keys=Object.keys(rounds).sort((a,b)=>+a-+b);
    board.innerHTML=keys.map((r,idx)=>`<div class="bracket-round round-${idx===0?'q':idx===keys.length-1?'g':'s'}" data-round="${r}"><div class="col-title">${labels[idx]||'ROUND '+r}</div>${rounds[r].map(m=>`<div class="match-slot" data-match="${m[0]}"></div>`).join('')}</div>`).join('')+`<div class="bracket-podium-reference"><div class="champion-reference"><span>CHAMPION</span><div>🏆</div><strong id="championName">TBD</strong><small>JUARA 1</small></div><div class="third-fourth-reference"><div class="placement-label">PEREBUTAN JUARA 3 & 4</div><div class="placement-mini-grid"><div><span>JUARA 3</span><b id="thirdName">TBD</b></div><div><span>JUARA 4</span><b id="fourthName">TBD</b></div></div></div></div>`;
  }
  document.querySelectorAll('[data-match]').forEach(el=>{const m=ms.find(x=>x[0]===el.dataset.match);if(m)el.innerHTML=refCard(m)});
  requestAnimationFrame(()=>drawPremiumBracketLines(board));
  const final=ms.filter(m=>m[0]!=='third').at(-1),third=ms.find(m=>m[0]==='third');
  if(!final)return;
  const c=winner(final[0],final[2],final[3]),runner=loser(final[0],final[2],final[3]);
  const p3=third?winner('third',third[2],third[3]):'TBD',p4=third?loser('third',third[2],third[3]):'TBD';
  const champ=document.querySelector('#championName');if(champ)champ.textContent=c;
  const thirdName=document.querySelector('#thirdName');if(thirdName)thirdName.textContent=p3;
  const fourthName=document.querySelector('#fourthName');if(fourthName)fourthName.textContent=p4;
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
function isBanned(a,b){
  return a!==b&&state.banned.includes(a)&&state.banned.includes(b);
}
function teamHasBanned(team,name){
  return state.banned.includes(name)&&team.some(p=>{
    const n=typeof p==='object'?p.name:p;
    return n&&n!==name&&state.banned.includes(n);
  });
}
function distributeToTeams(idpPool,imePool){
  const total=idpPool.length+imePool.length;
  const teamCount=Math.min(TEAM_COUNT,Math.ceil(total/5));
  const ratio=total?idpPool.length/total:0;
  const sizes=Array.from({length:teamCount},(_,i)=>Math.min(5,total-i*5));

  // Target faction counts per team are calculated from the global roster ratio.
  const targets=sizes.map(size=>Math.round(size*ratio));
  const idpTarget=targets.reduce((a,b)=>a+b,0);
  let diff=idpPool.length-idpTarget;
  if(diff!==0){
    const order=targets.map((v,i)=>i).sort((a,b)=>diff>0?(sizes[b]-targets[b])-(sizes[a]-targets[a]):targets[b]-targets[a]);
    for(const i of order){
      if(diff>0&&targets[i]<sizes[i]){targets[i]++;diff--}
      else if(diff<0&&targets[i]>0){targets[i]--;diff++}
      if(diff===0)break;
    }
  }

  // A banned list means a clique: every banned player must be in a different team.
  // If there are more banned players than teams, the constraint is mathematically impossible.
  const bannedPlayers=[...new Set(state.banned.filter(n=>idpPool.includes(n)||imePool.includes(n)))];
  const impossible=bannedPlayers.length>teamCount;

  let best=null;
  for(let attempt=0;attempt<2500;attempt++){
    const players=[
      ...shuffleArray(idpPool.map(name=>({name,side:'idp',banned:state.banned.includes(name)}))),
      ...shuffleArray(imePool.map(name=>({name,side:'ime',banned:state.banned.includes(name)})))
    ];
    // Place constrained/banned players first, then fill the remaining slots.
    shuffleArray(players);
    players.sort((a,b)=>(b.banned-a.banned));

    const teams=Array.from({length:teamCount},()=>[]);
    let failed=false;
    for(const player of players){
      const candidates=[];
      for(let i=0;i<teamCount;i++){
        const team=teams[i];
        if(team.length>=sizes[i])continue;
        if(teamHasBanned(team,player.name))continue;
        const factionCount=team.filter(p=>p.side===player.side).length;
        const target=targets[i];
        // Prefer teams that are furthest below their faction target.
        const factionPenalty=Math.max(0,factionCount-target);
        const fillPenalty=team.length/sizes[i];
        candidates.push({i,score:factionPenalty*100+fillPenalty*10+Math.random()});
      }
      if(!candidates.length){failed=true;break}
      candidates.sort((a,b)=>a.score-b.score);
      teams[candidates[0].i].push(player);
    }
    if(failed)continue;

    const conflict=teams.some(team=>team.some((p,j)=>team.some((q,k)=>j<k&&isBanned(p.name,q.name))));
    const factionError=teams.reduce((sum,team,i)=>sum+Math.abs(team.filter(p=>p.side==='idp').length-targets[i]),0);
    const candidate={teams,conflict,factionError};
    if(!best||candidate.factionError<best.factionError)best=candidate;
    if(!conflict&&factionError===0)return {teams,conflict:false,impossible:false};
  }

  if(best)return {teams:best.teams,conflict:best.conflict,impossible};
  return {teams:[],conflict:true,impossible};
}
function applyDistribution(idpPool,imePool){
  const res=distributeToTeams(idpPool,imePool);
  state.teams=Array.from({length:TEAM_COUNT},(_,i)=>({name:teamLabel(i),side:'mixed',players:res.teams[i]||[]}));
  return res;
}
function addParticipants(names,side){
  const clean=names.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);
  if(!clean.length)return 0;
  const s=getPool();const pool=side==='idp'?s.idp:s.ime;let added=0;
  clean.forEach(name=>{if(!pool.some(n=>n.toLowerCase()===name.toLowerCase())){pool.push(name);added++}});
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
  // Shuffle remains available even when all 16 teams (80 slots) are full.
  const res=applyDistribution(idp,ime);
  state.winners={};state.scores={};save();renderAll();renderParticipantList();
  const note=document.querySelector('#shuffleNote');
  if(note){
    const idpPer=Math.round(5*idp.length/total),imePer=5-idpPer;
    if(res.impossible){
      note.textContent=`Shuffle selesai, tetapi ${state.banned.filter(n=>idp.includes(n)||ime.includes(n)).length} player banned melebihi ${Math.min(TEAM_COUNT,Math.ceil(total/5))} team yang tersedia. Sebagian harus bertemu karena secara matematis tidak mungkin dipisahkan semua.`;
    }else if(res.conflict){
      note.textContent=`Shuffle selesai, tetapi constraint banned belum dapat dipenuhi pada percobaan ini. Coba KOCOK lagi.`;
    }else{
      note.textContent=`Shuffle selesai. Komposisi mengikuti rasio roster: sekitar ${idpPer} IDP + ${imePer} IME / team. Semua player di Banned Player dipisahkan agar tidak satu team.`;
    }
    note.classList.toggle('success',!res.conflict&&!res.impossible);note.classList.toggle('warn',res.conflict||res.impossible);
  }
}
function shuffleBracket(){
  if(!Array.isArray(state.teams) || state.teams.length<2){ alert('Minimal 2 team diperlukan untuk mengocok bracket.'); return; }
  const teams=[...state.teams];
  for(let i=teams.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [teams[i],teams[j]]=[teams[j],teams[i]];
  }
  state.teams=teams;
  state.winners={};
  state.scores={};
  save();
  renderAll();
  const note=document.querySelector('#bracketShuffleNote');
  if(note){
    note.textContent='Bracket berhasil dikocok. Pasangan Round 1 diacak ulang tanpa mengubah roster setiap team.';
    note.classList.add('success');
  }
}
function renderResults(){
  const el=document.querySelector('#resultGrid');if(!el)return;
  const ms=matches();
  const rounds={};
  ms.filter(m=>m[0]!=='third').forEach(m=>{const r=m[0].match(/^r(\d+)/)?.[1]||'1';(rounds[r]??=[]).push(m)});
  const roundKeys=Object.keys(rounds).sort((a,b)=>+a-+b);
  el.className='result-grid result-bracket';
  const third=ms.find(m=>m[0]==='third');
  el.innerHTML=`<div class="bracket-reference-board admin-result-board">
    ${roundKeys.map((r,idx)=>`<div class="bracket-round round-${idx===0?'q':idx===roundKeys.length-1?'g':'s'}" data-round="${r}"><div class="col-title">${idx===roundKeys.length-1?'GRAND FINAL':idx===roundKeys.length-2?'SEMI FINAL':idx===roundKeys.length-3?'QUARTER FINAL':'ROUND OF 16'}</div>${rounds[r].map(m=>`<div class="match-slot">${refCard(m,true)}</div>`).join('')}</div>`).join('')}
    <div class="champion-reference"><span>CHAMPION</span><div>🏆</div><strong>${esc(winner('r4m1', rounds['4']?.[0]?.[2]||'TBD', rounds['4']?.[0]?.[3]||'TBD'))}</strong><small>JUARA 1</small></div>
  </div>
  <div class="admin-third-place">
    <div class="third-place-head"><div><span>PLACEMENT MATCH</span><h4>3RD PLACE MATCH</h4><small>Perebutan Juara 3 &amp; 4 — pemenang mendapat JUARA 3, yang kalah JUARA 4.</small></div><b>🥉</b></div>
    <div class="third-place-card">${third?refCard(third,true):''}</div>
  </div>`;
  requestAnimationFrame(()=>drawPremiumBracketLines(el.querySelector('.bracket-reference-board')));
  el.querySelectorAll('[data-result-win]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.resultWin,t=b.dataset.resultTeam;if(!t||t==='TBD')return;
    state.winners[k]=state.winners[k]===t?'':t;invalidate(k);save();renderAll();
  });
}

window.addEventListener('resize',()=>{const b=document.querySelector('.bracket-reference-board');if(b)drawPremiumBracketLines(b)});
function getAllRosterPlayers(){
  const rows=[];
  state.teams.forEach(team=>(team.players||[]).forEach(player=>{
    const name=typeof player==='object'?player.name:player;
    const side=typeof player==='object'?player.side:'';
    if(!name||name==='TBD')return;
    rows.push({name,side:side||'mixed',team:team.name||'TBD'});
  }));
  return rows;
}
function getKillsMatches(){
  if(!state.killsRanking||typeof state.killsRanking!=='object')state.killsRanking=clone(DEFAULT.killsRanking);
  if(!Array.isArray(state.killsRanking.matches))state.killsRanking.matches=[];
  return state.killsRanking.matches;
}
function rosterLookup(name){
  const q=String(name||'').trim().toLowerCase();
  return getAllRosterPlayers().find(p=>p.name.toLowerCase()===q)||null;
}
function aggregateKills(){
  const map=new Map();
  getKillsMatches().forEach(m=>(m.entries||[]).forEach(e=>{
    const name=String(e?.name||'').trim(); if(!name)return;
    const key=name.toLowerCase();
    const cur=map.get(key)||{name,kills:0,team:String(e?.team||''),side:String(e?.side||'')};
    cur.kills+=Math.max(0,Math.floor(Number(e?.kills)||0));
    map.set(key,cur);
  }));
  return [...map.values()];
}
function renderKillsTotalTable(){
  const el=document.querySelector('#killsTotalTable'); if(!el)return;
  const ranked=aggregateKills().sort((a,b)=>b.kills-a.kills||a.name.localeCompare(b.name));
  el.innerHTML=ranked.length ? `<div class="kills-total-row kills-total-row-head"><span>#</span><span>PLAYER</span><span>TOTAL KILL</span></div>${ranked.map((p,i)=>`<div class="kills-total-row"><span>${String(i+1).padStart(2,'0')}</span><div><b>${esc(p.name)}</b>${p.team||p.side?`<small>${esc(p.team||'MAPENDOS')}${p.side?' · '+esc(p.side.toUpperCase()):''}</small>`:''}</div><strong>${p.kills}</strong></div>`).join('')}` : '<div class="kills-total-empty">Belum ada data total kill.</div>';
}
function renderKillsRanking(){
  const board=document.querySelector('#killsRankingBoard');if(!board)return;
  const ranked=aggregateKills().sort((a,b)=>b.kills-a.kills||a.name.localeCompare(b.name)).slice(0,5),k=state.killsRanking||{};
  board.innerHTML=ranked.length?ranked.map((p,i)=>{
    const side=(p.side||'').toUpperCase(), cls=i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'rank-other';
    return `<article class="kill-card ${cls}"><div class="kill-card-top"><span class="kill-rank">${String(i+1).padStart(2,'0')}</span><span class="kill-kpg">${p.kills} TOTAL KILL</span></div><div class="kill-avatar"><div class="esport-silhouette" aria-hidden="true"><i></i><b></b></div></div><div class="kill-card-bottom"><div><strong>${esc(p.name)}</strong><small>${esc(p.team||'MAPENDOS')}${side?' · '+esc(side):''}</small></div><b>${p.kills}</b></div></article>`;
  }).join(''):`<div class="kills-empty">Belum ada data kills.</div>`;
  renderKillsTotalTable();
  const meta=document.querySelector('#killsMatchMeta');if(meta)meta.innerHTML=`<span>${esc(k.weekLabel||'WEEK 1')}</span><b>${esc(k.seasonLabel||'REGULAR SEASON')}</b><em>${esc(k.matchLabel||'ALL MATCHES')}</em>`;

  const table=document.querySelector('#killsAdminTable');
  if(table){const matches=getKillsMatches();table.innerHTML=matches.length?matches.map((m,mi)=>`<div class="kills-match-block"><div class="kills-match-head"><div><span>MATCH ${mi+1}</span><b>${esc(m.matchLabel)}</b></div><button type="button" data-remove-kills-match="${mi}">HAPUS MATCH</button></div><div class="kills-match-entries">${(m.entries||[]).map((p,pi)=>`<div class="kills-admin-row"><span>0${pi+1}</span><div><b>${esc(p.name)}</b><small>${esc(p.team)} · ${(p.side||'').toUpperCase()}</small></div><strong>${p.kills}</strong><button type="button" data-remove-kills-entry="${mi}:${pi}">×</button></div>`).join('')}</div></div>`).join(''):`<div class="kills-empty">Belum ada match. Tambahkan 1–5 player per match.</div>`}
  const a=document.querySelector('#killsMatchLabel');if(a)a.value=k.matchLabel||'';const w=document.querySelector('#killsWeekLabel');if(w)w.value=k.weekLabel||'';const se=document.querySelector('#killsSeasonLabel');if(se)se.value=k.seasonLabel||'';
}
function bindKillsAdmin(){
  const add=()=>{
    const mi=document.querySelector('#killsInputMatch'),pi=document.querySelector('#killsInputPlayer'),ki=document.querySelector('#killsInputKills'),matchLabel=mi?.value.trim()||'MATCH 1',playerName=pi?.value.trim(),raw=String(ki?.value||'').trim(),kills=Math.max(0,Math.floor(Number(raw)||0));
    if(!playerName){alert('Ketik nama player.');return} if(!raw){alert('Masukkan jumlah kill.');return}
    const matches=getKillsMatches();let match=matches.find(m=>m.matchLabel.toLowerCase()===matchLabel.toLowerCase());
    if(!match){match={matchLabel,entries:[]};matches.push(match)}
    if(match.entries.some(e=>e.name.toLowerCase()===playerName.toLowerCase())){alert('Player tersebut sudah ada di match ini.');return}
    if(match.entries.length>=5){alert('Maksimal 5 Top Kill untuk setiap match.');return}
    match.entries.push({name:playerName,kills,team:'',side:''});state.killsRanking.matchLabel=matchLabel;save();renderKillsRanking();if(pi)pi.value='';if(ki)ki.value='';pi?.focus();
  };
  document.querySelector('#addKillsEntry')?.addEventListener('click',add);
  document.querySelector('#killsInputPlayer')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();add()}});
  document.querySelector('#killsInputKills')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();add()}});
  document.querySelector('#saveKillsRanking')?.addEventListener('click',()=>{state.killsRanking.matchLabel=document.querySelector('#killsMatchLabel')?.value.trim()||'ALL MATCHES';state.killsRanking.weekLabel=document.querySelector('#killsWeekLabel')?.value.trim()||'WEEK 1';state.killsRanking.seasonLabel=document.querySelector('#killsSeasonLabel')?.value.trim()||'REGULAR SEASON';save();renderKillsRanking()});
  document.querySelector('#killsAdminTable')?.addEventListener('click',e=>{const rm=e.target.closest('[data-remove-kills-match]'),re=e.target.closest('[data-remove-kills-entry]');if(rm){const i=+rm.dataset.removeKillsMatch;if(confirm('Hapus seluruh data match ini?')){getKillsMatches().splice(i,1);save();renderKillsRanking()}}if(re){const [mi,pi]=re.dataset.removeKillsEntry.split(':').map(Number);getKillsMatches()[mi]?.entries.splice(pi,1);save();renderKillsRanking()}});
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
  const input=document.querySelector('#bannedPlayerSearch');
  if(input && !input.value) input.placeholder='Cari player... tekan Enter untuk banned';
}
function renderBannedList(){
  const el=document.querySelector('#bannedList');if(!el)return;
  el.innerHTML=state.banned.length
    ? state.banned.map((name,i)=>`<div class="banned-row"><b>${esc(name)}</b><span>BANNED</span><button type="button" data-remove-banned="${i}" aria-label="Hapus">×</button></div>`).join('')
    : `<div class="empty-participants">Belum ada player banned.</div>`;
}
function addBannedPlayers(raw){
  const names=String(raw||'').split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);

  let added=0;
  const pool=getPool(),all=[...pool.idp,...pool.ime];
  names.forEach(name=>{
    const exact=all.find(n=>n.toLowerCase()===name.toLowerCase());
    if(exact&&!state.banned.includes(exact)){state.banned.push(exact);added++}
  });
  save();renderBannedList();renderBannedOptions();
  return added;
}
function removeBannedPlayer(index){
  state.banned.splice(+index,1);
  save();renderBannedList();renderBannedOptions();
}

function setupBannedSystem(){
  const input=document.querySelector('#bannedPlayerSearch');
  input?.addEventListener('keydown',e=>{
    if(e.key!=='Enter')return;
    e.preventDefault();
    const value=input.value.trim();if(!value)return;
    const added=addBannedPlayers(value);
    input.value='';
    if(!added)alert('Player tersebut sudah ada di banned list.');
  });
  document.querySelector('#bannedList')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-remove-banned]');if(!btn)return;
    removeBannedPlayer(btn.dataset.removeBanned);
  });
}
function updateShuffleButton(){const b=document.querySelector('#shufflePlayers');if(!b)return;const s=getPool(),total=s.idp.length+s.ime.length;b.disabled=false;b.title=total>=TEAM_COUNT*5?'Roster sudah 80 player — KOCOK tetap bisa digunakan untuk mengacak ulang.':'';b.textContent='⤨ KOCOK PLAYER'}
function renderAll(){renderBracket();renderRoster();renderAdminTeams();renderResults();renderStats();renderLive();renderBannedOptions();renderBannedList();updateShuffleButton();renderKillsRanking()}
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
function setupAdminLogin(){
  const gate=document.querySelector('#adminLogin'); if(!gate)return true;
  const stored=getAdminPassword();
  if(stored) gate.classList.add('hidden');
  const form=document.querySelector('#adminLoginForm'), input=document.querySelector('#adminPassword'), err=document.querySelector('#adminLoginError');
  form?.addEventListener('submit',async e=>{
    e.preventDefault(); const password=input?.value||''; if(!password)return;
    try{
      const r=await fetch(API_STATE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'auth',password})});
      if(!r.ok) throw new Error('Invalid password');
      sessionStorage.setItem('mapendos-admin-password',password);
      gate.classList.add('hidden'); if(err)err.textContent='';
      if(typeof setupAdmin==='function') setupAdmin();
      if(typeof setupBannedSystem==='function') setupBannedSystem();
      if(typeof bindKillsAdmin==='function') bindKillsAdmin();
      renderAll(); renderParticipantList(); loadRemoteState();
    }catch(_){ if(err)err.textContent='Password salah atau ADMIN_PASSWORD belum dikonfigurasi.'; if(input){input.value='';input.focus();}}
  });
  return !!stored;
}

function setupAdmin(){
  document.querySelectorAll('.admin-sidebar nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.admin-sidebar nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.admin-view').forEach(v=>v.classList.toggle('active',v.dataset.view===b.dataset.tab))});
  document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>document.querySelector(`.admin-sidebar nav button[data-tab="${b.dataset.jump}"]`)?.click());
  const clear=document.querySelector('#clearResults');if(clear)clear.onclick=()=>{state.winners={};state.scores={};save();renderAll()};
  const shuffleBracketBtn=document.querySelector('#shuffleBracket');if(shuffleBracketBtn)shuffleBracketBtn.onclick=shuffleBracket;
  const saveAdmin=document.querySelector('#saveAdmin');if(saveAdmin)saveAdmin.onclick=()=>save();
  const saveLive=document.querySelector('#saveLive');if(saveLive)saveLive.onclick=()=>{state.live.idp=document.querySelector('#admin-live-idp')?.value||'';state.live.ime=document.querySelector('#admin-live-ime')?.value||'';save();renderLive()};
  const exp=document.querySelector('#exportData');if(exp)exp.onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='mapendos-backup.json';a.click()};
  const imp=document.querySelector('#importData');if(imp)imp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=normalize(JSON.parse(r.result));save();renderAll();renderParticipantList()}catch{alert('JSON tidak valid')}};r.readAsText(f)};
  const reset=document.querySelector('#resetAdmin');if(reset)reset.onclick=()=>{if(confirm('Reset tampilan/data lokal ke default? Data Redis juga akan ditimpa jika disimpan.')){state=clone(DEFAULT);save();renderAll();renderParticipantList()}};

  async function destructiveReset(action, message, applyLocal){
    if(!getAdminPassword()){ alert('Sesi Admin tidak ditemukan. Silakan login ulang.'); return; }
    if(!confirm(message)) return;
    if(action==='reset_all' && !confirm('KONFIRMASI TERAKHIR\n\nSemua team, bracket, hasil, live, banned, dan kills akan dihapus permanen. Lanjutkan?')) return;
    try{
      const r=await fetch(API_STATE,{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Password':getAdminPassword()},body:JSON.stringify({action})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||('API '+r.status));
      if(action==='reset_all'){ state=clone(DEFAULT); localStorage.setItem(KEY,JSON.stringify(state)); remoteUpdatedAt=null; }
      else if(data.state){ state=normalize(data.state); localStorage.setItem(KEY,JSON.stringify(state)); remoteUpdatedAt=data.state.updatedAt||null; }
      else if(applyLocal) applyLocal();
      remoteReady=true; renderAll(); renderParticipantList(); alert('Data berhasil dihapus.');
    }catch(err){ alert('Gagal menghapus data: '+err.message); }
  }
  const rk=document.querySelector('#resetKillsData');if(rk)rk.onclick=()=>destructiveReset('reset_kills','Hapus SEMUA data Kill Ranking? Data Top 5 dan Total Kill akan kosong.',()=>{state.killsRanking=clone(DEFAULT.killsRanking)});
  const rt=document.querySelector('#resetTournamentData');if(rt)rt.onclick=()=>destructiveReset('reset_tournament','Reset tournament? Semua team, roster, bracket, hasil, dan banned player akan dihapus.',()=>{state.teams=clone(DEFAULT.teams);state.scores={};state.winners={};state.banned=[]});
  const ra=document.querySelector('#resetAllData');if(ra)ra.onclick=()=>destructiveReset('reset_all','HAPUS SEMUA DATA? Aksi ini menghapus seluruh data website dari Upstash Redis.',()=>{state=clone(DEFAULT)});
}
setupNav();
const isAdminPage=!!document.querySelector('.admin-page');
if(!isAdminPage || getAdminPassword()){
  if(isAdminPage){setupRosterModal();setupAdmin();setupBannedSystem();bindKillsAdmin();}
  renderAll();renderParticipantList();loadRemoteState();
}else{
  renderAll();
}
if(isAdminPage) setupAdminLogin();
setInterval(syncRemoteState, 2500);
