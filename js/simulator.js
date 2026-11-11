import { HISTORY_SECONDS } from "./scenarios.js";

const STEP = 0.025;
const SAMPLE = 0.5;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export class BreathingEngine {
  constructor(scenario) {
    this.scenario=scenario; this.random=mulberry32(scenario.seed); this.t=-HISTORY_SECONDS;
    this.phase=0; this.period=1; this.held=false; this.blend=1; this.amp=1; this.wander=0;
    this.breaths=[]; this.samples=[]; this.nextSample=-HISTORY_SECONDS; this.startBreath();
    const count=Math.round(HISTORY_SECONDS/STEP); for(let i=0;i<count;i++)this.step(STEP); this.t=0;
  }
  randn(){let u=0,v=0;while(!u)u=this.random();while(!v)v=this.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
  pauseAt(t){return this.scenario.pauses.some(p=>t>=p.start&&t<p.start+p.dur+0.4);}
  startBreath(){this.breaths.push(this.t);const rr=Math.max(8,this.scenario.rr(this.t)+this.wander);this.period=clamp((60/rr)*(1+0.05*this.randn()),0.4,5);this.amp=clamp((1.1-0.004*(this.scenario.rr(this.t)-40))*(1+0.08*this.randn()),0.55,1.3);this.phase=0;}
  estimate(t){const b=this.breaths;let n=0,first=0,last=0;for(let i=b.length-1;i>=0&&b[i]>t-10;i--){if(n===0)last=b[i];first=b[i];n++;}const since=t-(b.length?b[b.length-1]:t-60);let rate;if(n>=3)rate=((n-1)/(last-first))*60;else if(n===2)rate=60/(last-first);else rate=60/Math.max(since,1.5);if(since>Math.max(3,1.5*60/Math.max(rate,1)))rate=Math.min(rate,60/since);return rate;}
  breathCountLast10(t=this.t){let n=0;for(let i=this.breaths.length-1;i>=0&&this.breaths[i]>t-10;i--)n++;return n;}
  step(dt){this.t+=dt;const wantsPause=this.pauseAt(this.t);this.wander+=(-this.wander/20)*dt+1.6*Math.sqrt(2*dt/20)*this.randn();if(this.held){if(!wantsPause){this.held=false;this.startBreath();}}else{const advance=(wantsPause&&this.phase>0)?dt/0.45:dt/this.period;this.phase+=advance;if(this.phase>=1){if(wantsPause){this.phase=0;this.held=true;}else this.startBreath();}}this.blend+=((this.held?0:1)-this.blend)*Math.min(1,dt*6);while(this.t>=this.nextSample){this.samples.push({t:this.nextSample,rr:this.estimate(this.t),off:this.scenario.off(this.t),still:this.held,breaths_last_10s:this.breathCountLast10(this.t)});this.nextSample+=SAMPLE;}}
  snapshot(){const sample=this.samples[this.samples.length-1]||{rr:0,off:0,still:false,breaths_last_10s:0};return{live_seconds:Number(this.t.toFixed(2)),timestamp:new Date().toISOString(),rolling_rr_estimate:Number(sample.rr.toFixed(1)),programmed_rr:Number(this.scenario.rr(this.t).toFixed(1)),seesaw_offset:Number(this.scenario.off(this.t).toFixed(2)),no_breaths_observed:Boolean(this.held),breaths_in_last_10_seconds:sample.breaths_last_10s};}
}
const COLORS={};
function readColors(){const css=getComputedStyle(document.documentElement);["ink","muted","line","surface","accent","scene","mattress","rail","seesaw"].forEach(k=>{COLORS[k]=css.getPropertyValue(`--${k}`).trim();});}
function fit(canvas,height){const dpr=window.devicePixelRatio||1,w=canvas.clientWidth,W=Math.round(w*dpr),H=Math.round(height*dpr);if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}return{w,h:height,dpr};}
const G=(x,center,width)=>Math.exp(-Math.pow((x-center)/width,2));
const DEFAULT_SKIN="#a96f50",DEFAULT_SKIN_D="#7d4e36",Y0=205;
function topY(x,chestDelta,abdomenDelta){let h=30+18*G(x,330,110)+10*G(x,470,70);const edge=clamp(Math.min((x-232)/22,(545-x)/30),0,1);h*=Math.sqrt(edge);h+=chestDelta*26*G(x,320,70)+abdomenDelta*30*G(x,440,70);return Y0-h;}
function capsule(ctx,points,width,fill,edge){ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle=edge;ctx.lineWidth=width+3;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.stroke();ctx.strokeStyle=fill;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.stroke();}
export function drawBaby(canvas,engine){
 const width=canvas.clientWidth||630,f=fit(canvas,width*150/630),ctx=canvas.getContext("2d"),scale=f.w*f.dpr/630;
 ctx.setTransform(scale,0,0,scale,-70*scale,-100*scale);ctx.fillStyle=COLORS.scene;ctx.fillRect(68,98,634,154);
 ctx.fillStyle=COLORS.rail;ctx.globalAlpha=.55;for(let x=60;x<710;x+=46)ctx.fillRect(x,112,6,Y0-112);ctx.globalAlpha=1;ctx.fillRect(66,106,638,8);ctx.fillStyle=COLORS.mattress;ctx.fillRect(66,Y0,638,33);ctx.fillStyle=COLORS.rail;ctx.fillRect(66,238,638,12);
 const off=engine.scenario.off(engine.t),wave=p=>{p=((p%1)+1)%1;return .5-.5*Math.cos(2*Math.PI*p);},abdomen=wave(engine.phase)*engine.amp*engine.blend,chest=wave(engine.phase-off)*engine.amp*engine.blend,da=abdomen-.5*engine.blend,dc=chest-.5*engine.blend;
 const a=engine.scenario.appearance||{skin:DEFAULT_SKIN,skinDark:DEFAULT_SKIN_D,cap:"#d6c4b3",blanket:"#c7d8df",style:"cap"},skin=a.skin||DEFAULT_SKIN,skinDark=a.skinDark||DEFAULT_SKIN_D;
 capsule(ctx,[[522,Y0-24],[585,Y0-54],[642,Y0-15]],24,skin,skinDark);
 ctx.fillStyle=a.blanket;ctx.strokeStyle="#879da4";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(496,Y0-20);ctx.quadraticCurveTo(552,Y0-40,608,Y0-28);ctx.lineTo(648,Y0-8);ctx.lineTo(636,Y0+1);ctx.lineTo(520,Y0+1);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle=skin;ctx.strokeStyle=skinDark;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(648,Y0-10,15,9,.2,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.moveTo(232,Y0);for(let x=232;x<=545;x+=3)ctx.lineTo(x,topY(x,dc,da));ctx.lineTo(545,Y0);ctx.closePath();ctx.fillStyle=skin;ctx.fill();ctx.strokeStyle=skinDark;ctx.lineWidth=2;ctx.beginPath();for(let x=232;x<=545;x+=3){if(x===232)ctx.moveTo(x,topY(x,dc,da));else ctx.lineTo(x,topY(x,dc,da));}ctx.stroke();
 ctx.fillStyle="#f1f4f5";ctx.strokeStyle="#b9c6c9";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(522,Y0-19,40,22,0,0,Math.PI*2);ctx.fill();ctx.stroke();capsule(ctx,[[296,Y0-30],[338,Y0-17],[384,Y0-27]],14,skin,skinDark);
 const hx=178,hy=Y0-40;ctx.fillStyle=skin;ctx.strokeStyle=skinDark;ctx.lineWidth=2;ctx.beginPath();ctx.arc(hx,hy,40,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.ellipse(hx+36,hy+10,6,10,0,0,Math.PI*2);ctx.fill();ctx.stroke();
 if(a.style==="cap"){ctx.fillStyle=a.cap;ctx.strokeStyle="#8d7d78";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(hx-36,hy-13);ctx.quadraticCurveTo(hx-27,hy-48,hx+6,hy-39);ctx.quadraticCurveTo(hx+34,hy-34,hx+36,hy-11);ctx.quadraticCurveTo(hx+4,hy-20,hx-36,hy-13);ctx.closePath();ctx.fill();ctx.stroke();}else{ctx.fillStyle=a.cap;ctx.strokeStyle="#76533c";ctx.lineWidth=2;ctx.beginPath();ctx.arc(hx-10,hy-34,8,Math.PI,0);ctx.arc(hx+4,hy-39,9,Math.PI,0);ctx.arc(hx+18,hy-32,7,Math.PI,0);ctx.fill();ctx.stroke();}
 ctx.strokeStyle=skinDark;ctx.lineWidth=2.5;ctx.lineCap="round";ctx.beginPath();ctx.arc(hx-14,hy-6,7,.15*Math.PI,.85*Math.PI);ctx.stroke();ctx.beginPath();ctx.arc(hx+12,hy-6,7,.15*Math.PI,.85*Math.PI);ctx.stroke();ctx.beginPath();ctx.arc(hx-1,hy+16,6,.2*Math.PI,.8*Math.PI);ctx.stroke();ctx.fillStyle=skinDark;ctx.beginPath();ctx.arc(hx-1,hy+4,2.4,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle="#e9f1f3";ctx.lineWidth=3;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(hx-6,hy+7);ctx.lineTo(hx-6,hy+3);ctx.moveTo(hx+4,hy+7);ctx.lineTo(hx+4,hy+3);ctx.stroke();ctx.strokeStyle="#9fb4ba";ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(hx-9,hy+9);ctx.lineTo(hx+7,hy+9);ctx.stroke();
 const tube=p=>{ctx.lineCap="round";ctx.strokeStyle="#8ea6ad";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.bezierCurveTo(p[2],p[3],p[4],p[5],p[6],p[7]);ctx.stroke();ctx.strokeStyle="#e9f1f3";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.bezierCurveTo(p[2],p[3],p[4],p[5],p[6],p[7]);ctx.stroke();};
 tube([hx-10,hy+9,hx-34,hy+16,hx-44,hy+34,hx-70,Y0-5]);tube([hx-70,Y0-5,hx-95,Y0-3,90,Y0-10,40,Y0-8]);
}
export function drawTrace(canvas,engine,baseline){
 const f=fit(canvas,220),ctx=canvas.getContext("2d");ctx.setTransform(f.dpr,0,0,f.dpr,0,0);const W=f.w,L=46,R=W-12,T=12,B=142,plotW=R-L;ctx.clearRect(0,0,W,220);ctx.font="12px Atkinson Hyperlegible, system-ui, sans-serif";
 const Y=v=>B-(clamp(v,0,100)/100)*(B-T),t0=engine.t-HISTORY_SECONDS,X=t=>L+((t-t0)/HISTORY_SECONDS)*plotW;
 ctx.lineWidth=1;ctx.textAlign="right";ctx.textBaseline="middle";for(let v=0;v<=100;v+=20){ctx.strokeStyle=COLORS.line;ctx.globalAlpha=v===0?1:.6;ctx.beginPath();ctx.moveTo(L,Y(v)+.5);ctx.lineTo(R,Y(v)+.5);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=COLORS.muted;ctx.fillText(String(v),L-7,Y(v));}
 const S=engine.samples,sampleWidth=(SAMPLE/HISTORY_SECONDS)*plotW+1;ctx.fillStyle="rgba(122, 88, 201, 0.16)";let pauseLabelDrawn=false;for(const sample of S){if(sample.t<t0-1||!sample.still)continue;ctx.fillRect(X(sample.t)-sampleWidth,T,sampleWidth,B-T);pauseLabelDrawn=true;}
 ctx.setLineDash([5,4]);ctx.strokeStyle=COLORS.muted;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(L,Y(baseline));ctx.lineTo(R,Y(baseline));ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle=COLORS.ink;ctx.lineWidth=2;ctx.lineJoin="round";ctx.beginPath();let started=false;for(const sample of S){if(sample.t<t0-1)continue;const x=X(sample.t),y=Y(sample.rr);if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);}ctx.stroke();
 const last=S[S.length-1];if(last){ctx.strokeStyle=COLORS.accent;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(R,T);ctx.lineTo(R,B);ctx.stroke();ctx.fillStyle=COLORS.accent;ctx.beginPath();ctx.arc(R,Y(last.rr),4.5,0,Math.PI*2);ctx.fill();}
 ctx.textAlign="center";ctx.textBaseline="top";ctx.fillStyle=COLORS.muted;[[-8,"−8 min"],[-6,"−6"],[-4,"−4"],[-2,"−2"],[0,"now"]].forEach(([minute,label])=>{const x=X(engine.t+minute*60);ctx.textAlign=minute===0?"right":"center";ctx.fillText(label,minute===-8?x+18:x,B+8);});
 ctx.textAlign="left";ctx.textBaseline="alphabetic";ctx.fillStyle=COLORS.muted;ctx.fillText("Chest and abdomen out of sync",L,182);const stripY=188,stripH=15;ctx.fillStyle=COLORS.scene;ctx.fillRect(L,stripY,plotW,stripH);ctx.fillStyle=COLORS.seesaw;for(const sample of S){if(sample.t<t0-1)continue;const strength=clamp(sample.off/.5,0,1);if(strength<=.01)continue;ctx.globalAlpha=.12+.88*strength;ctx.fillRect(X(sample.t)-sampleWidth,stripY,sampleWidth,stripH);}ctx.globalAlpha=1;ctx.strokeStyle=COLORS.line;ctx.lineWidth=1;ctx.strokeRect(L+.5,stripY+.5,plotW-1,stripH-1);
 if(pauseLabelDrawn){ctx.fillStyle=COLORS.ink;ctx.font="bold 11px Atkinson Hyperlegible, system-ui, sans-serif";ctx.fillText("No breaths observed",L+5,T+12);}
}
export function refreshCanvasColors(){readColors();}
