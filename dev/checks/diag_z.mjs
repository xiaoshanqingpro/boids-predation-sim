import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("掠食竞赛.html","utf8");
const cut = html.indexOf('<script type="text/plain"');
const scan = cut > 0 ? html.slice(0, cut) : html;
const code = [...scan.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n;\n");
const grad={addColorStop(){}};
const ctx=new Proxy({},{get:(t,p)=>(p in t?t[p]:(p==="createRadialGradient"||p==="createLinearGradient")?()=>grad:(p==="measureText"?()=>({width:10}):()=>{})),set:(t,p,v)=>(t[p]=v,true)});
const els=new Map();
const d={getElementById:id=>{ if(!els.has(id)) els.set(id,{id,textContent:"",innerHTML:"",value:"2000",checked:false,style:{},classList:{toggle(){}},children:[],appendChild(c){if(c&&c.id)els.set(c.id,c);return c},removeChild(c){return c},getContext:()=>ctx,width:1280,height:720,addEventListener(){},getBoundingClientRect:()=>({width:1280,height:720,left:0,top:0})}); return els.get(id); },
  addEventListener(){}, createElement:()=>({style:{},children:[],appendChild(){},removeChild(){}})};
const sb={document:d,window:{addEventListener(){},removeEventListener(){},location:{search:""}},location:{search:""},performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,console};
vm.createContext(sb); vm.runInContext(code,sb,{filename:"sim.js"});
const SIM=sb.window.SIM;
SIM.setGravity(true); SIM.setView3D(false); SIM.setRefill(false); SIM.setGeometry(false); SIM.setN(2000);
const rows=[];
let zMeanPrev=null, signFlips=0, vzAbsSum=0, vzCnt=0;
for(let f=1; f<=3000; f++){
  SIM.step();
  let s=0,s2=0,c=0,lo=1e9,hi=-1e9;
  for(let i=0;i<SIM.N;i++){ const st=SIM.starling(i); if(!st.alive) continue; const z=st.z; s+=z; s2+=z*z; c++; if(z<lo)lo=z; if(z>hi)hi=z; vzAbsSum+=Math.abs(st.vz||0); vzCnt++; }
  const mean=s/c, sd=Math.sqrt(Math.max(0,s2/c-mean*mean));
  if(f%100===0){
    const zg=SIM.zRange.goose, zs=SIM.zRange.starling;
    let hz=[]; for(let k=0;k<SIM.raptorCount.total;k++) hz.push(SIM.hunter(k).z.toFixed(0));
    rows.push({f, 鸟均: mean.toFixed(0), 鸟SD: sd.toFixed(0), 鸟跨度: (hi-lo).toFixed(0), 雁均: zg?zg.mean.toFixed(0):"-", 猛禽z: hz.join("/")});
  }
  if(zMeanPrev!==null && Math.sign(mean-zMeanPrev)!==0){ if(signFlips>=0){} }
  if(zMeanPrev!==null && ((mean-zMeanPrev>0)!==(zMeanPrev>0))) {}
  zMeanPrev=mean;
}
console.log("帧   鸟均高  鸟SD  鸟跨度  雁均高  猛禽z");
for(const r of rows) console.log(`${String(r.f).padStart(4)} ${String(r.鸟均).padStart(6)} ${String(r.鸟SD).padStart(5)} ${String(r.鸟跨度).padStart(6)} ${String(r.雁均).padStart(6)}   ${r.猛禽z}`);
// 上下波动的量化: 均高的逐帧变化量(小=平稳, 大=整团在起伏)
let s=0,s2=0,c=0; const means=[];
for(let f=0; f<1200; f++){ SIM.step(); let sum=0,n=0; for(let i=0;i<SIM.N;i++){const st=SIM.starling(i); if(st.alive){sum+=st.z;n++;}} means.push(sum/n); }
let dv=0; for(let i=1;i<means.length;i++) dv+=Math.abs(means[i]-means[i-1]);
console.log(`\n鸟均高的逐帧平均变化 = ${(dv/(means.length-1)).toFixed(3)} px/帧 (越小越平稳)`);
console.log(`鸟的 |vz| 平均 = ${(vzAbsSum/vzCnt).toFixed(3)} px/帧`);
const mn=Math.min(...means), mx=Math.max(...means);
console.log(`1200 帧内鸟均高波动范围 = ${(mx-mn).toFixed(0)} px (${mn.toFixed(0)} ~ ${mx.toFixed(0)})`);
