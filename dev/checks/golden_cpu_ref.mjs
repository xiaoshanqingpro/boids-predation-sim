import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("_checks/_incoming_webgpu.html","utf8");
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const noop=()=>{};
const g=new Proxy({},{get:(t,p)=>(p in t?t[p]:(p==="createRadialGradient"||p==="createLinearGradient")?()=>({addColorStop:noop}):noop),set:(t,p,v)=>(t[p]=v,true)});
const d={getElementById:()=>({textContent:"",innerHTML:"",value:"2000",checked:false,style:{},classList:{toggle:noop},getContext:()=>g,width:1280,height:720,addEventListener:noop,getBoundingClientRect:()=>({width:1280,height:720,left:0,top:0})}),addEventListener:noop,createElement:()=>({width:0,height:0,getContext:()=>g,style:{}})};
const sb={document:d,performance:{now:()=>Number(process.hrtime.bigint()/1000n)/1000},requestAnimationFrame:()=>0,console,navigator:{}};
sb.window=sb; vm.createContext(sb);
vm.runInContext(blocks.join("\n;\n"), sb, {filename:"sim.js"});
const SIM=sb.window.SIM;
// 复刻 compareGolden 的 CPU 半边(goldenRun cpu): seed 0x5EED + parked + 关补充, 为浏览器 GPU 对比提供参照
SIM.setGeometry ? SIM.setGeometry(false) : 0;
if (SIM.setRefill) SIM.setRefill(false);
SIM.setSeed(0x5EED);
SIM.resetFlocks(); SIM.resetPredators();
const park=()=>{ for(let i=0;i<3;i++){ /* parkRaptors 已有钩子 */ } SIM.parkRaptors(-170-40,-170-40); };
const trail=[]; const t0=Date.now();
for(let f=0; f<600; f++){ park(); SIM.step(); if(f%10===0){ const l=SIM.leader; trail.push(l.x, l.y); } }
const ms=Date.now()-t0;
let mvx=0,mvy=0,c=0,sx=0,sy=0;
for(let i=0;i<SIM.N;i++){ const s=SIM.starling(i); if(!s.alive) continue; mvx+=s.vx; mvy+=s.vy; sx+=s.x; sy+=s.y; c++; }
const polar=Math.hypot(mvx,mvy)/c/3.6, mx=sx/c, my=sy/c;
let spread=0; for(let i=0;i<SIM.N;i++){ const s=SIM.starling(i); if(s.alive) spread+=Math.hypot(s.x-mx,s.y-my); }
console.log(`CPU 参照(seed=0x5EED, parked, 600 帧, ${ms}ms):`);
console.log(`  kills=${SIM.kills.reduce((a,b)=>a+b,0)}  aliveCount=${SIM.aliveCount}  polar=${polar.toFixed(4)}  spread=${(spread/c).toFixed(1)}`);
console.log(`  质心轨迹取样(每 10 帧, 前 12 个数)= [${trail.slice(0,12).map(v=>v.toFixed(1)).join(", ")}]`);
