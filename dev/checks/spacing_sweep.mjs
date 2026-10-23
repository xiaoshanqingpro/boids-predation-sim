import fs from "node:fs"; import vm from "node:vm";
const base = fs.readFileSync("掠食竞赛.html","utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const noop=()=>{};
function run(code, N, warm, measure){
  const g=new Proxy({},{get:(t,p)=>(p in t?t[p]:(p==="createRadialGradient"||p==="createLinearGradient")?()=>({addColorStop:noop}):noop),set:(t,p,v)=>(t[p]=v,true)});
  const d={getElementById:()=>({textContent:"",innerHTML:"",value:"2000",checked:false,style:{},classList:{toggle:noop},getContext:()=>g,width:1280,height:720,addEventListener:noop,getBoundingClientRect:()=>({width:1280,height:720,left:0,top:0})}),addEventListener:noop,createElement:()=>({width:0,height:0,getContext:()=>g,style:{}})};
  const sb={document:d,window:{},performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,console,navigator:{}};
  vm.createContext(sb); vm.runInContext(code,sb,{filename:"sim.js"});
  const SIM=sb.window.SIM; SIM.setGeometry(false); SIM.setN(N); SIM.setRefill(false);
  for(let i=0;i<warm;i++){ SIM.parkRaptors(-9999,-9999); SIM.step(); }
  const birds=[]; for(let i=0;i<SIM.N;i++){ const s=SIM.starling(i); if(s.alive) birds.push(s); }
  let nn=0,k7=0,c=0; const stride=Math.max(1,Math.floor(birds.length/400));
  for(let i=0;i<birds.length;i+=stride){ const a=birds[i]; const d2=[];
    for(const b of birds){ if(b===a) continue; const dx=b.x-a.x, dy=b.y-a.y; d2.push(dx*dx+dy*dy); }
    d2.sort((x,y)=>x-y); nn+=Math.sqrt(d2[0]); k7+=Math.sqrt(d2[6]); c++; }
  // 群体展布
  let cx=0,cy=0; for(const b of birds){cx+=b.x;cy+=b.y;} cx/=birds.length; cy/=birds.length;
  let spread=0; for(const b of birds) spread+=Math.hypot(b.x-cx,b.y-cy); spread/=birds.length;
  return {nn:nn/c, k7:k7/c, spread, n:birds.length};
}
// 用正则替换(不依赖具体数值), 这样以后改基准也不用改这个脚本
const setSep = (c, v) => c.replace(/const SEP_R2 = [\d.]+ \* [\d.]+;/, `const SEP_R2 = ${v} * ${v};`);
const setPerc = (c, v) => c.replace(/const PERCEPTION = [\d.]+;/, `const PERCEPTION = ${v}.0;`);
const variants = {
  "第6轮基准: SEP=20 PERC=50": setPerc(setSep(base, 20), 50),
  "第7轮(当前): 文件原样":       base,
  "再紧: SEP=9 PERC=32":       setPerc(setSep(base, 9), 32),
  "再紧: SEP=7 PERC=28":       setPerc(setSep(base, 7), 28),
  "SEP=9 + COH 2.6":          setPerc(setSep(base, 9), 32).replace("const COHESION_W = 2.0, ALIGNMENT_W = 1.2;", "const COHESION_W = 2.6, ALIGNMENT_W = 1.5;"),
};
console.log("配置                              最近邻  第7近邻  展布   存活");
for (const [k,c] of Object.entries(variants)) {
  const r = run(c, 2000, 1500, 400);
  console.log(`${k.padEnd(32)} ${r.nn.toFixed(1).padStart(5)}  ${r.k7.toFixed(1).padStart(6)}  ${r.spread.toFixed(0).padStart(5)}  ${r.n}`);
}
