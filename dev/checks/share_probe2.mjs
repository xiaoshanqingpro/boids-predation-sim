import fs from "node:fs"; import vm from "node:vm";
const base = fs.readFileSync("掠食竞赛.html","utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const noop=()=>{};
function bench(code,N,steps){
  const g=new Proxy({},{get:(t,p)=>(p in t?t[p]:(p==="createRadialGradient"||p==="createLinearGradient")?()=>({addColorStop:noop}):noop),set:(t,p,v)=>(t[p]=v,true)});
  const d={getElementById:()=>({textContent:"",innerHTML:"",value:"2000",checked:false,style:{},classList:{toggle:noop},getContext:()=>g,width:1280,height:720,addEventListener:noop,getBoundingClientRect:()=>({width:1280,height:720,left:0,top:0})}),addEventListener:noop,createElement:()=>({width:0,height:0,getContext:()=>g,style:{}})};
  const sb={document:d,window:{},performance:{now:()=>Number(process.hrtime.bigint()/1000n)/1000},requestAnimationFrame:()=>0,console};
  vm.createContext(sb); vm.runInContext(code,sb,{filename:"sim.js"});
  const SIM=sb.window.SIM; SIM.setGeometry(false); SIM.setN(N);
  for(let i=0;i<20;i++) SIM.step();
  const t=[]; for(let i=0;i<40;i++){ const t0=performance.now(); SIM.step(); t.push(performance.now()-t0); }
  t.sort((a,b)=>a-b); return t[t.length>>1];
}
const off = (code, anchor) => code.replace("for (let i = 0; i < N; i++) {\n" + anchor, "for (let i = 0; i < 0; i++) {\n" + anchor);
const v = {
  "完整":            base,
  "去掉 6.1":        off(base, "    if (!alive[i]) continue;\n    const c = cellOf("),
  "去掉 6.2":        off(base, "    if (!alive[i]) continue;\n    const xi = P[2*i], yi = P[2*i+1];\n    const cx = clamp("),
  "去掉 6.4":        off(base, "    if (!alive[i]) continue;\n    const xi = P[2*i], yi = P[2*i+1];\n    const vi = 2 * i;"),
  "去掉三段":        off(off(off(base, "    if (!alive[i]) continue;\n    const c = cellOf("), "    if (!alive[i]) continue;\n    const xi = P[2*i], yi = P[2*i+1];\n    const cx = clamp("), "    if (!alive[i]) continue;\n    const xi = P[2*i], yi = P[2*i+1];\n    const vi = 2 * i;"),
};
console.log("补丁生效检查:", Object.entries(v).map(([k,c])=>k+":"+(c!==base||k==="完整"?"ok":"FAIL")).join(" "));
for (const N of [3500, 20000]) {
  const r = {}; for (const [k,c] of Object.entries(v)) r[k] = bench(c, N, 40);
  const full = r["完整"];
  console.log(`\nN=${N}  完整 ${full.toFixed(1)}ms`);
  for (const k of ["去掉 6.1","去掉 6.2","去掉 6.4","去掉三段"])
    console.log(`   ${k}: ${r[k].toFixed(1)}ms  -> 该段占比 ${(100*(full-r[k])/full).toFixed(1)}%`);
}
