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
console.log("computeBackend =", SIM.computeBackend);
console.log("compareGolden 存在 =", typeof SIM.compareGolden, " benchGpu 存在 =", typeof SIM.benchGpu);
try {
  const r = await SIM.compareGolden(120);
  console.log("compareGolden(120) ->", JSON.stringify(r));
} catch (e) {
  console.log("compareGolden(120) 抛错:", e && e.message);
}
// 再确认 CPU goldenRun 本身能跑通(直接调内部接口不可得, 用 step 模拟等价路径)
try {
  const t0=Date.now(); for(let i=0;i<120;i++) SIM.step();
  console.log(`CPU step×120 正常, 耗时 ${Date.now()-t0}ms, aliveCount=${SIM.aliveCount}`);
} catch(e){ console.log("step 抛错:", e.message); }
