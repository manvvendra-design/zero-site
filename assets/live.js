/* Live panels: tap a panel to play its moment (snow, leaves or rain) with sound. Effects and sound are drawn in code. */
(function(){
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let soundOn=true, ac=null, active=null;
const sb=document.getElementById('sound');
if(sb) sb.addEventListener('click',()=>{soundOn=!soundOn;sb.setAttribute('aria-pressed',soundOn);sb.textContent=soundOn?'Sound on':'Sound off';});

function spawn(kind,W,H,o){
  const R=Math.random;
  if(kind==='snow') return {x:R()*W*1.1-W*.05,y:-10,vx:(R()-.3)*W/2400,vy:(0.6+R()*1.2)*H/900,r:(1.2+R()*2.6)*W/1100,life:1,c:'#ffffff'};
  if(kind==='rain') return {x:R()*W*1.2-W*.1,y:-20,vx:-0.35*H/220,vy:(9+R()*5)*H/900,r:(10+R()*16)*H/700,life:1,c:'rgba(225,232,238,.75)'};
  return {x:o[0]*W+(R()-.5)*W*.3,y:o[1]*H+(R()-.5)*H*.15,vx:(R()-.3)*W/1400,vy:(0.4+R()*0.8)*H/1100,r:(3+R()*4)*W/1100,a:R()*6.28,va:(R()-.5)*.12,life:1,
    c:R()<.7?'#9e1a24':(R()<.5?'#c2283a':'#7a1018')};
}
function noiseBuf(len,white){const b=ac.createBuffer(1,ac.sampleRate*len,ac.sampleRate),d=b.getChannelData(0);let l=0;
  for(let i=0;i<d.length;i++){if(white)d[i]=Math.random()*2-1;else{l=(l+0.02*(Math.random()*2-1))/1.02;d[i]=l*3.5;}}return b;}
function sound(kind){
  try{
    ac=ac||new (window.AudioContext||window.webkitAudioContext)();const now=ac.currentTime,len=7;
    const src=ac.createBufferSource();src.buffer=noiseBuf(len,kind==='rain');
    const fl=ac.createBiquadFilter(),gn=ac.createGain(),peak=kind==='rain'?.18:kind==='snow'?.35:.5;
    if(kind==='rain'){fl.type='highpass';fl.frequency.value=1200;}
    else{fl.type='bandpass';fl.Q.value=.8;fl.frequency.setValueAtTime(kind==='snow'?250:300,now);
      fl.frequency.linearRampToValueAtTime(kind==='snow'?600:900,now+2);fl.frequency.linearRampToValueAtTime(350,now+6);}
    gn.gain.setValueAtTime(0,now);gn.gain.linearRampToValueAtTime(peak,now+1.2);gn.gain.setValueAtTime(peak,now+3.8);gn.gain.linearRampToValueAtTime(0,now+6.5);
    src.connect(fl).connect(gn).connect(ac.destination);src.start(now);src.stop(now+len);
    if(kind!=='rain'){const o=ac.createOscillator(),og=ac.createGain();o.type='sine';o.frequency.value=kind==='snow'?174.6:196;
      og.gain.setValueAtTime(0,now+1.6);og.gain.linearRampToValueAtTime(.1,now+1.7);og.gain.exponentialRampToValueAtTime(.0001,now+5.5);
      o.connect(og).connect(ac.destination);o.start(now+1.6);o.stop(now+5.6);}
  }catch(e){}
}
function play(p){
  if(p.classList.contains('playing')) return;
  if(active&&active!==p) active._stop();
  active=p;
  const kind=p.dataset.live, o=(p.dataset.origin||'0.5,0.3').split(',').map(Number), cv=p.querySelector('canvas'), ctx=cv.getContext('2d');
  p.classList.add('playing'); if(soundOn) sound(kind);
  let raf=0, parts=[];
  p._stop=()=>{cancelAnimationFrame(raf);ctx.clearRect(0,0,cv.width,cv.height);p.classList.remove('playing');if(active===p)active=null;};
  if(reduce){setTimeout(p._stop,2500);return;}
  const r=p.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);cv.width=r.width*d;cv.height=r.height*d;
  const W=cv.width,H=cv.height,t0=performance.now(),rate=kind==='rain'?6:kind==='snow'?3:1;
  function frame(ts){
    const el=(ts-t0)/1000;ctx.clearRect(0,0,W,H);
    if(el<4.5&&(kind!=='leaves'||Math.random()<.5))for(let j=0;j<rate;j++)parts.push(spawn(kind,W,H,o));
    for(const q of parts){
      if(kind==='leaves'){q.vx+=Math.sin(el*2+q.y*.01)*.01*W/900;q.x+=q.vx;q.y+=q.vy;q.a+=q.va;}
      else if(kind==='snow'){q.x+=q.vx+Math.sin(el*1.5+q.y*.02)*.4;q.y+=q.vy;}
      else{q.x+=q.vx;q.y+=q.vy;}
      if(el>4)q.life-=.015;
      ctx.save();ctx.globalAlpha=Math.max(0,q.life)*.92;ctx.fillStyle=q.c;ctx.strokeStyle=q.c;
      if(kind==='rain'){ctx.lineWidth=Math.max(1,W/1400);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x+q.vx*q.r/q.vy,q.y+q.r);ctx.stroke();}
      else if(kind==='snow'){ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,6.28);ctx.fill();}
      else{ctx.translate(q.x,q.y);ctx.rotate(q.a);ctx.beginPath();ctx.ellipse(0,0,q.r,q.r*.5,0,0,6.28);ctx.fill();}
      ctx.restore();
      if(kind==='rain'&&q.y>H*.72&&Math.random()<.04){ctx.save();ctx.globalAlpha=.5*q.life;ctx.strokeStyle='#e8eef2';ctx.lineWidth=1;
        ctx.beginPath();ctx.ellipse(q.x,q.y,W*.012,H*.004,0,0,6.28);ctx.stroke();ctx.restore();}
    }
    parts=parts.filter(q=>q.life>0&&q.x>-60&&q.x<W+60&&q.y<H+40);
    if(el<6.5||parts.length)raf=requestAnimationFrame(frame);else p._stop();
  }
  raf=requestAnimationFrame(frame);
}
document.querySelectorAll('.panel').forEach(p=>{
  p.addEventListener('click',()=>play(p));
  p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();play(p);}});
});
})();
