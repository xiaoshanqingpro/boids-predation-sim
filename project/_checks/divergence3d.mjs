import fs from "node:fs"; import vm from "node:vm";
const dir = "_archive";
function load(file, {gravity=false}={}) {
  const raw = fs.readFileSync(file, "utf8");
  const code = [...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n;\n");
  const grad={addColorStop(){}};
  const ctx=new Proxy({},{get:(t,p)=>(p in t?t[p]:(p==="createRadialGradient"||p==="createLinearGradient")?()=>grad:(p==="measureText"?()=>({width:10}):(p==="canvas"?{width:1280,height:720}:()=>{}))),set:(t,p,v)=>(t[p]=v,true)});
  const els=new Map();
  const d={getElementById:id=>{ if(!els.has(id)) els.set(id,{id,textContent:"",innerHTML:"",value:"2000",checked:false,style:{},classList:{toggle(){}},getContext:()=>ctx,width:1280,height:720,addEventListener(){},getBoundingClientRect:()=>({width:1280,height:720,left:0,top:0})}); return els.get(id); },
    addEventListener(){}, createElement:()=>({width:0,height:0,getContext:()=>ctx,style:{}})};
  let s=20261015>>>0;
  const M=Object.create(Math); M.random=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  const sb={document:d,window:{addEventListener(){},removeEventListener(){},innerWidth:1280,innerHeight:720,devicePixelRatio:1,location:{search:process.argv[3]||''}},Math:M,performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,console};
  vm.createContext(sb); vm.runInContext(code,sb,{filename:file});
  const SIM=sb.window.SIM;
  // 【顺序要紧】先关重力/俯视, 再 setGeometry(它内部会 resetFlocks/resetPredators)——
  // 否则初始化已经按 GRAV_ON=true 消耗过随机数, 事后关重力无法复原种子流。
  if (SIM.setGravity) SIM.setGravity(gravity);
  if (SIM.setView3D) SIM.setView3D(false);
  SIM.setGeometry(false);
  SIM.setN(2000); if (SIM.setRefill) SIM.setRefill(false);
  return SIM;
}
function digest(SIM) {
  const out = [];
  for (let i=0;i<SIM.N;i++){ const s=SIM.starling(i); out.push(s.alive?1:0, Math.round(s.x*4096), Math.round(s.y*4096), Math.round(s.vx*4096), Math.round(s.vy*4096)); }
  for (let i=0;i<SIM.M;i++){ const g=SIM.goose(i); out.push(g.alive?1:0, Math.round(g.x*4096), Math.round(g.y*4096)); }
  for (let i=0;i<3;i++){ const u=SIM.hunter(i); out.push(Math.round(u.x*4096), Math.round(u.y*4096), Math.round(u.vx*4096), Math.round(u.vy*4096), u.energy||0); }
  for (const v of SIM.scores) out.push(Math.round(v*4096));
  return out;
}
function firstDiff(a,b){ for(let i=0;i<Math.max(a.length,b.length);i++) if(a[i]!==b[i]) return i; return -1; }
const r7 = load(dir+"/round7.html", {gravity:false});
const v  = load(process.argv[2] || (dir+"/v3d.html"), {gravity:false});
console.log("被测文件: " + (process.argv[2] || dir+"/v3d.html"));
console.log("帧 0(初始化后)对比:");
const d0 = firstDiff(digest(r7), digest(v));
if (d0 < 0) console.log("  ✓ 初始状态逐位一致(随机流没被 z 初始化打乱)");
else {
  const idx = d0;
  const per = 5, which = Math.floor(idx/per);
  console.log(`  ✗ 第 ${idx} 个分量就不同 -> 椋鸟 #${which} 的 ${["alive","x","y","vx","vy"][idx%per]}(第 0 帧就分叉 = 初始化/随机流)`.replace("椋鸟 #"+which, which < 2000 ? "椋鸟 #"+which : "非椋鸟(雁/猛禽)"));
}
// 逐帧找第一次分叉
let f = 0, found = -1, detail = "";
for (f = 1; f <= 400; f++) {
  r7.step(); v.step();
  const dd = firstDiff(digest(r7), digest(v));
  if (dd >= 0) { found = f;
    const per2 = 5; const w = Math.floor(dd/per2);
    detail = w < 2000 ? `椋鸟 #${w} 的 ${["alive","x","y","vx","vy"][dd%per2]}` : (w < 2000+60 ? `雁 #${w-2000}` : `猛禽/分数 idx=${dd}`);
    break; }
}
console.log(found > 0 ? `第一次分叉: 第 ${found} 帧 (${detail})` : "前 400 帧完全一致");
if (found > 0) {
  const a = digest(r7), b = digest(v); const i = firstDiff(a,b);
  console.log(`  该分量: 第7轮=${a[i]} 三维版=${b[i]} 差=${b[i]-a[i]}`);
}
