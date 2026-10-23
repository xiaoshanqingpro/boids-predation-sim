/* T3 诊断: 驱逐鸟与"当前最高分猛禽"的距离随时间 */
import { loadSim, setRandomSeedOverride } from "./jsdom_drive.mjs";
const HTML = process.argv[2] || "掠食竞赛(4).html";
const SEED = Number(process.argv[3] || 11);
const FR = Number(process.argv[4] || 600);
const { SIM, win } = await loadSim(HTML, "");
SIM.setPaused(true);
setRandomSeedOverride(win, SEED);
SIM.setGeometry(false); SIM.setN(2000); SIM.setGravity(true); SIM.setRefill(true);
SIM.setHarrier(true);
if (SIM.Q) SIM.Q.fill(0);
for (let f = 1; f <= FR; f++) {
  SIM.step();
  if (f % 25 === 0) {
    const sc = SIM.scores;
    let top = 0; for (let i = 1; i < sc.length; i++) if (sc[i] > sc[top]) top = i;
    const H = SIM.hunter(top);
    const hi = SIM.harrierInfo;
    const ds = hi.list.map(h => h.dead > 0 ? "dead" : Math.round(Math.hypot(h.x - H.x, h.y - H.y)));
    console.log(`f${String(f).padStart(4)} top#${top}(${H.kind} score ${H.score.toFixed(0)} dash=${H.dashT > 0 ? 1 : 0}) 目标层 ${hi.targetLayer} | 距离 ${ds.join(",")} | on=${hi.on} alive=${hi.alive}`);
  }
}
