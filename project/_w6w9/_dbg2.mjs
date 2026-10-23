import { loadSim, runFrames } from "./jsdom_drive.mjs";
const path = process.argv[2] || "_w6w9/sandbox_T1.html";
const warm = +(process.argv[3] || 1500);
const n = +(process.argv[4] || 200);
const { SIM, win } = await loadSim(path, "?grav=0");
let s = 2654435761 >>> 0;
win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
SIM.resetFlocks(); SIM.resetPredators();
runFrames(SIM, warm);
let prev = SIM.hunter(0).dashT;
for (let i = 0; i < n; i++) {
  SIM.step();
  const h = SIM.hunter(0);
  const ci = SIM.chainInfo[0];
  if (h.dashT !== prev || i < 6) {
    console.log(i, "dashT", prev, "->", h.dashT, "| const.chainLeft", ci.chainLeft, "chainEats", ci.chainEats,
      "lock", ci.lockIdx, "dashEats", ci.dashEats, "dashS", ci.dashS, "turbo", ci.chainTurbo, "rawLeft", SIM.chainInfo[0].chainLeft);
  }
  prev = h.dashT;
}
console.log("stats:", JSON.stringify({ relock: SIM.stats.chainRelock, trig: SIM.stats.chainTriggers, goos: SIM.stats.chainGooseEnds, inter: SIM.stats.chainInterrupts, miss: SIM.stats.relockMiss, far: SIM.stats.dashTooFar }));
