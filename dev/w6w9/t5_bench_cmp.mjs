/* T5 bench 对照: 同一进程内交替跑 基线 / 最终 2D, 各 3 轮, 取"每档中位数"的中位数(降低墙钟漂移) */
import { loadSim, setRandomSeedOverride, median } from "./jsdom_drive.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// 脚本在 dev/w6w9/ 下，上溯两级即仓库根；基线用仓库内的第 7 轮 2D 归档（原来指向本机 涌现HTML汇总 目录）。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = process.argv[2] || path.join(ROOT, "project", "_archive", "掠食竞赛-round7-2d.html");
const NEW = process.argv[3] || path.join(ROOT, "掠食竞赛_2D.html");
const Ns = [2000, 20000], ROUNDS = 3, STEPS = 100;

async function one(path, n) {
  const { SIM, win } = await loadSim(path, "", { fresh: true });
  SIM.setPaused(true);
  setRandomSeedOverride(win, 11);
  if (SIM.setGeometry) SIM.setGeometry(false);
  SIM.setN(n);
  if (SIM.setRefill) SIM.setRefill(false);
  const r = SIM.bench(STEPS, [n]);
  return r[0];
}
const res = { base: {}, new: {} };
for (const n of Ns) { res.base[n] = []; res.new[n] = []; }
for (let k = 0; k < ROUNDS; k++) {
  for (const n of Ns) {
    res.base[n].push((await one(BASE, n)).median);
    res.new[n].push((await one(NEW, n)).median);
  }
  console.log(`第 ${k + 1} 轮: ` + Ns.map(n => `N=${n} 基线 ${res.base[n][k].toFixed(2)} / 2D ${res.new[n][k].toFixed(2)}`).join(" | "));
}
console.log("---- 汇总(每档 3 轮的中位数) ----");
for (const n of Ns) {
  const b = median(res.base[n]), v = median(res.new[n]);
  console.log(`N=${n}: 基线 ${b.toFixed(2)}ms · 2D ${v.toFixed(2)}ms · 比值 ${(v / b).toFixed(3)} ${n === 20000 ? (v / b <= 1.2 ? "✓ ≤1.2×" : "✗ >1.2×") : ""}`);
}
process.exit(0);
