/* T4 附: T1(W6) 链式攻击 独立复核（双臂: 集成 / T1_HARRIER_OFF=1 归因臂）
 * 目的:
 *  ① 用**窗口增量**重新算 per-falcon「单次冲刺 eats 均值」，并同时给出"错误配对"(隼①eats/两隼合计ends)作对照,
 *     以确认 stats.dashEnds(两隼合计) 是否曾把均值系统性除以 2;
 *  ② 复核 T1 判据: dashMaxEats∈[2,8] / eats 均值 ≥2 / EV/次冲刺 ≥1.5 / 隼①净得分>0 种子数 ≥3 / chainGooseEnds ≥1;
 *  ③ 报链终止归因(能量/账单/大餐/打断) 与物理哈希。
 * 用法: node _w6w9/t1_verify_pf.mjs [html] [warm] [frames] [seeds...]
 * 双跑两臂: 内部对每臂各跑一遍完整种子表(内容一次读入, 哈希钉扎)。
 * ==========================================================================*/
import { loadSim, readHtmlCached, setRandomSeedOverride, physicsHash } from "./jsdom_drive.mjs";

const HTML = process.argv[2] || "掠食竞赛(4).html";
const WARM = Number(process.argv[3] || 1500);
const FRAMES = Number(process.argv[4] || 4000);
const SEEDS = process.argv.slice(5).map(Number).filter(Number.isFinite);
const SEED_LIST = SEEDS.length ? SEEDS : [1, 2, 3, 4];
const { sha256 } = readHtmlCached(HTML);
console.log(`=== T1 独立复核(双臂) ===\nhtml=${HTML} sha256=${sha256}\n预热=${WARM} 帧=${FRAMES} 种子=[${SEED_LIST.join(",")}]\n`);

function seedWin(win, seed) { let s = (seed * 2654435761) >>> 0; win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const sum = a => a.reduce((x, y) => x + y, 0);

async function oneRun(seed, harrierOff) {
  const { SIM, win } = await loadSim(HTML, "?grav=0");
  seedWin(win, seed);
  SIM.resetFlocks(); SIM.resetPredators();
  if (harrierOff && typeof SIM.setHarrier === "function") SIM.setHarrier(false);
  for (const k in SIM.stats) if (typeof SIM.stats[k] === "number") SIM.stats[k] = 0;
  for (let i = 0; i < WARM; i++) SIM.step();
  const st = SIM.stats;
  const B = { s0: SIM.scores[0], s1: SIM.scores[1], miss: st.missFalcon,
              e0: st.dashEatsFalcon0 || 0, e1: st.dashEatsFalcon1 || 0,
              n0: st.dashEndsFalcon0 || 0, n1: st.dashEndsFalcon1 || 0, nAll: st.dashEnds || 0,
              cge: st.chainGooseEnds || 0,
              cEnergy: st.chainEnergyEnds || 0, cBudget: st.chainBudgetEnds || 0, cBill: st.chainBillEnds || 0, cInt: st.chainInterrupts || 0 };
  for (let i = 0; i < FRAMES; i++) SIM.step();
  const s = SIM.stats;
  const d = {
    dScore0: SIM.scores[0] - B.s0, dScore1: SIM.scores[1] - B.s1,
    dMiss: s.missFalcon - B.miss,
    dE0: (s.dashEatsFalcon0 || 0) - B.e0, dE1: (s.dashEatsFalcon1 || 0) - B.e1,
    dN0: (s.dashEndsFalcon0 || 0) - B.n0, dN1: (s.dashEndsFalcon1 || 0) - B.n1,
    dNAll: (s.dashEnds || 0) - B.nAll,
    dCGE: (s.chainGooseEnds || 0) - B.cge,
    dEnergy: (s.chainEnergyEnds || 0) - B.cEnergy, dBudget: (s.chainBudgetEnds || 0) - B.cBudget,
    dBill: (s.chainBillEnds || 0) - B.cBill, dInt: (s.chainInterrupts || 0) - B.cInt,
  };
  const dEAll = d.dE0 + d.dE1, dNAll = d.dN0 + d.dN1;
  const r = {
    seed, arm: harrierOff ? "harrierOff" : "integrated",
    dashMaxEats: s.dashMaxEats, chainMaxEats: s.chainMaxEats,
    dE0: d.dE0, dE1: d.dE1, dN0: d.dN0, dN1: d.dN1, dNAll: d.dNAll,
    dScore0: +d.dScore0.toFixed(1), dScore1: +d.dScore1.toFixed(1), dMiss: d.dMiss,
    // 正确口径(窗口增量, per-falcon 对齐)
    eatF0: d.dN0 > 0 ? d.dE0 / d.dN0 : NaN,
    eatF1: d.dN1 > 0 ? d.dE1 / d.dN1 : NaN,
    eatPooled: dNAll > 0 ? dEAll / dNAll : NaN,
    // 错误配对(隼①eats / 两隼合计ends) —— 用于确认"÷2"的成因
    eatBuggy: d.dNAll > 0 ? d.dE0 / d.dNAll : NaN,
    evPooled: d.dNAll > 0 ? (d.dScore0 + d.dScore1 + d.dMiss * 4) / d.dNAll : NaN,
    evF0: d.dN0 > 0 ? (d.dScore0 + d.dMiss * 4) / d.dN0 : NaN,
    dCGE: d.dCGE, termEnergy: d.dEnergy, termBudget: d.dBudget, termBill: d.dBill, termInterrupt: d.dInt,
    hash: physicsHash(SIM), kills: (SIM.kills || []).reduce((a, b) => a + b, 0),
  };
  return r;
}

const out = { integrated: [], harrierOff: [] };
for (const [arm, flag] of [["integrated", false], ["harrierOff", true]]) {
  console.log(`---- 臂: ${arm}${flag ? " (T1_HARRIER_OFF=1, 关 W8 驱逐鸟)" : ""} ----`);
  for (const sd of SEED_LIST) {
    const r = await oneRun(sd, flag);
    out[arm].push(r);
    console.log(`seed ${sd}: dashMaxEats=${r.dashMaxEats} chainMaxEats=${r.chainMaxEats} | eats/冲刺 隼① ${r.eatF0.toFixed(2)}(=${r.dE0}/${r.dN0}) 隼② ${r.eatF1.toFixed(2)}(=${r.dE1}/${r.dN1}) ` +
      `池化 ${r.eatPooled.toFixed(2)} [错误配对 ${r.eatBuggy.toFixed(2)}] | EV/冲刺 池化 ${r.evPooled.toFixed(2)} 隼① ${r.evF0.toFixed(2)} | ` +
      `Δscore 隼① ${r.dScore0} 隼② ${r.dScore1} | chainGooseEnds+${r.dCGE} | 终止: 能量${r.termEnergy} 账单${r.termBill} 预算${r.termBudget} 打断${r.termInterrupt} | phys=${r.hash}`);
  }
}

console.log(`\n=== 汇总(双臂并列) ===`);
for (const arm of ["integrated", "harrierOff"]) {
  const rs = out[arm];
  const eatP = rs.map(r => r.eatPooled), eatF0s = rs.map(r => r.eatF0), eatBug = rs.map(r => r.eatBuggy);
  const evs = rs.map(r => r.evPooled), cge = rs.map(r => r.dCGE), dmax = Math.max(...rs.map(r => r.dashMaxEats));
  const posSeeds = rs.filter(r => r.dScore0 > 0).length;
  console.log(`[${arm}] dashMaxEats(max)=${dmax} ${dmax >= 2 && dmax <= 8 ? "✓∈[2,8]" : "✗"}`);
  console.log(`   单次 eats 均值: 池化各轮 [${eatP.map(v => v.toFixed(2)).join(", ")}] 池化=${mean(eatP).toFixed(2)} ${mean(eatP) >= 2 ? "✓≥2" : "✗<2"}` +
    ` | 隼①各轮 [${eatF0s.map(v => v.toFixed(2)).join(", ")}] 均值=${mean(eatF0s).toFixed(2)} | 错误配对均值=${mean(eatBug).toFixed(2)}`);
  console.log(`   EV/次冲刺: 各轮 [${evs.map(v => v.toFixed(2)).join(", ")}] 池化=${mean(evs).toFixed(2)} ${mean(evs) >= 1.5 ? "✓≥1.5" : "✗<1.5"}`);
  console.log(`   隼①净得分>0 的种子数 = ${posSeeds}/${rs.length} ${posSeeds >= 3 ? "✓" : "✗"}; chainGooseEnds 各轮 [${cge.join(", ")}] 合计 ${sum(cge)} ${sum(cge) >= 1 ? "✓≥1" : "✗"}`);
  console.log(`   链终止归因合计: 能量 ${sum(rs.map(r => r.termEnergy))} / 能量账单 ${sum(rs.map(r => r.termBill))} / 预算 ${sum(rs.map(r => r.termBudget))} / 打断 ${sum(rs.map(r => r.termInterrupt))}`);
  console.log(`   物理哈希: ${rs.map(r => r.hash).join(", ")}`);
}
console.log(`\n修订 sha256 = ${sha256}`);
