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
  const t=[];
  for(let i=0;i<steps;i++){ const t0=performance.now(); SIM.step(); t.push(performance.now()-t0); }
  t.sort((a,b)=>a-b); return t[t.length>>1];
}
// 只留 CPU-only 其余系统: 把 6.1/6.2/6.4 的 N 循环清空(网格/邻居/积分)
const noBirds = base.replace(/for \(let i = 0; i < N; i\+\+\) \{/g, "for (let i = 0; i < 0; i++) {");
console.log("被清空的 N 循环个数:", (base.match(/for \(let i = 0; i < N; i\+\+\) \{/g)||[]).length);
for (const N of [2000, 20000]) {
  const a = bench(base, N, 40), b = bench(noBirds, N, 40);
  console.log(`N=${String(N).padStart(5)}: 完整 ${a.toFixed(1)}ms  去掉6.1/6.2/6.4后 ${b.toFixed(1)}ms  -> 这三段占 ${(100*(a-b)/a).toFixed(1)}%  (剩余 CPU 系统 ${b.toFixed(1)}ms)`);
}
