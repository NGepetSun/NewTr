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
  return {teams,scores:x.scores||{},winners:x.winners||{},live:{...d.live,...(x.live||{})},banned:(()=>{const b=Array.isArray(x.banned)?x.banned:[]; const flat=[]; b.forEach(v=>{if(Array.isArray(v)) v.forEach(n=>{if(n&&!flat.includes(n))flat.push(n)}); else if(typeof v==='string'&&v&&!flat.includes(v))flat.push(v)}); return flat})()};
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
  svg.innerHTML=`<defs><filter id="bracketGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="bracketGold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b6b22"/><stop offset=".5" stop-color="#f3d06a"/><stop offset="1" stop-color="#8b6b22"/></linearGradient></defs>`;
  const rel=(r)=>({x:r.left-br.left,y:r.top-br.top,w:r.width,h:r.height});
  for(let i=0;i<rounds.length-1;i++){
    const from=[...rounds[i].querySelectorAll('.match-slot')];
    const to=[...rounds[i+1].querySelectorAll('.match-slot')];
    to.forEach((target,j)=>{
      const sources=from.slice(j*2,j*2+2); if(!sources.length)return;
      const tr=rel(target.getBoundingClientRect());
      const tx=tr.x, ty=tr.y+tr.h/2;
      const sourceRects=sources.map(x=>rel(x.getBoundingClientRect()));
      const sx=Math.max(...sourceRects.map(r=>r.x+r.w));
      const midX=sx+(tx-sx)*.5;
      const color=i===rounds.length-2?'url(#bracketGold)':'#6f727b';
      const glow=i===rounds.length-2?'url(#bracketGold)':'#8b8f99';
      const path=(d,cls='')=>{const q=document.createElementNS(svgNS,'path');q.setAttribute('d',d);q.setAttribute('fill','none');q.setAttribute('class',cls);q.setAttribute('stroke',color);q.setAttribute('stroke-width',i===rounds.length-2?'2':'1.5');q.setAttribute('stroke-linecap','round');q.setAttribute('stroke-linejoin','round');q.setAttribute('vector-effect','non-scaling-stroke');return q};
      sourceRects.forEach(sr=>{
        const sy=sr.y+sr.h/2;
        const p=path(`M ${sr.x+sr.w} ${sy} H ${midX} V ${ty} H ${tx}`);
        p.setAttribute('filter','url(#bracketGlow)'); svg.appendChild(p);
      });
      const dot=document.createElementNS(svgNS,'circle');dot.setAttribute('cx',tx);dot.setAttribute('cy',ty);dot.setAttribute('r',i===rounds.length-2?'3':'2');dot.setAttribute('fill',glow);svg.appendChild(dot);
    });
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
    board.innerHTML=keys.map((r,idx)=>`<div class="bracket-round round-${idx===0?'q':idx===keys.length-1?'g':'s'}" data-round="${r}"><div class="col-title">${labels[idx]||'ROUND '+r}</div>${rounds[r].map(m=>`<div class="match-slot" data-match="${m[0]}"></div>`).join('')}</div>`).join('')+`<div class="champion-reference"><span>CHAMPION</span><div>🏆</div><strong id="championName">TBD</strong><small>JUARA 1</small></div>`;
    const third=ms.find(m=>m[0]==='third'); if(third)board.insertAdjacentHTML('beforeend',`<div class="bracket-third-result">${refCard(third)}</div>`);
  }
  document.querySelectorAll('[data-match]').forEach(el=>{const m=ms.find(x=>x[0]===el.dataset.match);if(m)el.innerHTML=refCard(m)});
  requestAnimationFrame(()=>drawPremiumBracketLines(board));
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
function renderResults(){
  const el=document.querySelector('#resultGrid');if(!el)return;
  const ms=matches();
  const rounds={};
  ms.filter(m=>m[0]!=='third').forEach(m=>{const r=m[0].match(/^r(\d+)/)?.[1]||'1';(rounds[r]??=[]).push(m)});
  const roundKeys=Object.keys(rounds).sort((a,b)=>+a-+b);
  el.className='result-grid result-bracket';
  el.innerHTML=`<div class="bracket-reference-board admin-result-board">
    ${roundKeys.map((r,idx)=>`<div class="bracket-round round-${idx===0?'q':idx===roundKeys.length-1?'g':'s'}" data-round="${r}"><div class="col-title">${idx===roundKeys.length-1?'GRAND FINAL':idx===roundKeys.length-2?'SEMI FINAL':idx===roundKeys.length-3?'QUARTER FINAL':'ROUND OF 16'}</div>${rounds[r].map(m=>`<div class="match-slot">${refCard(m,true)}</div>`).join('')}</div>`).join('')}
    <div class="champion-reference"><span>CHAMPION</span><div>🏆</div><strong>TBD</strong><small>JUARA 1</small></div>
  </div>`;
  requestAnimationFrame(()=>drawPremiumBracketLines(el.querySelector('.bracket-reference-board')));
  el.querySelectorAll('[data-result-win]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.resultWin,t=b.dataset.resultTeam;if(!t||t==='TBD')return;
    state.winners[k]=state.winners[k]===t?'':t;invalidate(k);save();renderAll();
  });
}

window.addEventListener('resize',()=>{const b=document.querySelector('.bracket-reference-board');if(b)drawPremiumBracketLines(b)});
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
function renderAll(){renderBracket();renderRoster();renderAdminTeams();renderResults();renderStats();renderLive();renderBannedOptions();renderBannedList();updateShuffleButton()}
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
