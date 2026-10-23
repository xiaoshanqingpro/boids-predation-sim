import fs from "node:fs"; import vm from "node:vm";
const raw = fs.readFileSync("掠食竞赛.html","utf8");
const code0 = [...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n;\n");
const A_old = "Z[i] = Math.max(FLOOR_Z + 20, Z_INIT + randn() * Z_SPREAD);";
const A_new = "Z[i] = GRAV_ON ? Math.max(FLOOR_Z + 20, Z_INIT + randn() * Z_SPREAD) : 0;";
const B_old = "const dz = (tz === undefined ? f.z : tz) - f.z;   // 旧调用不传 tz -> dz=0 -> 2D 语义";
const B_new = "const dz = GRAV_ON ? ((tz === undefined ? f.z : tz) - f.z) : 0;   // 第8轮修补: 关重力时必须退化为 2D(dz=0)";
function run(code){
  const grad={addColorStop(){}};
  const ctx=new Proxy({},{get:(t,p)=>(p in t?t[p]:(p==="createRadialGradient"||p==="createLinearGradient")?()=>grad:(p==="measureText"?()=>({width:10}):(p==="canvas"?{width:1280,height:720}:()=>{}))),set:(t,p,v)=>(t[p]=v,true)});
  const els=new Map();
  const d={getElementById:id=>{ if(!els.has(id)) els.set(id,{id,textContent:"",innerHTML:"",value:"2000",checked:false,style:{},classList:{toggle(){}},getContext:()=>ctx,width:1280,height:720,addEventListener(){},getBoundingClientRect:()=>({width:1280,height:720,left:0,top:0})}); return els.get(id); },
    addEventListener(){}, createElement:()=>({width:0,height:0,getContext:()=>ctx,style:{}})};
  let s=20261015>>>0;
  const M=Object.create(Math); M.random=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  const sb={document:d,window:{addEventListener(){},removeEventListener(){},innerWidth:1280,innerHeight:720,devicePixelRatio:1},Math:M,performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,console};
  vm.createContext(sb); vm.runInContext(code,sb,{filename:"sim.js"});
  const SIM=sb.window.SIM; SIM.setGeometry(false); SIM.setGravity(false); SIM.setView3D(false); SIM.setN(2000);
  for(let i=0;i<2000;i++) SIM.step();
  const fv=v=>Math.round(v*4096)|0; let h=0x811c9dc5;
  const mix=v=>{ h^=(v>>>0); h=Math.imul(h,0x01000193)>>>0; };
  for(let i=0;i<SIM.N;i++){ const st=SIM.starling(i); if(st.alive){ mix(fv(st.x)); mix(fv(st.y)); mix(fv(st.vx)); mix(fv(st.vy)); } }
  for(let i=0;i<SIM.M;i++){ const g=SIM.goose(i); mix(g.alive?1:0); mix(fv(g.x)); mix(fv(g.y)); }
  for(let i=0;i<3;i++){ const u=SIM.hunter(i); mix(fv(u.x)); mix(fv(u.y)); mix(fv(u.vx)); mix(fv(u.vy)); mix(fv(u.energy)); }
  for(const v of SIM.scores) mix(fv(v));
  return { hash:(h>>>0).toString(16).padStart(8,"0"), kills:SIM.kills.join(","), alive:SIM.aliveCount };
}
const variants = {
  "原样(未修补)": code0,
  "只补 A(z 初始化不消耗随机)": code0.replace(A_old, A_new),
  "只补 B(tryDash 的 dz 守卫)": code0.replace(B_old, B_new),
  "A+B 都补": code0.replace(A_old, A_new).replace(B_old, B_new),
};
for (const [k,c] of Object.entries(variants)) {
  try { const r = run(c); console.log(`  ${k.padEnd(26)} hash=${r.hash} kills=${r.kills} alive=${r.alive}`); }
  catch(e){ console.log(`  ${k.padEnd(26)} ✗ ${e.message}`); }
}
console.log("\n  第 7 轮基准应为 hash=9ae66dff kills=3,5,33 alive=1964");
