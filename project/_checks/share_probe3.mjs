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
  const t=[]; for(let i=0;i<50;i++){ const t0=performance.now(); SIM.step(); t.push(performance.now()-t0); }
  t.sort((a,b)=>a-b); return t[t.length>>1];
}
const P = {
  gridEmpty: c => c.replace("for (let i = 0; i < N; i++) {\n    if (!alive[i]) continue;\n    const c = cellOf(", "for (let i = 0; i < 0; i++) {\n    if (!alive[i]) continue;\n    const c = cellOf("),
  scanZero:  c => c.replace("for (let ox = -1; ox <= 1; ox++)\n      for (let oy = -1; oy <= 1; oy++) {", "for (let ox = 0; ox < 0; ox++)\n      for (let oy = -1; oy <= 1; oy++) {"),
  no62:      c => c.replace("for (let i = 0; i < N; i++) {\n    if (!alive[i]) continue;\n    const xi = P[2*i], yi = P[2*i+1];\n    const cx = clamp(", "for (let i = 0; i < 0; i++) {\n    if (!alive[i]) continue;\n    const xi = P[2*i], yi = P[2*i+1];\n    const cx = clamp("),
  noAll:     c => P.no62(P.gridEmpty(c)),
};
console.log("补丁生效:", Object.entries(P).map(([k,f])=>k+":"+(f(base)!==base?"ok":"FAIL")).join(" "));
for (const N of [3500, 20000]) {
  const full = bench(base,N,50);
  const g0 = bench(P.gridEmpty(base),N,50);      // 网格空 -> 6.1 不跑, 6.2 扫描空转
  const s0 = bench(P.scanZero(base),N,50);       // 网格建, 6.2 的候选扫描清零
  const n62 = bench(P.no62(base),N,50);          // 6.2 整段不跑
  const none = bench(P.noAll(base),N,50);        // 三段都不跑
  console.log(`\nN=${N}  完整 ${full.toFixed(1)}ms`);
  console.log(`   6.1 网格重建本身        ≈ ${(s0-g0).toFixed(1)}ms  (${(100*(s0-g0)/full).toFixed(1)}%)`);
  console.log(`   6.2 候选扫描+选择+求力  ≈ ${(s0-n62).toFixed(1)}ms  (${(100*(s0-n62)/full).toFixed(1)}%)`);
  console.log(`   6.4 积分+事件           ≈ ${(n62-none).toFixed(1)}ms  (${(100*(n62-none)/full).toFixed(1)}%)`);
  console.log(`   其余 CPU 系统           ≈ ${none.toFixed(1)}ms  (${(100*none/full).toFixed(1)}%)`);
  console.log(`   -> 只搬 6.1+6.2 能拿掉  ${(100*(s0-none)/full).toFixed(1)}%`);
}
