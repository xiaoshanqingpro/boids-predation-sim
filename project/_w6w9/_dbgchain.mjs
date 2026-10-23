import { loadSim, runFrames } from "./jsdom_drive.mjs";
const path = process.argv[2] || "掠食竞赛(4).html";
const warm = +(process.argv[3] || 1500);
const n = +(process.argv[4] || 600);
const { SIM, win } = await loadSim(path, "?grav=0");
let s = 2654435761 >>> 0;
win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
SIM.resetFlocks(); SIM.resetPredators();
runFrames(SIM, warm);
const st = SIM.stats;
let prevDash = false, chainStart = 0, log = [];
for (let i = 0; i < n; i++) {
  SIM.step();
  const ci = SIM.chainInfo[0], h = SIM.hunter(0);
  const dashing = ci.dashT > 0 || (ci.chainS || 0) > 0;
  if (h.dashT > 0 && !prevDash) { chainStart = i; log.push([i, "start lock=" + ci.lockIdx + " dashT=" + ci.dashT + " left=" + ci.chainLeft]); }
  if (h.dashT > 0 && i % 2 === 1) log.push([i, "  mid lock=" + ci.lockIdx + " eats=" + ci.chainEats + " dashT=" + ci.dashT + " left=" + ci.chainLeft + " turbo=" + ci.chainTurbo]);
  if (h.dashT === 0 && prevDash) log.push([i, "END eats=" + ci.chainEats + " len=" + (i - chainStart) + " relock=" + st.chainRelock + " goosEnds=" + st.chainGooseEnds]);
  prevDash = h.dashT > 0;
}
console.log(log.slice(-140).map(r => r[0] + " " + r[1]).join("\n"));
console.log("chainRelock=", st.chainRelock, "chainTriggers=", st.chainTriggers, "chainMax=", st.chainMaxEats,
  "chainGooseEnds=", st.chainGooseEnds, "chainInterrupts=", st.chainInterrupts, "relockMiss=", st.relockMiss,
  "dashTooFar=", st.dashTooFar, "dashEnds=", st.dashEnds, "missFalcon=", st.missFalcon);
console.log("chainConst=", JSON.stringify(SIM.chainConst), " falconPolicies p6=", SIM.falconPolicies.map(f => f.normalized[5].toFixed(3)));
