const TEAM_COUNT=16;
const MAX_TEAMS=16;
const DEFAULT={teams:Array.from({length:TEAM_COUNT},(_,i)=>({name:`MPD ${String.fromCharCode(65+i)}`,side:'mixed',players:[]})),bracketOrder:Array.from({length:TEAM_COUNT},(_,i)=>i),scores:{},winners:{},live:{idp:'',ime:''},banned:[],killsRanking:{matchLabel:'ALL MATCHES',weekLabel:'WEEK 1',seasonLabel:'REGULAR SEASON',matches:[]}};
const KEY='mapendos-v10-reference-roster';
const API_STATE='/api/state';
let remoteReady=false;
let remoteUpdatedAt=null;
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const teamLabel=i=>`MPD ${String.fromCharCode(65+i)}`;
function normalize(raw){
  const d=clone(DEFAULT),x=raw&&typeof raw==='object'?raw:d;
  const source=Array.isArray(x.teams)?x.teams:[];
  const teamCount=MAX_TEAMS;
  let teams=Array.from({length:teamCount},(_,i)=>({
    name:`MPD ${String.fromCharCode(65+i)}`,
    side:'mixed',
    players:Array.isArray(source[i]?.players)?source[i].players.map(v=>{
      if(v&&typeof v==='object')return {name:v.name??'',side:v.side??''};
      return {name:v??'',side:i<4?'idp':i<8?'ime':''};
    }):[]
  }));
  const bracketOrder=Array.isArray(x.bracketOrder)&&x.bracketOrder.length?x.bracketOrder.map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<teamCount):d.bracketOrder.slice();
  const uniqueOrder=[...new Set(bracketOrder)];
  for(let i=0;i<teamCount;i++)if(!uniqueOrder.includes(i))uniqueOrder.push(i);
  const kr=x.killsRanking&&typeof x.killsRanking==='object'?x.killsRanking:{};
  let matches=Array.isArray(kr.matches)?kr.matches.map(m=>({matchLabel:String(m?.matchLabel??'MATCH'),entries:Array.isArray(m?.entries)?m.entries.map(v=>({name:String(v?.name??''),kills:Math.max(0,Math.floor(Number(v?.kills)||0)),team:String(v?.team??''),side:String(v?.side??'')})).filter(v=>v.name).slice(0,5):[]})).filter(m=>m.entries.length||m.matchLabel):[];
  if(!matches.length&&Array.isArray(kr.entries)&&kr.entries.length)matches=[{matchLabel:String(kr.matchLabel??d.killsRanking.matchLabel),entries:kr.entries.map(v=>({name:String(v?.name??''),kills:Math.max(0,Math.floor(Number(v?.kills)||0)),team:String(v?.team??''),side:String(v?.side??'')})).filter(v=>v.name).slice(0,5)}];
  return {teams,bracketOrder:uniqueOrder,scores:x.scores||{},winners:x.winners||{},live:{...d.live,...(x.live||{})},banned:(()=>{const b=Array.isArray(x.banned)?x.banned:[]; const flat=[]; b.forEach(v=>{if(Array.isArray(v)) v.forEach(n=>{if(n&&!flat.includes(n))flat.push(n)}); else if(typeof v==='string'&&v&&!flat.includes(v))flat.push(v)}); return flat})(),killsRanking:{matchLabel:String(kr.matchLabel??d.killsRanking.matchLabel),weekLabel:String(kr.weekLabel??d.killsRanking.weekLabel),seasonLabel:String(kr.seasonLabel??d.killsRanking.seasonLabel),matches}};
}
let state;try{state=normalize(JSON.parse(localStorage.getItem(KEY)||'null'))}catch{state=clone(DEFAULT)}
if(!state||!Array.isArray(state.teams))state=clone(DEFAULT);
const REFERENCE_LEFT=[['lele','marcel','rigel'],['gin','jiro','kenan'],['joler','laura','wansu'],['eki','ical','xyn'],['jalu','loak','ales'],['dilan','limz','weldan'],['natan','kairi','kla'],['gaga','aran','jucki'],['depan','showie','jexy'],['caesar','beryl','zar'],['sam','jefrey','goreng']];
const REFERENCE_RIGHT=[['crusher','jepri'],['tatan','mattew'],['moza','kyuzin'],['clay','rey'],['iban','rexpi'],['iponge','jhon'],['cello','dokong'],['torik','memet'],['bons','wisnu'],['febri','eko'],['petrus','robby']];
function buildReferenceRoster(){
  return REFERENCE_LEFT.map((a,i)=>({name:`MPD ${i+1}`,side:'mixed',players:[...a.map(name=>({name,side:'idp'})),...REFERENCE_RIGHT[i].map(name=>({name,side:'ime'}))]}));
}
function hasAnyPlayers(teams){return Array.isArray(teams)&&teams.some(t=>Array.isArray(t?.players)&&t.players.some(p=>String((typeof p==='object'?p?.name:p)||'').trim()&&p!=='TBD'));}
function seedReferenceRosterIfEmpty(){
  if(localStorage.getItem(KEY))return;
  const seeded=buildReferenceRoster();
  state.teams=seeded.concat(Array.from({length:5},(_,i)=>({name:`MPD ${String.fromCharCode(76+i)}`,side:'mixed',players:[]})));
  state.bracketOrder=Array.from({length:11},(_,i)=>i);
}
function seedReferenceRosterIfRemoteEmpty(data){
  if(!data||!Array.isArray(data.teams)||hasAnyPlayers(data.teams))return false;
  const seeded=buildReferenceRoster();
  state.teams=seeded.concat(Array.from({length:5},(_,i)=>({name:`MPD ${String.fromCharCode(76+i)}`,side:'mixed',players:[]})));
  state.bracketOrder=Array.from({length:11},(_,i)=>i);
  localStorage.setItem(KEY,JSON.stringify(state));
  renderAll(); renderParticipantList();
  return true;
}
seedReferenceRosterIfEmpty();
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
    if(data&&Array.isArray(data.teams)){
      state=normalize(data);
      const seeded=seedReferenceRosterIfRemoteEmpty(data);
      if(!seeded) localStorage.setItem(KEY,JSON.stringify(state));
      remoteUpdatedAt=data.updatedAt||null; remoteReady=true;
      if(seeded){ localStorage.setItem(KEY,JSON.stringify(state)); }
      renderAll(); renderParticipantList();
    }
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
function activeTeamIndices(){
  const teams=Array.isArray(state?.teams)?state.teams:[];
  const withPlayers=teams.map((t,i)=>({i,t})).filter(x=>Array.isArray(x.t?.players)&&x.t.players.some(p=>{
    const n=typeof p==='object'?p?.name:p; return String(n||'').trim() && n!=='TBD';
  })).map(x=>x.i);
  if(withPlayers.length)return withPlayers.slice(0,MAX_TEAMS);
  return teams.map((_,i)=>i).slice(0,8);
}
function activeTeams(){return activeTeamIndices().map(i=>state.teams[i]).filter(Boolean)}
function teamNameByIndex(i){return state.teams?.[i]?.name||'TBD'}
function setMatch(id,a,b,label){return [id,label,a,b]}
function matches(){
  const indices=activeTeamIndices();
  const count=indices.length;
  const ordered=(Array.isArray(state.bracketOrder)&&state.bracketOrder.length)
    ? state.bracketOrder.filter(i=>indices.includes(Number(i))).map(Number)
    : indices.slice();
  indices.forEach(i=>{if(!ordered.includes(i))ordered.push(i)});
  const t=ordered.map(teamNameByIndex);
  if(count>=9){
    // 9–16 team format: 16-slot double elimination, with the 11-team layout
    // matching the requested reference bracket. For 11 teams, six teams play
    // Round 1 while five seeded teams receive a Round 2 bye.
    const seeds=[...t];
    while(seeds.length<16)seeds.push('TBD');
    const wb=[];
    wb.push(setMatch('m1',seeds[7],seeds[8],'ROUND 1'));
    wb.push(setMatch('m2',seeds[6],seeds[9],'ROUND 1'));
    wb.push(setMatch('m3',seeds[5],seeds[10],'ROUND 1'));
    wb.push(setMatch('m4',seeds[1],winner('m1',seeds[7],seeds[8]),'ROUND 2'));
    wb.push(setMatch('m5',seeds[2],seeds[6],'ROUND 2'));
    wb.push(setMatch('m6',seeds[4],winner('m2',seeds[6],seeds[9]),'ROUND 2'));
    wb.push(setMatch('m7',seeds[3],winner('m3',seeds[5],seeds[10]),'ROUND 2'));
    wb.push(setMatch('m13',winner('m4',seeds[1],winner('m1',seeds[7],seeds[8])),winner('m5',seeds[2],seeds[6]),'ROUND 3'));
    wb.push(setMatch('m14',winner('m6',seeds[4],winner('m2',seeds[6],seeds[9])),winner('m7',seeds[3],winner('m3',seeds[5],seeds[10])),'ROUND 3'));
    wb.push(setMatch('m18',winner('m13',wb[7][2],wb[7][3]),winner('m14',wb[8][2],wb[8][3]),'SEMIFINALS'));
    const loserOf=(id,a,b)=>loser(id,a,b);
    const l1a=setMatch('m10',loserOf('m7',wb[6][2],wb[6][3]),loserOf('m1',wb[0][2],wb[0][3]),'LOSERS ROUND 1');
    const l1b=setMatch('m8',loserOf('m4',wb[3][2],wb[3][3]),loserOf('m2',wb[1][2],wb[1][3]),'LOSERS ROUND 1');
    const l1c=setMatch('m9',loserOf('m5',wb[4][2],wb[4][3]),loserOf('m3',wb[2][2],wb[2][3]),'LOSERS ROUND 1');
    const l2a=setMatch('m12',winner('m10',l1a[2],l1a[3]),loserOf('m6',wb[5][2],wb[5][3]),'LOSERS ROUND 2');
    const l2b=setMatch('m11',winner('m8',l1b[2],l1b[3]),winner('m9',l1c[2],l1c[3]),'LOSERS ROUND 2');
    const l3a=setMatch('m15',loserOf('m13',wb[7][2],wb[7][3]),winner('m12',l2a[2],l2a[3]),'LOSERS ROUND 3');
    const l3b=setMatch('m16',loserOf('m14',wb[8][2],wb[8][3]),winner('m11',l2b[2],l2b[3]),'LOSERS ROUND 3');
    const l4=setMatch('m17',winner('m15',l3a[2],l3a[3]),winner('m16',l3b[2],l3b[3]),'LOSERS ROUND 4');
    const l5=setMatch('m19',winner('m17',l4[2],l4[3]),loserOf('m18',wb[9][2],wb[9][3]),'LOSERS ROUND 5');
    const gf=setMatch('m20',winner('m18',wb[9][2],wb[9][3]),winner('m19',l5[2],l5[3]),'FINALS');
    const reset=setMatch('m21',loser('m20',gf[2],gf[3]),winner('m20',gf[2],gf[3]),'RESET FINAL');
    return [...wb.slice(0,7),...wb.slice(7),l1a,l1b,l1c,l2a,l2b,l3a,l3b,l4,l5,gf,reset];
  }
  // 8-team mode remains the clean single-elimination bracket requested earlier.
  const size=8,slots=[...t,...Array(Math.max(0,size-t.length)).fill('TBD')],rounds=[];let prev=slots,roundNo=1;
  while(prev.length>1){const cur=[];for(let i=0;i<prev.length;i+=2){const id=`r${roundNo}m${i/2+1}`;cur.push(setMatch(id,prev[i],prev[i+1],`ROUND ${roundNo}`))}rounds.push(cur);prev=cur.map(m=>winner(m[0],m[2],m[3]));roundNo++}
  const all=rounds.flat();if(rounds.length>=2){const semis=rounds[rounds.length-2];all.push(['third','3RD PLACE',loser(semis[0][0],semis[0][2],semis[0][3]),loser(semis[1][0],semis[1][2],semis[1][3])])}return all;
}
function matchGroups(){
  const ms=matches();
  if(activeTeamIndices().length>=9){
    const groups={wb1:[],wb2:[],wb3:[],wbsf:[],gf:[],lb1:[],lb2:[],lb3:[],lb4:[],lb5:[]};
    const map={m1:'wb1',m2:'wb1',m3:'wb1',m4:'wb2',m5:'wb2',m6:'wb2',m7:'wb2',m13:'wb3',m14:'wb3',m18:'wbsf',m20:'gf',m21:'gf',m10:'lb1',m8:'lb1',m9:'lb1',m12:'lb2',m11:'lb2',m15:'lb3',m16:'lb3',m17:'lb4',m19:'lb5'};
    ms.forEach(m=>{if(map[m[0]])groups[map[m[0]]].push(m)}); return groups;
  }
  const rounds={};ms.filter(m=>m[0]!=='third').forEach(m=>{const r=m[0].match(/^r(\d+)/)?.[1]||'1';(rounds[r]??=[]).push(m)});return rounds;
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
  // Champion and runner-up are visually attached to the Grand Final, to its right.
  const finalRound=rounds[rounds.length-1];
  const finalSlot=finalRound?.querySelector('.match-slot:not(.third-match)');
  const champion=board.querySelector('.champion-reference');
  const runnerUp=board.querySelector('.runner-up-reference');
  if(finalSlot&&champion){
    const fr=rel(card(finalSlot).getBoundingClientRect()), cr=rel(champion.getBoundingClientRect());
    const sy=fr.y+fr.h/2, ey=cr.y+cr.h/2, sx=fr.x+fr.w, ex=cr.x;
    const mx=sx+Math.max(18,(ex-sx)*0.55);
    path(`M ${sx} ${sy} H ${mx} V ${ey} H ${ex}`,'url(#bracketGold)',2.2,true);
    const dot=document.createElementNS(svgNS,'circle');dot.setAttribute('cx',ex);dot.setAttribute('cy',ey);dot.setAttribute('r','3.2');dot.setAttribute('fill','#f5d46a');dot.setAttribute('filter','url(#bracketGlow)');svg.appendChild(dot);
  }
  if(finalSlot&&runnerUp){
    const fr=rel(card(finalSlot).getBoundingClientRect()), rr=rel(runnerUp.getBoundingClientRect());
    const sy=fr.y+fr.h/2, ey=rr.y+rr.h/2, sx=fr.x+fr.w, ex=rr.x;
    const mx=sx+Math.max(14,(ex-sx)*0.4);
    path(`M ${sx} ${sy} H ${mx} V ${ey} H ${ex}`,'#777b86',1.5);
    const dot=document.createElementNS(svgNS,'circle');dot.setAttribute('cx',ex);dot.setAttribute('cy',ey);dot.setAttribute('r','2.4');dot.setAttribute('fill','#9aa1ad');svg.appendChild(dot);
  }
  board.prepend(svg);
}
function renderBracket(){
  const board=document.querySelector('.bracket-reference-board');if(!board)return;
  const count=activeTeamIndices().length;
  if(count>=9){
    const g=matchGroups();
    const col=(title,key,cls)=>`<div class="bracket-column ${cls}"><div class="col-title">${title}</div>${g[key].map(m=>`<div class="match-slot" data-match="${m[0]}">${refCard(m)}</div>`).join('')}</div>`;
    board.classList.add('double-elim-board');
    board.innerHTML=`<div class="de-winners">${col('ROUND 1','wb1','de-r1')}${col('ROUND 2','wb2','de-r2')}${col('ROUND 3','wb3','de-r3')}${col('SEMIFINALS','wbsf','de-sf')}${col('FINALS','gf','de-gf')}</div><div class="de-losers">${col('LOSERS ROUND 1','lb1','de-lb1')}${col('LOSERS ROUND 2','lb2','de-lb2')}${col('LOSERS ROUND 3','lb3','de-lb3')}${col('LOSERS ROUND 4','lb4','de-lb4')}${col('LOSERS ROUND 5','lb5','de-lb5')}</div><div class="bracket-lines-ref" aria-hidden="true"></div>`;
    requestAnimationFrame(()=>drawDoubleElimLines(board));
    return;
  }
  board.classList.remove('double-elim-board');
  const ms=matches(),rounds={};ms.filter(m=>m[0]!=='third').forEach(m=>{const r=m[0].match(/^r(\d+)/)?.[1]||'1';(rounds[r]??=[]).push(m)});
  const labels=['QUARTER FINAL','SEMI FINAL','GRAND FINAL'],keys=Object.keys(rounds).sort((a,b)=>+a-+b);
  board.innerHTML=keys.map((r,idx)=>`<div class="bracket-round round-${idx===0?'q':idx===keys.length-1?'g':'s'}" data-round="${r}"><div class="col-title">${labels[idx]||'ROUND '+r}</div>${rounds[r].map(m=>`<div class="match-slot" data-match="${m[0]}"></div>`).join('')}</div>`).join('')+`<div class="bracket-podium-reference"><div class="champion-reference"><span>CHAMPION</span><div>🏆</div><strong id="championName">TBD</strong><small>JUARA 1</small></div><div class="runner-up-reference"><span>RUNNER-UP</span><b id="runnerUpName">TBD</b><small>JUARA 2</small></div></div>`;
  document.querySelectorAll('[data-match]').forEach(el=>{const m=ms.find(x=>x[0]===el.dataset.match);if(m)el.innerHTML=refCard(m)});requestAnimationFrame(()=>drawPremiumBracketLines(board));
  const final=ms.filter(m=>m[0]!=='third').at(-1),third=ms.find(m=>m[0]==='third');if(!final)return;const c=winner(final[0],final[2],final[3]),runner=loser(final[0],final[2],final[3]);document.querySelector('#championName').textContent=c;document.querySelector('#runnerUpName').textContent=runner;
}
function drawDoubleElimLines(board){
  const old=board.querySelector('.bracket-lines-ref');if(old)old.remove();
  const svgNS='http://www.w3.org/2000/svg',svg=document.createElementNS(svgNS,'svg');svg.classList.add('bracket-lines-ref');svg.setAttribute('aria-hidden','true');svg.setAttribute('width','100%');svg.setAttribute('height','100%');svg.innerHTML='<defs><filter id="deGlow"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  const br=board.getBoundingClientRect(),rel=e=>{const r=e.getBoundingClientRect();return{x:r.left-br.left,y:r.top-br.top,w:r.width,h:r.height}};
  const card=id=>board.querySelector(`[data-match="${id}"] .match-card-ref`), path=(d,stroke='#777b86',w=1.5)=>{const p=document.createElementNS(svgNS,'path');p.setAttribute('d',d);p.setAttribute('fill','none');p.setAttribute('stroke',stroke);p.setAttribute('stroke-width',w);p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');svg.appendChild(p)};
  const connect=(fromIds,toId)=>{const target=card(toId);if(!target)return;const tr=rel(target),tx=tr.x,ty=tr.y+tr.h/2;const sources=fromIds.map(card).filter(Boolean).map(rel);if(!sources.length)return;const sx=Math.max(...sources.map(r=>r.x+r.w)),mx=sx+Math.max(18,(tx-sx)*.5);sources.forEach(r=>path(`M ${r.x+r.w} ${r.y+r.h/2} H ${mx} V ${ty}`));path(`M ${mx} ${ty} H ${tx}`)};
  [['m1','m4'],['m2','m6'],['m3','m7']].forEach(([a,b])=>connect([a],b));
  [['m4','m5','m13'],['m6','m7','m14'],['m13','m14','m18'],['m18','m19','m20'],['m10','m6','m12'],['m8','m9','m11'],['m13','m12','m15'],['m14','m11','m16'],['m15','m16','m17'],['m17','m18','m19']].forEach(([a,b,to])=>connect([a,b],to));
  board.prepend(svg);
}
function renderRoster(){
  const el=document.querySelector('#rosterGrid');if(!el)return;
  const active=activeTeamIndices(),count=document.querySelector('.roster-count');
  if(count)count.textContent=`${active.length} TEAMS · UNLIMITED PLAYERS / TEAM`;
  el.innerHTML=active.map(i=>{const t=state.teams[i];return `<article class="roster-card ${t.side}"><div class="roster-head"><div class="mini-crest ${t.side}">${String.fromCharCode(65+i%4)}</div><div><span>MAPENDOS · ${teamLabel(i)}</span><h3>${esc(t.name)}</h3></div></div><div class="players">${(t.players||[]).map((p,j)=>{const n=typeof p==='object'?p.name:p;const f=typeof p==='object'?p.side:'';return `<div><span class="num">${String(j+1).padStart(2,'0')}</span><b>${esc(n||'TBD')}</b><em class="${f}">${f?f.toUpperCase():''}</em></div>`}).join('')}</div></article>`}).join('');
}
function getPlacedPlayers(){
  const list=[];
  state.teams.forEach((t,ti)=>(t.players||[]).forEach((p,pi)=>{
    const name=(typeof p==='object'?p.name:p)||'';
    const side=(typeof p==='object'?p.side:'')||'';
    if(name)list.push({name,side,ti,pi});
  }));
  return list;
}
function renderAdminTeams(){
  const el=document.querySelector('#adminTeams');if(!el)return;
  const active=activeTeamIndices();let idpIdx=0,imeIdx=0;
  el.innerHTML=active.map(i=>{
    const t=state.teams[i],players=t.players||[];
    return `<article class="admin-team mixed"><div class="admin-team-top"><b>${teamLabel(i)}</b><span class="team-status">${players.filter(p=>p&&p.name).length} PLAYERS</span></div><div class="admin-move-search" data-target-team="${i}"><input type="text" class="admin-move-input" autocomplete="off" placeholder="🔍 Cari player untuk pindah ke ${teamLabel(i)}..."><div class="admin-move-suggestions"></div></div><div class="admin-team-player-list">${players.map((p,j)=>{const name=(typeof p==='object'?p.name:p)||'';const side=(typeof p==='object'?p.side:'')||'';const removable=name&&name!=='TBD'&&(side==='idp'||side==='ime');const idx=side==='idp'?idpIdx:side==='ime'?imeIdx:-1;if(removable){if(side==='idp')idpIdx++;else imeIdx++}return `<div class="admin-player"><span>${String(j+1).padStart(2,'0')}</span><b>${esc(name||'TBD')}</b><em class="${side}">${side?side.toUpperCase():''}</em>${removable?`<button type="button" class="admin-player-remove" data-remove-player="${side}:${idx}" aria-label="Hapus ${esc(name)}">×</button>`:''}</div>`}).join('')}</div></article>`;
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
function updateRosterPoolSummary(){const s=getPool();const el=document.querySelector('#rosterPoolSummary');if(el)el.innerHTML=`<div><span>IDP PARTICIPANTS</span><b>${s.idp.length}</b><small> TOTAL</small></div><div><span>IME PARTICIPANTS</span><b>${s.ime.length}</b><small> TOTAL</small></div><div><span>FORMAT</span><b>∞</b><small> PLAYERS / TEAM</small></div>`}
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
  const existingCount=activeTeamIndices().length;
  const teamCount=Math.min(MAX_TEAMS,Math.max(1,existingCount>=2?existingCount:Math.ceil(total/5)));
  const ratio=total?idpPool.length/total:0;
  const sizes=Array.from({length:teamCount},(_,i)=>Math.ceil((total-i)/Math.max(1,teamCount-i)));

  // Target IDP count per team from the global roster ratio, using largest-remainder
  // rounding so every team's target is as close as possible to the true ratio
  // (this is what previously let a team drift to e.g. 4 IDP / 1 IME).
  const raw=sizes.map(size=>size*ratio);
  const targets=raw.map(Math.floor);
  let remainder=idpPool.length-targets.reduce((a,b)=>a+b,0);
  const byFraction=raw.map((v,i)=>({i,frac:v-Math.floor(v)})).sort((a,b)=>b.frac-a.frac);
  for(let k=0;k<byFraction.length&&remainder>0;k++){
    const i=byFraction[k].i;
    if(targets[i]<sizes[i]){targets[i]++;remainder--}
  }
  // Edge case safety net: if rounding still left leftovers, hand them to whichever
  // teams have spare capacity so the totals always add up exactly.
  if(remainder>0){
    const byCapacity=targets.map((t,i)=>i).sort((a,b)=>(sizes[b]-targets[b])-(sizes[a]-targets[a]));
    for(const i of byCapacity){while(remainder>0&&targets[i]<sizes[i]){targets[i]++;remainder--}}
  }

  // A banned list means a clique: every banned player must be in a different team.
  // If there are more banned players than teams, the constraint is mathematically impossible.
  const bannedPlayers=[...new Set(state.banned.filter(n=>idpPool.includes(n)||imePool.includes(n)))];
  const impossible=bannedPlayers.length>teamCount;

  let best=null;
  for(let attempt=0;attempt<200;attempt++){
    const idp=shuffleArray(idpPool.map(name=>({name,side:'idp'})));
    const ime=shuffleArray(imePool.map(name=>({name,side:'ime'})));

    // Fill each team to exactly its IDP/IME target first, so faction balance is
    // guaranteed by construction instead of hoping a random search finds it.
    const teams=Array.from({length:teamCount},()=>[]);
    let idpI=0,imeI=0;
    for(let i=0;i<teamCount;i++){
      const idpNeeded=targets[i],imeNeeded=sizes[i]-targets[i];
      teams[i].push(...idp.slice(idpI,idpI+idpNeeded));idpI+=idpNeeded;
      teams[i].push(...ime.slice(imeI,imeI+imeNeeded));imeI+=imeNeeded;
    }

    // Now resolve banned-player clashes by swapping same-faction players between
    // teams only, which fixes conflicts without ever disturbing the IDP/IME balance.
    resolveBannedClashes(teams);

    const conflict=teams.some(team=>team.some((p,j)=>team.some((q,k)=>j<k&&isBanned(p.name,q.name))));
    if(!best||(best.conflict&&!conflict))best={teams,conflict};
    if(!conflict)return {teams,conflict:false,impossible:false};
  }

  if(best)return {teams:best.teams,conflict:best.conflict,impossible};
  return {teams:[],conflict:true,impossible};
}
function resolveBannedClashes(teams){
  // Tries swapping two same-faction players across teams to remove a banned clash.
  // Same-faction swaps never change either team's IDP/IME count.
  for(let pass=0;pass<20;pass++){
    let changed=false;
    for(let i=0;i<teams.length;i++){
      const team=teams[i];
      for(let j=0;j<team.length;j++){
        const player=team[j];
        if(!teamHasBanned(team,player.name))continue;
        let swapped=false;
        for(let ti=0;ti<teams.length&&!swapped;ti++){
          if(ti===i)continue;
          const other=teams[ti];
          for(let tj=0;tj<other.length;tj++){
            const candidate=other[tj];
            if(candidate.side!==player.side)continue;
            team[j]=candidate;other[tj]=player;
            const stillClashing=teamHasBanned(team,candidate.name)||teamHasBanned(other,player.name);
            if(!stillClashing){changed=true;swapped=true;break}
            team[j]=player;other[tj]=candidate;
          }
        }
      }
    }
    if(!changed)break;
  }
}
function applyDistribution(idpPool,imePool){
  const res=distributeToTeams(idpPool,imePool);
  state.teams=Array.from({length:TEAM_COUNT},(_,i)=>({name:teamLabel(i),side:'mixed',players:res.teams[i]||[]}));
  return res;
}
async function movePlayerBetweenTeams(fromTeam,fromIdx,toTeam){
  fromTeam=Number(fromTeam);fromIdx=Number(fromIdx);toTeam=Number(toTeam);
  if(!Number.isInteger(fromTeam)||!Number.isInteger(fromIdx)||!Number.isInteger(toTeam)||fromTeam===toTeam)return;
  const source=state.teams[fromTeam],target=state.teams[toTeam];
  if(!source||!target)return;
  const player=source.players[fromIdx];
  if(!player)return;
  const playerName=(typeof player==='object'?player.name:player)||'';
  if(target.players.length<Infinity){
    // There's a free slot in the target team — just move the player there.
    source.players.splice(fromIdx,1);
    target.players.push(player);
  }else{
    // Target team is already full: ask which of its players should swap places,
    // so the faction counts on both teams stay exactly as the admin intends.
    const list=target.players.map((p,idx)=>{
      const n=(typeof p==='object'?p.name:p)||'TBD';
      const s=(typeof p==='object'?p.side:'')||'';
      return `${idx+1}. ${n}${s?` (${s.toUpperCase()})`:''}`;
    }).join('\n');
    const answer=prompt(`${teamLabel(toTeam)} sudah penuh (5/5). Ketik nomor player yang mau ditukar dengan ${playerName}:\n\n${list}`);
    if(answer===null)return;
    const slot=Number(answer)-1;
    if(!Number.isInteger(slot)||slot<0||slot>=target.players.length){
      alert('Nomor tidak valid. Pemindahan dibatalkan.');
      return;
    }
    const displaced=target.players[slot];
    target.players[slot]=player;
    source.players[fromIdx]=displaced;
  }
  state.bracketOrder=[];
  state.winners={};state.scores={};
  await save();
  renderAll();renderParticipantList();
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
async function removeParticipant(side,index){
  const f=String(side).toLowerCase();
  const s=getPool(),arr=f==='idp'?s.idp:s.ime;
  const i=Number(index);
  if(!arr || !Number.isInteger(i) || i<0 || i>=arr.length)return;
  const removed=arr[i];
  arr.splice(i,1);
  state.banned=state.banned.filter(n=>n!==removed);
  applyDistribution(s.idp,s.ime);
  state.bracketOrder=[];
  state.winners={}; state.scores={};
  await save();
  renderAll();renderParticipantList();renderBannedOptions();
}
async function removeAllParticipants(){
  const s=getPool();
  if(!s.idp.length && !s.ime.length){
    alert('Tidak ada player untuk dihapus.');
    return;
  }
  if(!confirm(`Hapus semua ${s.idp.length+s.ime.length} player dari roster?\n\nTeam, bracket order, dan hasil pertandingan akan di-reset.`))return;
  state.pools={idp:[],ime:[]};
  state.banned=[];
  state.teams=Array.from({length:TEAM_COUNT},(_,i)=>({name:teamLabel(i),side:'mixed',players:[]}));
  state.bracketOrder=[];
  state.winners={}; state.scores={};
  await save();
  renderAll();renderParticipantList();renderBannedOptions();
  alert('Semua player berhasil dihapus.');
}
function shuffleArray(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
async function shufflePlayers(){
  const {idp,ime}=getPool();
  const total=idp.length+ime.length;
  if(total<2){
    alert('Minimal 2 player diperlukan untuk mengocok roster.');
    return;
  }
  const btn=document.querySelector('#shufflePlayers');
  if(btn){
    btn.disabled=true;
    btn.classList.add('is-loading');
    btn.dataset.originalText=btn.textContent;
    btn.textContent='⟳ MENGOCOK...';
  }
  try{
    // IME + IDP are intentionally mixed into the same teams.
    // Shuffle must work even when only one faction currently has players.
    const res=applyDistribution(idp,ime);
    state.bracketOrder=[];
    state.winners={};
    state.scores={};
    await save();
    renderAll();
    renderParticipantList();
    const note=document.querySelector('#shuffleNote');
    if(note){
      if(res.impossible){
        note.textContent='Shuffle selesai. Batas Banned Player melebihi jumlah team yang tersedia, sehingga sebagian pasangan banned mungkin masih bertemu.';
        note.classList.add('warn'); note.classList.remove('success');
      }else if(res.conflict){
        note.textContent='Shuffle selesai, tetapi constraint Banned Player belum dapat dipenuhi. Coba KOCOK PLAYER lagi.';
        note.classList.add('warn'); note.classList.remove('success');
      }else{
        note.textContent='Player berhasil dikocok ke team campuran. Roster setiap team diperbarui dan disimpan.';
        note.classList.add('success'); note.classList.remove('warn');
      }
    }
  }finally{
    if(btn){
      btn.disabled=false;
      btn.classList.remove('is-loading');
      btn.textContent=btn.dataset.originalText||'⤨ KOCOK PLAYER';
    }
  }
}
function shuffleBracket(){
  const active=activeTeamIndices();
  if(active.length<2){alert('Minimal 2 team diperlukan untuk mengocok bracket.');return}
  const order=active.slice();
  for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
  state.bracketOrder=order;state.winners={};state.scores={};save();renderAll();
  const note=document.querySelector('#bracketShuffleNote');if(note){note.textContent=`Bracket ${active.length} team berhasil dikocok. Pairing Round 1 diacak tanpa memindahkan roster.`;note.classList.remove('warn');note.classList.add('success')}
}
function renderResults(){
  const el=document.querySelector('#resultGrid');if(!el)return;
  const count=activeTeamIndices().length;
  if(count>=9){
    const g=matchGroups();
    const col=(title,key,cls)=>`<div class="bracket-column ${cls}"><div class="col-title">${title}</div>${g[key].map(m=>`<div class="match-slot" data-match="${m[0]}">${refCard(m,true)}</div>`).join('')}</div>`;
    el.className='result-grid result-bracket result-double-elim';
    el.innerHTML=`<div class="bracket-reference-board double-elim-board admin-double-board"><div class="de-winners">${col('ROUND 1','wb1','de-r1')}${col('ROUND 2','wb2','de-r2')}${col('ROUND 3','wb3','de-r3')}${col('SEMIFINALS','wbsf','de-sf')}${col('FINALS','gf','de-gf')}</div><div class="de-losers">${col('LOSERS ROUND 1','lb1','de-lb1')}${col('LOSERS ROUND 2','lb2','de-lb2')}${col('LOSERS ROUND 3','lb3','de-lb3')}${col('LOSERS ROUND 4','lb4','de-lb4')}${col('LOSERS ROUND 5','lb5','de-lb5')}</div><div class="bracket-lines-ref" aria-hidden="true"></div></div>`;
    el.querySelectorAll('[data-result-win]').forEach(b=>b.onclick=()=>{const k=b.dataset.resultWin,t=b.dataset.resultTeam;if(!t||t==='TBD')return;state.winners[k]=state.winners[k]===t?'':t;invalidate(k);save();renderAll()});
    requestAnimationFrame(()=>drawDoubleElimLines(el.querySelector('.double-elim-board')));
    const gf=g.gf.find(m=>m[0]==='m20'),reset=g.gf.find(m=>m[0]==='m21');
    return;
  }
  const ms=matches(),rounds={};ms.filter(m=>m[0]!=='third').forEach(m=>{const r=m[0].match(/^r(\d+)/)?.[1]||'1';(rounds[r]??=[]).push(m)});const keys=Object.keys(rounds).sort((a,b)=>+a-+b);
  el.className='result-grid result-bracket';
  el.innerHTML=`<div class="bracket-reference-board admin-result-board">${keys.map((r,idx)=>`<div class="bracket-round round-${idx===0?'q':idx===keys.length-1?'g':'s'}" data-round="${r}"><div class="col-title">${['QUARTER FINAL','SEMI FINAL','GRAND FINAL'][idx]||'ROUND '+r}</div>${rounds[r].map(m=>`<div class="match-slot">${refCard(m,true)}</div>`).join('')}</div>`).join('')}</div>`;
  el.querySelectorAll('[data-result-win]').forEach(b=>b.onclick=()=>{const k=b.dataset.resultWin,t=b.dataset.resultTeam;if(!t||t==='TBD')return;state.winners[k]=state.winners[k]===t?'':t;invalidate(k);save();renderAll()});
  requestAnimationFrame(()=>drawPremiumBracketLines(el.querySelector('.bracket-reference-board')));
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
function updateShuffleButton(){const b=document.querySelector('#shufflePlayers');if(!b)return;const s=getPool(),total=s.idp.length+s.ime.length;b.disabled=false;b.title='KOCOK PLAYER akan membagi seluruh player ke team aktif tanpa batas 5 player.';b.textContent='⤨ KOCOK PLAYER'}
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
  document.querySelector('#shufflePlayers')?.addEventListener('click',shufflePlayers); document.querySelector('#removeAllPlayers')?.addEventListener('click',removeAllParticipants);
  document.querySelector('#participantList')?.addEventListener('click',e=>{const b=e.target.closest('[data-remove-player]');if(!b)return;const [side,index]=b.dataset.removePlayer.split(':');if(confirm(`Hapus player ${side}?\n\nPlayer akan dihapus dari roster dan team.`))removeParticipant(side,index)});
  document.querySelector('#adminTeams')?.addEventListener('click',e=>{const b=e.target.closest('[data-remove-player]');if(!b)return;const [side,index]=b.dataset.removePlayer.split(':');const name=b.getAttribute('aria-label')?.replace('Hapus ','')||'player ini';if(confirm(`Hapus ${name} dari roster dan team?\n\nTeam akan dikocok ulang otomatis.`))removeParticipant(side,index)});
  document.querySelector('#adminTeams')?.addEventListener('input',e=>{
    const input=e.target.closest('.admin-move-input');if(!input)return;
    const wrap=input.closest('.admin-move-search');
    const box=wrap?.querySelector('.admin-move-suggestions');if(!box)return;
    const toTeam=Number(wrap.dataset.targetTeam);
    const query=input.value.trim().toLowerCase();
    if(!query){box.innerHTML='';box.classList.remove('show');return;}
    const matches=getPlacedPlayers().filter(p=>p.ti!==toTeam&&p.name.toLowerCase().includes(query)).slice(0,8);
    box.innerHTML=matches.length?matches.map(p=>`<div class="admin-move-suggestion" data-move="${p.ti}:${p.pi}"><b>${esc(p.name)}</b><em class="${p.side}">${p.side?p.side.toUpperCase():''}</em><span>di ${teamLabel(p.ti)}</span></div>`).join(''):`<div class="admin-move-empty">Tidak ditemukan</div>`;
    box.classList.add('show');
  });
  document.querySelector('#adminTeams')?.addEventListener('click',e=>{
    const sug=e.target.closest('.admin-move-suggestion');if(!sug)return;
    const wrap=sug.closest('.admin-move-search');if(!wrap)return;
    const toTeam=wrap.dataset.targetTeam;
    const [fromTeam,fromIdx]=sug.dataset.move.split(':');
    movePlayerBetweenTeams(fromTeam,fromIdx,toTeam);
  });
  document.addEventListener('click',e=>{
    if(e.target.closest('.admin-move-search'))return;
    document.querySelectorAll('.admin-move-suggestions.show').forEach(b=>b.classList.remove('show'));
  });
}
function setupAdminLogin(){
  const gate=document.querySelector('#adminLogin'); if(!gate)return true;
  const stored=getAdminPassword();
  if(stored){ document.body.classList.add('admin-unlocked'); gate.classList.add('hidden'); gate.setAttribute('aria-hidden','true'); }
  const form=document.querySelector('#adminLoginForm'), input=document.querySelector('#adminPassword'), err=document.querySelector('#adminLoginError');
  form?.addEventListener('submit',async e=>{
    e.preventDefault(); const password=input?.value||''; if(!password)return;
    try{
      const r=await fetch(API_STATE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'auth',password})});
      if(!r.ok) throw new Error('Invalid password');
      sessionStorage.setItem('mapendos-admin-password',password);
      document.body.classList.add('admin-unlocked');
      gate.classList.add('hidden'); gate.setAttribute('aria-hidden','true'); if(err)err.textContent='';
      if(typeof setupAdmin==='function') setupAdmin();
      if(typeof setupRosterModal==='function') setupRosterModal();
      if(typeof setupBannedSystem==='function') setupBannedSystem();
      if(typeof bindKillsAdmin==='function') bindKillsAdmin();
      renderAll(); renderParticipantList(); loadRemoteState();
    }catch(_){ if(err)err.textContent='Password salah atau ADMIN_PASSWORD belum dikonfigurasi.'; if(input){input.value='';input.focus();}}
  });
  return !!stored;
}

function setupAdmin(){
  const navButtons=document.querySelectorAll('.admin-sidebar nav button');
  navButtons.forEach(b=>{
    b.onclick=(e)=>{
      e.preventDefault();
      e.stopPropagation();
      navButtons.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      document.querySelectorAll('.admin-view').forEach(v=>v.classList.toggle('active',v.dataset.view===b.dataset.tab));
      document.querySelector('.admin-content')?.scrollTo({top:0,behavior:'smooth'});
    };
  });
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
  const rt=document.querySelector('#resetTournamentData');if(rt)rt.onclick=()=>destructiveReset('reset_tournament','Reset tournament? Semua team, roster, bracket, hasil, dan banned player akan dihapus.',()=>{state.teams=clone(DEFAULT.teams);state.bracketOrder=clone(DEFAULT.bracketOrder);state.scores={};state.winners={};state.banned=[]});
  const ra=document.querySelector('#resetAllData');if(ra)ra.onclick=()=>destructiveReset('reset_all','HAPUS SEMUA DATA? Aksi ini menghapus seluruh data website dari Upstash Redis.',()=>{state=clone(DEFAULT)});
}
function setupPremiumUX(){
  document.documentElement.classList.add('js-ready');
  requestAnimationFrame(()=>document.body.classList.add('page-ready'));
  document.querySelectorAll('a,button').forEach(el=>{
    el.addEventListener('click',()=>{el.classList.remove('ux-pulse');void el.offsetWidth;el.classList.add('ux-pulse')},{passive:true});
  });
  document.querySelectorAll('.match-card-ref,.kill-card,.roster-card,.stream-card,.stat-grid>div').forEach((el,i)=>{
    el.style.setProperty('--reveal-delay',`${Math.min(i,12)*35}ms`);
    el.classList.add('premium-reveal');
  });
}
setupPremiumUX();
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
