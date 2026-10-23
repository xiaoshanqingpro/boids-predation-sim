import fs from "node:fs"; import vm from "node:vm";
function probe(file, query) {
  const code = [...fs.readFileSync(file,"utf8").matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n;\n");
  const grad={addColorStop(){}};
  const ctx=new Proxy({},{get:(t,p)=>(p in t?t[p]:(p==="createRadialGradient"||p==="createLinearGradient")?()=>grad:(p==="measureText"?()=>({width:10}):()=>{})),set:(t,p,v)=>(t[p]=v,true)});
  const els=new Map();
  const d={getElementById:id=>{ if(!els.has(id)) els.set(id,{id,textContent:"",innerHTML:"",value:"2000",checked:false,style:{},classList:{toggle(){}},getContext:()=>ctx,width:1280,height:720,addEventListener(){},getBoundingClientRect:()=>({width:1280,height:720,left:0,top:0})}); return els.get(id); },addEventListener(){},createElement:()=>({width:0,height:0,getContext:()=>ctx,style:{}})};
  let s=20261015>>>0; const M=Object.create(Math); M.random=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  const sb={document:d,window:{addEventListener(){},removeEventListener(){},location:{search:query}},location:{search:query},Math:M,performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,console};
  vm.createContext(sb); vm.runInContext(code,sb,{filename:file});
  const SIM=sb.window.SIM;
  return { gravity: typeof SIM.gravity==="boolean" ? SIM.gravity : "(无钩子)", view: SIM.view3D };
}
for (const q of ["?grav=0","", "?grav=0&view=top"]) {
  console.log(`query="${q}"  v3d=${JSON.stringify(probe("_archive/v3d.html", q))}  fix=${JSON.stringify(probe("_archive/_cv_fix.html", q))}`);
}
// 顺带确认补丁 C 真的写进文件了
const t = fs.readFileSync("_archive/_cv_fix.html","utf8");
console.log("补丁C存在:", /grav=0/.test(t), " 补丁A存在:", /GRAV_ON\) \{                                       \/\/ 第 8 轮修补/.test(t), " 补丁B存在:", /const dz = GRAV_ON \?/.test(t));
