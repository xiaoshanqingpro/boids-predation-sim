/* T3 物理哈希(固定种子, §5 要求可复现): 处理/对照 各跑同一修订同一配置 */
import { loadSim, setRandomSeedOverride, physicsHash } from "./jsdom_drive.mjs";
const HTML = process.argv[2] || "掠食竞赛(4).html";
const SEED = Number(process.argv[3] || 11);
const FR = Number(process.argv[4] || 4000);
for (const on of [true, false]) {
  const { SIM, win, sha256 } = await loadSim(HTML, "");
  SIM.setPaused(true);
  setRandomSeedOverride(win, SEED);
  SIM.setGeometry(false); SIM.setN(2000); SIM.setGravity(true); SIM.setRefill(true);
  SIM.setHarrier(on);
  if (SIM.Q) SIM.Q.fill(0);
  for (let i = 0; i < FR; i++) SIM.step();
  console.log(`修订 ${sha256.slice(0, 16)} · 种子 ${SEED} · ${FR} 帧 · 驱逐鸟 ${on ? "开" : "关"}: physicsHash=${physicsHash(SIM)} scores=[${SIM.scores.map(v => v.toFixed(1)).join(",")}] 存活椋鸟 ${SIM.aliveCount}`);
}
