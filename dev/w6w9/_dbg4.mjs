import { loadSim, runFrames } from "./jsdom_drive.mjs";
const path = process.argv[2] || "_w6w9/dbg4.html";
const warm = +(process.argv[3] || 1500);
const n = +(process.argv[4] || 900);
const { SIM, win } = await loadSim(path, "?grav=0");
let s = 2654435761 >>> 0;
win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
SIM.resetFlocks(); SIM.resetPredators();
runFrames(SIM, warm);
const rec = [];
// 逐帧观察: 一旦出现 PROBE 有候选就记录
for (let i = 0; i < n; i++) {
  SIM.step();
  const p = win.__CRPPROBE;
  if (p && p.nIn > 0 && rec.length < 6) rec.push({ i, ...p, cand: win.__CRPVAL, relock: SIM.stats.chainRelock });
}
console.log("CRP 调用", win.__CRP, "cand 查询", win.__CRPCALL);
console.log("__D:", JSON.stringify(win.__D));
for (const r of rec) console.log(JSON.stringify(r));
console.log("last probe:", JSON.stringify(win.__CRPPROBE));
console.log("stats:", JSON.stringify({ relock: SIM.stats.chainRelock, miss: SIM.stats.relockMiss, trig: SIM.stats.chainTriggers }));
