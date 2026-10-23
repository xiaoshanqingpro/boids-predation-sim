import fs from "node:fs"; import vm from "node:vm";
function load(file, gravity) {
  const raw = fs.readFileSync(file, "utf8");
  const code = [...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n;\n");
  const grad={addColorStop(){}};
  const ctx=new Proxy({},{get:(t,p)=>(p in t?t[p]:(p==="createRadialGradient"||p==="createLinearGradient")?()=>grad:(p==="measureText"?()=>({width:10}):(p==="canvas"?{width:1280,height:720}:()=>{}))),set:(t,p,v)=>(t[p]=v,true)});
  const els=new Map();
  const d={getElementById:id=>{ if(!els.has(id)) els.set(id,{id,textContent:"",innerHTML:"",value:"2000",checked:false,style:{},classList:{toggle(){}},getContext:()=>ctx,width:1280,height:720,addEventListener(){},getBoundingClientRect:()=>({width:1280,height:720,left:0,top:0})}); return els.get(id); },
    addEventListener(){}, createElement:()=>({width:0,height:0,getContext:()=>ctx,style:{}})};
  let s=20261015>>>0, count=0;
  const M=Object.create(Math); M.random=()=>{ count++; s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  const sb={document:d,window:{addEventListener(){},removeEventListener(){},innerWidth:1280,innerHeight:720,devicePixelRatio:1,location:{search:process.argv[3]||''}},Math:M,performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,console};
  vm.createContext(sb); vm.runInContext(code,sb,{filename:file});
  const SIM=sb.window.SIM;
  const snap = () => count;
  const afterLoad = snap();
  if (SIM.setGravity) SIM.setGravity(gravity);
  if (SIM.setView3D) SIM.setView3D(false);
  SIM.setGeometry(false);
  const afterGeo = snap();
  SIM.setN(2000);
  const afterSetN = snap();
  if (SIM.setRefill) SIM.setRefill(false);
  return { afterLoad, afterGeo, afterSetN, SIM };
}
const dir="_archive";
for (const [name, file, g] of [["第7轮","round7.html",false],["3D原样","v3d.html",false],["3D+修补","_cv_fix.html",false]]) {
  const r = load(dir+"/"+file, g);
  console.log(`${name.padEnd(8)} 加载后=${String(r.afterLoad).padStart(6)}  setGeometry后=${String(r.afterGeo).padStart(6)}  setN后=${String(r.afterSetN).padStart(6)}   alive=${r.SIM.aliveCount}`);
}
console.log("\n提示: 第7轮 加载后应为 initStarlings(2000×6+1) + initGeese(1) ≈ 12002");
