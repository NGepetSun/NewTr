/* ============================================================
   MAPENDOS — ARENA FX
   Purely additive: creates its own canvas element, reads the
   DOM app.js already renders, and never touches app state.
   ============================================================ */
(function(){
  "use strict";
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- ambient spark particles ---------- */
  function initParticles(){
    if(reduceMotion) return;
    var canvas=document.createElement('canvas');
    canvas.id='arenaFx';
    canvas.setAttribute('aria-hidden','true');
    document.body.insertBefore(canvas, document.body.firstChild);
    var ctx=canvas.getContext('2d');
    var w,h,particles=[];
    function resize(){w=canvas.width=innerWidth;h=canvas.height=innerHeight}
    resize();
    window.addEventListener('resize',resize);
    var count = innerWidth<700?16:34;
    var colors=['255,51,88','154,73,255','255,194,51'];
    for(var i=0;i<count;i++){
      particles.push({
        x:Math.random()*w,y:Math.random()*h,
        r:Math.random()*1.5+.4,
        vy:-(Math.random()*.22+.05),
        vx:(Math.random()-.5)*.1,
        c:colors[i%colors.length],
        a:Math.random()*.45+.15
      });
    }
    function tick(){
      ctx.clearRect(0,0,w,h);
      for(var i=0;i<particles.length;i++){
        var p=particles[i];
        p.x+=p.vx;p.y+=p.vy;
        if(p.y<-10){p.y=h+10;p.x=Math.random()*w}
        if(p.x<-10)p.x=w+10;
        if(p.x>w+10)p.x=-10;
        ctx.beginPath();
        ctx.fillStyle='rgba('+p.c+','+p.a+')';
        ctx.shadowColor='rgba('+p.c+',.8)';
        ctx.shadowBlur=6;
        ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- flip the date banner to a live state on event day ---------- */
  function initLiveBanner(){
    var banner=document.querySelector('.date-banner');
    if(!banner) return;
    var start=new Date('2026-09-12T00:00:00+08:00');
    var end=new Date('2026-09-13T00:00:00+08:00');
    var now=new Date();
    if(now>=start && now<end){
      banner.classList.add('is-live');
      var label=banner.querySelector('span'),strong=banner.querySelector('strong');
      if(label) label.textContent='TOURNAMENT STATUS';
      if(strong) strong.textContent='LIVE TODAY — 12 SEPTEMBER 2026';
    }
  }

  /* ---------- gentle pointer-tilt on HUD cards (idempotent, re-runs safely) ---------- */
  function initTilt(){
    if(reduceMotion) return;
    var sel='.family-card, .roster-card, .stream-card, .match-card-ref, .kill-card';
    var els=document.querySelectorAll(sel);
    for(var i=0;i<els.length;i++){
      var el=els[i];
      if(el.dataset.tiltInit) continue;
      el.dataset.tiltInit='1';
      el.style.willChange='transform';
      el.addEventListener('mousemove',function(e){
        var r=this.getBoundingClientRect();
        var px=(e.clientX-r.left)/r.width-.5, py=(e.clientY-r.top)/r.height-.5;
        this.style.transform='perspective(700px) rotateX('+(-py*6).toFixed(2)+'deg) rotateY('+(px*6).toFixed(2)+'deg) translateY(-3px)';
      });
      el.addEventListener('mouseleave',function(){ this.style.transform=''; });
    }
  }

  function ready(fn){ document.readyState!=='loading' ? fn() : document.addEventListener('DOMContentLoaded',fn); }

  ready(function(){
    initParticles();
    initLiveBanner();
    initTilt();
    /* app.js re-renders roster/bracket/kills panels asynchronously —
       watch for new cards and wire tilt onto them, throttled. */
    var pending=false;
    var mo=new MutationObserver(function(){
      if(pending) return;
      pending=true;
      requestAnimationFrame(function(){ initTilt(); pending=false; });
    });
    mo.observe(document.body,{childList:true,subtree:true});
  });
})();
