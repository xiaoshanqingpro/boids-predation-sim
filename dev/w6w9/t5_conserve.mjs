/* T5 守恒线: (4)?grav=0 与 掠食竞赛_2D.html 固定种子逐位对比(physicsHash)
 * 用法: node _w6w9/t5_conserve.mjs [帧数] [种子,种子,...] */
import { loadSim, setRandomSeedOverride, physicsHash } from "./jsdom_drive.mjs";
const FR = Number(process.argv[2] || 2000);
const SEEDS = (process.argv[3] || "11,22,33").split(",").map(Number);
const Q2 = process.argv[4] !== undefined ? process.argv[4] : "";   // 2D 文件的 query(自检用)

async function run(path, query, seed) {
  const { SIM, win, sha256, errors } = await loadSim(path, query, { fresh: true });
  SIM.setPaused(true);
  setRandomSeedOverride(win, seed);
  SIM.setGeometry(false); SIM.setN(2000); SIM.setRefill(true);
  if (SIM.Q) SIM.Q.fill(0);                     // 加载期可能跑过 rAF 帧 -> 两臂都清成同一起点
  for (let i = 0; i < FR; i++) SIM.step();
  return { hash: physicsHash(SIM), scores: SIM.scores.slice(), kills: SIM.kills.slice(),
           starlings: SIM.aliveCount, geese: SIM.galiveCount, sha: sha256.slice(0, 16), errors: errors.length };
}
console.log(`帧数 ${FR} · 种子 ${SEEDS.join(",")}`);
let bad = 0;
for (const s of SEEDS) {
  const a = await run("掠食竞赛(4).html", "?grav=0", s);
  const b = await run("掠食竞赛_2D.html", Q2, s);
  const same = a.hash === b.hash && JSON.stringify(a.scores) === JSON.stringify(b.scores) &&
               JSON.stringify(a.kills) === JSON.stringify(b.kills) && a.starlings === b.starlings;
  if (!same) bad++;
  console.log(`种子 ${String(s).padStart(3)}: (4)?grav=0 ${a.hash} [${a.scores.join(",")}] 存活 ${a.starlings} | 2D ${b.hash} [${b.scores.join(",")}] 存活 ${b.starlings}  ${same ? "✓ 逐位一致" : "✗ 不一致"}`);
}
console.log(bad ? `✗ ${bad}/${SEEDS.length} 个种子不一致` : `✓ ${SEEDS.length}/${SEEDS.length} 个种子逐位一致`);
process.exit(bad ? 1 : 0);
