import { loadSim, runFrames } from "./jsdom_drive.mjs";
const path = process.argv[2] || "_w6w9/dbg3.html";
const warm = +(process.argv[3] || 1500);
const n = +(process.argv[4] || 900);
const { SIM, win } = await loadSim(path, "?grav=0");
let s = 2654435761 >>> 0;
win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
SIM.resetFlocks(); SIM.resetPredators();
runFrames(SIM, warm);
runFrames(SIM, n);
console.log("__CRP(调用)", win.__CRP, "__CRPCALL(候选查询)", win.__CRPCALL, "__CRPVAL 最后一次 cand", win.__CRPVAL);
console.log("stats:", JSON.stringify({ relock: SIM.stats.chainRelock, miss: SIM.stats.relockMiss, trig: SIM.stats.chainTriggers, goos: SIM.stats.chainGooseEnds }));
console.log("chainConst", JSON.stringify(SIM.chainConst));
// 直接测一测 picker: 把隼搬到鸟群质心再看返回
const ci = SIM.chainInfo[0];
console.log("falcon0 chainInfo", JSON.stringify(ci));
