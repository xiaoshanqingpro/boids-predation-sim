/* ============================================================================
 * T4 附: 独立复核 Lead 的两条裁决(不改任何机制, 只读)
 *   ① T2 三项未达标是否为"判据失效":
 *      A1 命中率差 > +0.05 —— 对照组命中率是否贴天花板(数学上不可达)
 *      A2 混乱期(s1)"攻雁"臂选择率 > 0.7 —— s1 状态是否几乎不存在
 *      A3 得分回升 —— 与"削弱前基线 950/4000"是否可比(本版含驱逐鸟按比例蒸发)
 *   ② T1 末制导 vs W4 G3a: 雁隼/隼 冲刺中转向速率均值比, bandit 开/关 对照
 * 用法: node _w6w9/t4_indep_check.mjs [frames] [seeds]
 * 全部运行用同一份内容(jsdom_drive.readHtmlCached 钉扎) + 固定种子。
 * ==========================================================================*/
import { loadSim, readHtmlCached, setRandomSeedOverride, physicsHash } from "./jsdom_drive.mjs";

const FRAMES = Number(process.argv[2] || 8000);
const SEEDS = Number(process.argv[3] || 4);
const HTML = "掠食竞赛(4).html";
const { sha256 } = readHtmlCached(HTML);
console.log(`=== T4 独立复核: A1/A2/A3 + G3a(bandit on/off) ===\nhtml=${HTML}  sha256=${sha256}\n帧数=${FRAMES} 种子=1..${SEEDS}\n`);

const speedOf = h => Math.hypot(h.vx, h.vy, h.vz || 0);
const turnDeg = (h, pv) => {
  if (!pv) return null;
  const sp = speedOf(h), pn = Math.hypot(pv[0], pv[1]);
  if (sp < 1e-6 || pn < 1e-6) return null;
  let d = Math.abs(Math.atan2(h.vy, h.vx) - Math.atan2(pv[1], pv[0])) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d * 180 / Math.PI;
};
const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const p90 = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * 0.9))] : NaN; };

async function run(seed, bandit) {
  const { SIM, win } = await loadSim(HTML, "?grav=1");
  setRandomSeedOverride(win, seed + (bandit ? 0 : 1000));
  SIM.setGeometry(false); SIM.setN(2000); SIM.setRefill(true); SIM.resetPredators(); SIM.addGhunter();
  SIM.setBandit(bandit);
  if (bandit) SIM.setBanditTrace(true);
  const rc = SIM.raptorCount.total;
  const kind = []; for (let k = 0; k < rc; k++) kind.push(SIM.hunter(k).kind);
  const gh = kind.indexOf("ghunter");
  const fk = kind.map((k, i) => (k === "falcon" ? i : -1)).filter(i => i >= 0);
  const pv = new Array(rc).fill(null);
  let ghS = 0, ghN = 0, fS = 0, fN = 0;
  const ghT = [], fT = [];
  let disarrayFrames = 0, stallFrames = 0;
  for (let f = 0; f < FRAMES; f++) {
    SIM.step();
    if (SIM.geeseInfo.disarray > 0) disarrayFrames++;
    const gi = (SIM.ghunterInfo && SIM.ghunterInfo[0]) || null;
    if (gi && gi.stall > 0) stallFrames++;
    for (let k = 0; k < rc; k++) {
      const h = SIM.hunter(k);
      const td = turnDeg(h, pv[k]);
      if ((h.dashT || 0) > 0 && td !== null) {
        if (k === gh) { ghS += td; ghN++; ghT.push(td); }
        if (fk.includes(k)) { fS += td; fN++; fT.push(td); }
      }
      pv[k] = [h.vx, h.vy];
    }
  }
  const st = SIM.stats;
  const b = SIM.ghunterBandit;
  const g = (b && b.ghunters && b.ghunters[0]) || null;
  const attacks = st.ghunterAttacks, hits = st.ghunterHits;
  const choices = (g && g.choices) || null, n = (g && g.n) || null, q = (g && g.q) || null;
  const sum = arr => (arr || []).reduce((x, y) => x + y, 0);
  return {
    seed, bandit, attacks, hits, goose: st.ghunterGoose, starling: st.ghunterStarling, miss: st.ghunterMiss,
    hitRate: attacks ? hits / attacks : NaN,
    episodes: st.ghunterBanditEpisodes, abandons: st.ghunterBanditAbandons,
    score: (SIM.ghunterScores || []).reduce((a, c) => a + c, 0),
    w: g ? g.w : null, q, n, choices, choicesAfter80: g ? g.choicesAfter80 : null,
    disarrayFrames, disarrayEvents: st.gooseDisarray, stallFrames,
    ghMean: ghN ? ghS / ghN : NaN, fMean: fN ? fS / fN : NaN, ratio: (ghN && fN) ? (ghS / ghN) / (fS / fN) : NaN,
    ghP90: p90(ghT), fP90: p90(fT), ratioP90: p90(ghT) / p90(fT), nGh: ghN, nF: fN,
    phash: physicsHash(SIM),
  };
}

const A = [], F = [];
for (let s = 1; s <= SEEDS; s++) {
  const a = await run(s, true), f = await run(s, false);
  A.push(a); F.push(f);
  console.log(`-- 种子 ${s} --`);
  console.log(`  [bandit] attacks=${a.attacks} hits=${a.hits}(雁${a.goose}/鸟${a.starling}) miss=${a.miss} 命中率=${a.hitRate.toFixed(3)} ` +
    `episodes=${a.episodes} 放弃=${a.abandons} 得分=${a.score.toFixed(0)} w=${a.w && a.w.toFixed(0)} 失速帧=${a.stallFrames} disarray帧=${a.disarrayFrames}(事件${a.disarrayEvents})`);
  console.log(`  [对照  ] attacks=${f.attacks} hits=${f.hits}(雁${f.goose}/鸟${f.starling}) miss=${f.miss} 命中率=${f.hitRate.toFixed(3)} 得分=${f.score.toFixed(0)}`);
  console.log(`  命中率差 = ${(a.hitRate - f.hitRate).toFixed(3)} | G3a 比值 bandit=${a.ratio.toFixed(3)} 对照=${f.ratio.toFixed(3)} ` +
    `| G3b(P90) bandit=${a.ratioP90.toFixed(3)} 对照=${f.ratioP90.toFixed(3)}`);
}

const diffs = A.map((a, i) => a.hitRate - F[i].hitRate);
console.log(`\n=== ① T2 三项判据复核 ===`);
console.log(`A1 命中率差: 各种子 [${diffs.map(d => d.toFixed(3)).join(", ")}] 均值 ${mean(diffs).toFixed(3)} (判据 > +0.05)`);
console.log(`   对照组命中率 [${F.map(f => `${f.hits}/${f.attacks}=${f.hitRate.toFixed(3)}`).join(", ")}]`);
console.log(`   对照组贴天花板(=1.000)的种子数 = ${F.filter(f => f.hitRate >= 0.999).length}/${F.length}`);
console.log(`A2 混乱期状态 s1: 访问次数 n(s1) 各种子 [${A.map(a => a.n ? JSON.stringify(a.n[1]) : "n/a").join(", ")}]`);
console.log(`   s1 决策次数(choices[1] 合计) 各种子 [${A.map(a => a.choices ? a.choices[1].reduce((x, y) => x + y, 0) : "n/a").join(", ")}]`);
console.log(`   "攻雁"臂占比(choices[1][0]/s1合计) 各种子 [${A.map(a => a.choices && a.choices[1].reduce((x, y) => x + y, 0) ? (a.choices[1][0] / a.choices[1].reduce((x, y) => x + y, 0)).toFixed(3) : "n/a").join(", ")}]`);
console.log(`   s0 决策次数 [${A.map(a => a.choices ? a.choices[0].reduce((x, y) => x + y, 0) : "n/a").join(", ")}] 其中攻雁占比 [${A.map(a => a.choices && a.choices[0].reduce((x, y) => x + y, 0) ? (a.choices[0][0] / a.choices[0].reduce((x, y) => x + y, 0)).toFixed(3) : "n/a").join(", ")}]`);
console.log(`   Q(s0) 各种子 [${A.map(a => a.q ? "[" + a.q[0].map(x => x === null ? "—" : (+x).toFixed(1)).join(",") + "]" : "n/a").join(", ")}]`);
console.log(`   disarray 帧数合计 ${A.reduce((s, a) => s + a.disarrayFrames, 0)} / ${A.length * FRAMES} 帧; 斩首事件合计 ${A.reduce((s, a) => s + a.disarrayEvents, 0)}`);
console.log(`A3 得分(bandit vs 对照): ${A.map((a, i) => `${a.score.toFixed(0)}/${F[i].score.toFixed(0)}`).join(", ")}`);
console.log(`   均值 ${mean(A.map(a => a.score)).toFixed(0)} vs ${mean(F.map(f => f.score)).toFixed(0)} | 折算 4000 帧: ${(mean(A.map(a => a.score)) / FRAMES * 4000).toFixed(0)} vs ${(mean(F.map(f => f.score)) / FRAMES * 4000).toFixed(0)}`);
console.log(`\n=== ② T1 vs G3a(冲刺中转向速率均值比) ===`);
console.log(`bandit ON : 各轮 [${A.map(a => a.ratio.toFixed(3)).join(", ")}] 中位 ${med(A.map(a => a.ratio)).toFixed(3)} | P90比各轮 [${A.map(a => a.ratioP90.toFixed(3)).join(", ")}] 中位 ${med(A.map(a => a.ratioP90)).toFixed(3)}`);
console.log(`bandit OFF: 各轮 [${F.map(f => f.ratio.toFixed(3)).join(", ")}] 中位 ${med(F.map(f => f.ratio)).toFixed(3)} | P90比各轮 [${F.map(f => f.ratioP90.toFixed(3)).join(", ")}] 中位 ${med(F.map(f => f.ratioP90)).toFixed(3)}`);
console.log(`隼的冲刺中转向均值(deg/帧): ON 各轮 [${A.map(a => a.fMean.toFixed(2)).join(", ")}] OFF 各轮 [${F.map(f => f.fMean.toFixed(2)).join(", ")}]`);
console.log(`雁隼的冲刺中转向均值(deg/帧): ON 各轮 [${A.map(a => a.ghMean.toFixed(2)).join(", ")}] OFF 各轮 [${F.map(f => f.ghMean.toFixed(2)).join(", ")}]`);
console.log(`\n物理哈希(seed=1, bandit=on, ${FRAMES} 帧) = ${A[0].phash}`);
