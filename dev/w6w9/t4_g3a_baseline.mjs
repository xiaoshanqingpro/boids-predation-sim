/* T4 附: 独立复核"T1(DASH_HOME_K 末制导) 把 G3a 的分母(隼冲刺中转向)抬高"这一因果判断
 * 对照: _w6w9/baseline_T1.html (= 掠食竞赛(3).html, T1 之前) vs 掠食竞赛(4).html
 * 用法: node _w6w9/t4_g3a_baseline.mjs [frames] [seeds]
 * 同一 setup/种子口径; 只读, 不改任何文件。 */
import { loadSim, readHtmlCached, setRandomSeedOverride, physicsHash } from "./jsdom_drive.mjs";

const FRAMES = Number(process.argv[2] || 8000);
const SEEDS = Number(process.argv[3] || 2);
const OLD = "_w6w9/baseline_T1.html", NEW = "掠食竞赛(4).html";
console.log(`old=${OLD} sha=${readHtmlCached(OLD).sha256.slice(0, 16)}  new=${NEW} sha=${readHtmlCached(NEW).sha256.slice(0, 16)}\n`);

const speedOf = h => Math.hypot(h.vx, h.vy, h.vz || 0);
const turnDeg = (h, pv) => {
  if (!pv) return null;
  const sp = speedOf(h); const pn = Math.hypot(pv[0], pv[1]);
  if (sp < 1e-6 || pn < 1e-6) return null;
  let d = Math.abs(Math.atan2(h.vy, h.vx) - Math.atan2(pv[1], pv[0])) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d * 180 / Math.PI;
};
const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const p90 = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * 0.9))] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

async function run(file, seed) {
  const { SIM, win } = await loadSim(file, "?grav=1");
  setRandomSeedOverride(win, seed);
  SIM.setGeometry(false); SIM.setN(2000); SIM.setRefill(true); SIM.resetPredators();
  if (typeof SIM.addGhunter === "function") SIM.addGhunter();
  if (typeof SIM.setBandit === "function") SIM.setBandit(true);
  const rc = SIM.raptorCount.total;
  const kind = []; for (let k = 0; k < rc; k++) kind.push(SIM.hunter(k).kind);
  const gh = kind.indexOf("ghunter");
  const fk = kind.map((k, i) => (k === "falcon" ? i : -1)).filter(i => i >= 0);
  const pv = new Array(rc).fill(null);
  const ghT = [], fT = [];
  for (let f = 0; f < FRAMES; f++) {
    SIM.step();
    for (let k = 0; k < rc; k++) {
      const h = SIM.hunter(k), td = turnDeg(h, pv[k]);
      if ((h.dashT || 0) > 0 && td !== null) { if (k === gh) ghT.push(td); if (fk.includes(k)) fT.push(td); }
      pv[k] = [h.vx, h.vy];
    }
  }
  const st = SIM.stats;
  return { file, seed, ghMean: mean(ghT), fMean: mean(fT), ratio: mean(ghT) / mean(fT),
           ghP90: p90(ghT), fP90: p90(fT), ratioP90: p90(ghT) / p90(fT),
           nGh: ghT.length, nF: fT.length, attacks: st.ghunterAttacks, stall: st.ghunterStallFrames,
           phash: physicsHash(SIM) };
}

const oldR = [], newR = [];
for (let s = 1; s <= SEEDS; s++) {
  const o = await run(OLD, s), n = await run(NEW, s);
  oldR.push(o); newR.push(n);
  console.log(`seed ${s}: [T1前] 隼冲刺转向均值=${o.fMean.toFixed(3)}°/帧(n=${o.nF}) 雁隼=${o.ghMean.toFixed(3)}(n=${o.nGh}) G3a=${o.ratio.toFixed(3)} P90比=${o.ratioP90.toFixed(3)} | `
    + `[T1后] 隼=${n.fMean.toFixed(3)}(n=${n.nF}) 雁隼=${n.ghMean.toFixed(3)}(n=${n.nGh}) G3a=${n.ratio.toFixed(3)} P90比=${n.ratioP90.toFixed(3)}`);
}
console.log(`\n隼冲刺转向均值: T1前 [${oldR.map(r => r.fMean.toFixed(3)).join(", ")}] 中位 ${med(oldR.map(r => r.fMean)).toFixed(3)}` +
  ` | T1后 [${newR.map(r => r.fMean.toFixed(3)).join(", ")}] 中位 ${med(newR.map(r => r.fMean)).toFixed(3)}` +
  ` => 抬升 ${(med(newR.map(r => r.fMean)) / med(oldR.map(r => r.fMean))).toFixed(2)}×`);
console.log(`G3a 均值比: T1前 中位 ${med(oldR.map(r => r.ratio)).toFixed(3)} | T1后 中位 ${med(newR.map(r => r.ratio)).toFixed(3)}`);
console.log(`G3a P90 比: T1前 中位 ${med(oldR.map(r => r.ratioP90)).toFixed(3)} | T1后 中位 ${med(newR.map(r => r.ratioP90)).toFixed(3)}`);
console.log(`雁隼冲刺转向均值: T1前 中位 ${med(oldR.map(r => r.ghMean)).toFixed(3)} | T1后 中位 ${med(newR.map(r => r.ghMean)).toFixed(3)}`);
console.log(`物理哈希: T1前 seed1=${oldR[0].phash} | T1后 seed1=${newR[0].phash}`);
