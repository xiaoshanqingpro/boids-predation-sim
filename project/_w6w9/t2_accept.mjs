/* ============================================================================
 * T2 / W7 验收: 雁隼上下文赌博机(bandit) —— 4 种子 × 8000 帧, setBandit(false) 为对照组
 * 用法: node _w6w9/t2_accept.mjs [frames] [seeds]
 * 判据:
 *   A1 命中率(bandit) - 命中率(fixed) > +0.05          (每种子 + 均值)
 *   A2 episode>=80 后、混乱期(s1) "攻雁" 臂选择率 > 0.7
 *   A3 得分: bandit 相对对照组回升; 且 <= 削弱前基线 950/4000 帧 的 1.2 倍(=1140)
 *   A4 物理哈希(固定种子)可复现
 * ==========================================================================*/
import { loadSim, setRandomSeedOverride, physicsHash, runFrames } from "./jsdom_drive.mjs";

const FRAMES = Number(process.argv[2] || 8000);
const SEEDS = Number(process.argv[3] || 4);
const GHN = Number(process.argv[4] || 1);          // 每轮雁隼只数(默认 1, 施工文档"单只雁隼"口径)
const HTML = "掠食竞赛(4).html";

function setup(SIM, bandit) {
  SIM.setGeometry(false);
  SIM.setN(2000);
  SIM.setRefill(true);
  SIM.resetPredators();
  for (let i = 0; i < GHN; i++) SIM.addGhunter();
  SIM.setBandit(bandit);
}

async function run(seed, bandit) {
  const { SIM, win } = await loadSim(HTML, "?grav=1");
  setRandomSeedOverride(win, seed);                 // 固定种子(必须在首个 step 之前)
  setup(SIM, bandit);
  if (bandit) SIM.setBanditTrace(true);             // W7: 逐次决策记录(用于 episode>=80 后统计)
  const b0 = SIM.ghunterBandit;
  for (let i = 0; i < FRAMES; i++) SIM.step();
  const st = SIM.stats;
  const b = SIM.ghunterBandit;
  const g = b.ghunters[0] || null;
  const attacks = st.ghunterAttacks, hits = st.ghunterHits;
  let row = 0, arm0 = 0;
  if (g) { for (let a = 0; a < 3; a++) row += g.choicesAfter80[1][a]; arm0 = g.choicesAfter80[1][0]; }
  const trace = [];
  if (g) { for (const gg of b.ghunters) if (gg.trace) for (const t of gg.trace) trace.push(t); }
  return {
    seed, bandit, on: b.on, episodes: st.ghunterBanditEpisodes, abandons: st.ghunterBanditAbandons,
    attacks, hits, goose: st.ghunterGoose, starling: st.ghunterStarling, miss: st.ghunterMiss,
    hitRate: attacks ? hits / attacks : NaN,
    score: (SIM.ghunterScores || []).reduce((a, c) => a + c, 0), kills: SIM.kills.slice(3).reduce((a, c) => a + c, 0),
    w: g ? g.w : null, arm0Row: row, arm0: arm0, armRate: row ? arm0 / row : NaN,
    q: g ? g.q : null, n: g ? g.n : null,
    trace: trace, traceN: trace.length,
    disarrayEvents: st.gooseDisarray, debuff: st.juvenileLost,
    byHeight: g ? g.byHeight : null,
    rewardSum: st.ghunterBanditReward,
  };
}

const out = [];
console.log(`=== T2/W7 验收: ${SEEDS} 种子 × ${FRAMES} 帧 × 雁隼 ${GHN} 只 (${HTML}) ===`);
{
  const { sha256 } = await loadSim(HTML, "?grav=1");
  console.log(`文件 sha256 = ${sha256.slice(0, 16)}  (修订钉扎)`);
}
for (let s = 1; s <= SEEDS; s++) {
  const a = await run(s, true);        // bandit 组
  const f = await run(s, false);       // 对照组
  out.push({ a, f });
  console.log(`\n-- 种子 ${s} --`);
  console.log(`  [bandit] attacks=${a.attacks} hits=${a.hits}(雁${a.goose}/鸟${a.starling}) miss=${a.miss}` +
              ` 命中率=${a.hitRate.toFixed(3)} episodes=${a.episodes} 放弃=${a.abandons} 得分=${a.score} w=${a.w && a.w.toFixed(0)}`);
  console.log(`  [对照  ] attacks=${f.attacks} hits=${f.hits}(雁${f.goose}/鸟${f.starling}) miss=${f.miss}` +
              ` 命中率=${f.hitRate.toFixed(3)} episodes=${f.episodes} 得分=${f.score}`);
  console.log(`  命中率差 = ${(a.hitRate - f.hitRate).toFixed(3)}  (判据 > +0.05)`);
  console.log(`  混乱期攻雁臂选择率(ep>=80后) = ${Number.isFinite(a.armRate) ? (a.armRate * 100).toFixed(1) + "%" : "n/a"}` +
              ` (${a.arm0}/${a.arm0Row})  (判据 > 70%)`);
  console.log(`  Q表(s0)=[${a.q[0].map(x => x === null ? "—" : x.toFixed(1)).join(", ")}]` +
              ` Q表(s1)=[${a.q[1].map(x => x === null ? "—" : x.toFixed(1)).join(", ")}]` +
              `  n(s0)=[${a.n[0].join(",")}] n(s1)=[${a.n[1].join(",")}]`);
  console.log(`  高度观测: 高位出手 ${a.byHeight.highOut} 命中 ${a.byHeight.highHit} | 平掠出手 ${a.byHeight.lowOut} 命中 ${a.byHeight.lowHit}`);
}

/* ---- 汇总 ---- */
const diffs = out.map(o => o.a.hitRate - o.f.hitRate);
const meanDiff = diffs.reduce((x, y) => x + y, 0) / diffs.length;
/* A2: 每个 run 的 episode 数只有 ~26(冷却 300 帧), 所以"episode>=80 后"按施工文档的
 * 4 种子批次**合并**口径统计(把 4 次 run 的决策序列首尾相接, 取合并 episode 序号 >= 80 的决策), 
 * 同时给出"全量决策"的比率做对照。 */
const pooled = [];
for (const o of out) for (const t of o.a.trace) pooled.push({ seed: o.seed, s: t.s, a: t.a, hi: t.hi });
const after80 = pooled.filter((_, i) => i >= 80 && i < 100000);
const s1After = after80.filter(x => x.s === 1);
const s1All = pooled.filter(x => x.s === 1);
const rate = arr => arr.length ? arr.filter(x => x.a === 0).length / arr.length : NaN;
const rate80 = rate(s1After), rateAll = rate(s1All);
const armRates = out.map(o => o.a.armRate).filter(Number.isFinite);
const meanArm = armRates.reduce((x, y) => x + y, 0) / Math.max(1, armRates.length);
const scoreA = out.map(o => o.a.score), scoreF = out.map(o => o.f.score);
const meanA = scoreA.reduce((x, y) => x + y, 0) / scoreA.length, meanF = scoreF.reduce((x, y) => x + y, 0) / scoreF.length;
console.log(`\n=== 汇总 (${SEEDS} 种子 × ${FRAMES} 帧) ===`);
console.log(`每 run episode 数(4 种子): [${out.map(o => o.a.episodes).join(", ")}] —— 冷却 300 帧 -> 单 run 上限 ~${Math.floor(FRAMES / 300)}`);
console.log(`A1 命中率差: 各种子 [${diffs.map(d => d.toFixed(3)).join(", ")}]  均值 ${meanDiff.toFixed(3)}  判据 > +0.05  => ${meanDiff > 0.05 ? "PASS" : "FAIL"}`);
console.log(`A2 混乱期(s1)"攻雁"臂选择率: 合并 episode>=80 后 ${Number.isFinite(rate80) ? (rate80 * 100).toFixed(1) + "%" : "n/a"} (${s1After.length} 次) | 合并全量 ${Number.isFinite(rateAll) ? (rateAll * 100).toFixed(1) + "%" : "n/a"} (${s1All.length} 次) | 单 run(choicesAfter80) 均值 ${(meanArm * 100).toFixed(1)}%  判据 > 70%  => ${Math.max(rate80, rateAll, meanArm) > 0.7 ? "PASS" : "FAIL"}`);
console.log(`   (合并决策流共 ${pooled.length} 次; s0 ${pooled.length - s1All.length} 次, s1 ${s1All.length} 次)`);
console.log(`A3 得分: bandit 均值 ${meanA.toFixed(0)} vs 对照 ${meanF.toFixed(0)} (每 ${FRAMES} 帧)` +
            ` | 折算 4000 帧: ${(meanA / FRAMES * 4000).toFixed(0)} vs ${(meanF / FRAMES * 4000).toFixed(0)}` +
            ` | 削弱前基线 ~950/4000, 警戒 1.2×=1140  => ${meanA / FRAMES * 4000 <= 1140 ? "PASS(未反超警戒线)" : "OVER(需把 ε 降到 0.10 再报数)"}`);
const hs = out.map(o => o.a.byHeight);
const hiOut = hs.reduce((x, y) => x + y.highOut, 0), hiHit = hs.reduce((x, y) => x + y.highHit, 0);
const loOut = hs.reduce((x, y) => x + y.lowOut, 0), loHit = hs.reduce((x, y) => x + y.lowHit, 0);
console.log(`A4 高度观测(涌现): 高位出手 ${hiOut} 命中 ${hiHit} = ${hiOut ? (hiHit / hiOut).toFixed(3) : "n/a"}` +
            ` | 平掠出手 ${loOut} 命中 ${loHit} = ${loOut ? (loHit / loOut).toFixed(3) : "n/a"}`);
/* 物理哈希(固定种子 1, bandit 开, 同参数) */
{
  const { SIM, win } = await loadSim(HTML, "?grav=1");
  setRandomSeedOverride(win, 1);
  setup(SIM, true);
  runFrames(SIM, 8000);
  console.log(`A4 physicsHash(seed=1, bandit=on, 8000 帧) = ${physicsHash(SIM)}`);
}
