/* T1(W6) 隼链式攻击 无头验收探针
 * 用法: node _w6w9/t1_run.mjs "<html>" [warm] [frames] [seed...]
 * 口径: loadSim(?grav=0) -> 固定种子(覆盖 win.Math.random) -> 预热 warm 帧 -> 跑 frames 帧.
 * 注意: resetFlocks/resetPredators 会消费随机流, 所以固定种子必须在重置之前安装。
 */
import { loadSim, physicsHash, runFrames } from "./jsdom_drive.mjs";

const SCORE_STARLING = 3, SCORE_GOOSE = 100, MISS_FALCON = 4;

function seedWin(win, seed) {
  let s = (seed * 2654435761) >>> 0;
  win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export async function oneRun(seed, warmF, framesF, path) {
  const { SIM, win } = await loadSim(path, "?grav=0");
  seedWin(win, seed);
  SIM.resetFlocks(); SIM.resetPredators();
  /* T1_HARRIER_OFF=1: 关掉 T3(W8) 驱逐鸟, 用于把"链式攻击自身的收益"与
   * "驱逐鸟压力 debuff 对隼狩猎效率的压制"分离归因(不是验收对照组, 只是归因实验)。 */
  if (process.env.T1_HARRIER_OFF === "1" && typeof SIM.setHarrier === "function") SIM.setHarrier(false);
  for (const k in SIM.stats) if (typeof SIM.stats[k] === "number") SIM.stats[k] = 0;
  runFrames(SIM, warmF);

  const st = SIM.stats;
  const base = {
    score0: SIM.scores[0], score1: SIM.scores[1],
    kills0: SIM.kills[0], kills1: SIM.kills[1],
    killsAll: SIM.kills.reduce((a, b) => a + b, 0),
    missing: st.missFalcon,
    dashEnds: st.dashEnds,
    dashEats0: st.dashEatsFalcon0 !== undefined ? st.dashEatsFalcon0 : (SIM.hunter ? -1 : -1),
    chainGooseEnds: st.chainGooseEnds || 0,
    gooseKills0: SIM.hunter(0).dietGoose !== undefined ? SIM.hunter(0).dietGoose : 0,
  };
  runFrames(SIM, framesF);

  const pe = st.dashEatsFalcon0;          // 隼①在所有冲刺里累计吃到数(T1 新增钩子)
  const out = {
    seed, frames: framesF, warm: warmF, N: SIM.N,
    score0: +SIM.scores[0].toFixed(1),
    score1: +SIM.scores[1].toFixed(1),
    dScore0: +(SIM.scores[0] - base.score0).toFixed(1),
    dScore1: +(SIM.scores[1] - base.score1).toFixed(1),
    dKills0: SIM.kills[0] - base.kills0,
    dKills1: SIM.kills[1] - base.kills1,
    dKillsAll: SIM.kills.reduce((a, b) => a + b, 0) - base.killsAll,
    dashEnds: st.dashEnds,
    dDashEnds: st.dashEnds - base.dashEnds,
    dashEndsF0: st.dashEndsFalcon0,
    dashEndsF1: st.dashEndsFalcon1,
    dMissFalcon: st.missFalcon - base.missing,
    dashMaxEats: st.dashMaxEats,
    dashMaxEatsLocked: st.dashMaxEatsLocked,
    dashMaxEatsFree: st.dashMaxEatsFree,
    dashEats0: pe !== undefined ? pe : null,
    dDashEats0: pe !== undefined ? pe - base.dashEats0 : null,
    chainGooseEnds: st.chainGooseEnds !== undefined ? st.chainGooseEnds : null,
    dChainGooseEnds: st.chainGooseEnds !== undefined ? st.chainGooseEnds - base.chainGooseEnds : null,
    chainRelock: st.chainRelock !== undefined ? st.chainRelock : null,
    chainTriggers: st.chainTriggers !== undefined ? st.chainTriggers : null,
    chainMaxEats: st.chainMaxEats !== undefined ? st.chainMaxEats : null,
    endEnergy: st.chainEnergyEnds, endBudget: st.chainBudgetEnds, endBill: st.chainBillEnds,
    endGoose: st.chainGooseEnds, endInterrupt: st.chainInterrupts,
    chainBill: st.chainBill, 
    dGooseKills0: (SIM.hunter(0).dietGoose || 0) - base.gooseKills0,
    lockedDashes: st.lockedDashes, noLockAborts: st.noLockAborts, mobInterrupts: st.mobInterrupts,
    coneFalconFrames: st.coneFalconFrames,
    dashEndBirds: st.dashEndBirds,
    killsTotal: SIM.kills.reduce((a, b) => a + b, 0),
    hash: physicsHash(SIM),
  };
  /* 单次冲刺 eats 均值: 分母必须是隼①**自己**的冲刺收尾数 —— stats.dashEnds 是两只隼
   * 合计(W6 自曝的测量 bug), 用它会把均值系统性除以 2。 */
  if (out.dashEndsF0 > 0 && out.dashEats0 !== null) out.eatMeanPerDash = +(out.dashEats0 / out.dashEndsF0).toFixed(2);
  else if (out.dDashEnds > 0 && out.dDashEats0 !== null) out.eatMeanPerDash = +(out.dDashEats0 / out.dDashEnds).toFixed(2);
  out.evPerDash = out.dDashEnds > 0
    ? +(((out.dScore0) + out.dMissFalcon * MISS_FALCON) / out.dDashEnds).toFixed(2) : null;
  return out;
}
