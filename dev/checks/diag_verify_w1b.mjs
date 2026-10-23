/* verifier(task-5) 复核 W1b 出生点/边界修复: 逐帧时间序列(最小边界距离)
 * 用法: node _checks\diag_verify_w1b.mjs [html] [frames] */
import { cliHtml, cliFrames, loadSim, worldOf, edgeDist, setup, f1 } from "./accept_lib.mjs";

const HTML = cliHtml(), FRAMES = cliFrames(3000);
const { SIM } = loadSim(HTML);
setup(SIM, { n: 2000, gravity: true, refill: false });
const WI = worldOf(SIM);
console.log(`世界 ${WI.worldW}x${WI.worldH}, 厌恶半径 ${WI.boundR}, clampCount 起始 ${WI.clampCount}`);
const rc = SIM.raptorCount.total;
console.log("出生点: " + Array.from({ length: rc }, (_, k) => { const h = SIM.hunter(k); return `r${k}=(${h.x.toFixed(0)},${h.y.toFixed(0)}) edge=${edgeDist(h.x, h.y, WI.worldW, WI.worldH).toFixed(1)}`; }).join("  "));
let gMin = Infinity, gAt = 0, gWho = "";
for (let f = 1; f <= FRAMES; f++) {
  SIM.step();
  let fm = Infinity, who = "";
  const tag = (sp, i, x, y) => { const e = edgeDist(x, y, WI.worldW, WI.worldH); if (e < fm) { fm = e; who = sp + "#" + i; } };
  for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s.alive) tag("S", i, s.x, s.y); }
  for (let i = 0; i < SIM.M; i++) { const g = SIM.goose(i); if (g.alive) tag("G", i, g.x, g.y); }
  for (let k = 0; k < rc; k++) { const h = SIM.hunter(k); tag("R", k, h.x, h.y); }
  if (fm < gMin) { gMin = fm; gAt = f; gWho = who; }
  if (f <= 5 || f % 500 === 0) {
    const w = worldOf(SIM);
    console.log(`f${f}: 本帧最小边界距离 ${f1(fm)} (${who}) | SIM.minEdgeDist=${f1(w.minEdgeDist)} clamp=${w.clampCount} peak=${f1(w.peakPenetration)} | kills=${SIM.kills.join("/")} alive=${SIM.aliveCount}`);
  }
}
console.log(`全程最小 ${f1(gMin)} @ f${gAt} (${gWho}); clampCount=${worldOf(SIM).clampCount}`);
