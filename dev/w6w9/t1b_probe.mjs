/* T1b(W6b) 隼·配合四件套 验收探针
 * 口径: loadSim(?grav=0) -> 固定种子 -> resetFlocks/resetPredators -> 清零 stats -> 预热 warm -> 测 frames.
 * 与 t1_probe.mjs 同一套种子/预热口径, 便于与 T1 完成版逐项对照。
 * 用法: node _w6w9/t1b_run.mjs <html> [warm] [frames] [seeds...]
 * 环境: T1B_ARM=both|on|off   驱逐鸟开/关(隔离臂判据); T1B_FALCONS=both|2|1  隼编制。
 */
import { loadSim, physicsHash, runFrames } from "./jsdom_drive.mjs";

function seedWin(win, seed) {
  let s = (seed * 2654435761) >>> 0;
  win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const num = k => (typeof k === "number" && Number.isFinite(k) ? k : 0);

export async function oneRun(seed, warmF, framesF, path, opt = {}) {
  const harrier = opt.harrier !== false;          // 默认开(集成臂)
  const nFalcon = opt.falcons || 2;
  const { SIM, win } = await loadSim(path, "?grav=0");
  seedWin(win, seed);
  SIM.resetFlocks(); SIM.resetPredators();
  if (!harrier && typeof SIM.setHarrier === "function") SIM.setHarrier(false);
  while (SIM.raptorCount && SIM.raptorCount.falcons > nFalcon) SIM.removeFalcon();
  for (const k in SIM.stats) if (typeof SIM.stats[k] === "number") SIM.stats[k] = 0;
  runFrames(SIM, warmF);

  const st = SIM.stats;
  const before = {
    kills: SIM.kills.reduce((a, b) => a + b, 0),
    dashEnds: st.dashEnds, dashEndBirds: st.dashEndBirds,
    dashEndsF0: st.dashEndsFalcon0, dashEndsF1: st.dashEndsFalcon1,
    eatsF0: st.dashEatsFalcon0, eatsF1: st.dashEatsFalcon1,
    falconClashes: num(st.falconClashes), falconSteals: num(st.falconSteals),
    sharedPcUses: num(st.sharedPcUses), eventDoubles: num(st.eventDoubles),
    shepherdFrames: num(st.shepherdFrames), evtBiasDashes: num(st.evtBiasDashes),
    steals: st.steals, clashes: st.clashes,
  };

  // 逐帧采样: 每只隼的速度(判"单隼牧羊不异常"的速度方差) + 每帧角色(取证)
  const nRap = SIM.raptorCount.total;
  const spd = [];
  for (let k = 0; k < nRap; k++) spd.push([]);
  let roleHunter = 0, roleAmbush = 0, roleShepherd = 0, lastRoles = null;
  for (let i = 0; i < framesF; i++) {
    SIM.step();
    for (let k = 0; k < nRap; k++) {
      const h = SIM.hunter(k);
      if (h.kind === "falcon") spd[k].push(Math.hypot(h.vx, h.vy));
    }
    if (SIM.t1bInfo !== undefined && SIM.t1bInfo !== null) {
      const inf = SIM.t1bInfo;                    // getter: 直接取值(不是函数)
      for (const r of inf) { if (r.role === "hunter") roleHunter++; else if (r.role === "ambush") roleAmbush++; else roleShepherd++; }
      lastRoles = inf.map(r => r.role);
    }
  }
  const variance = a => {
    if (a.length < 2) return null;
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    return a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length;
  };
  const falconIdx = [];
  for (let k = 0; k < nRap; k++) if (SIM.hunter(k).kind === "falcon") falconIdx.push(k);
  const varByFalcon = falconIdx.map(k => variance(spd[k]));
  const allSpd = falconIdx.reduce((a, k) => a.concat(spd[k]), []);

  const out = {
    seed, warm: warmF, frames: framesF, harrier, nFalcon: SIM.raptorCount.falcons,
    sha: null,
    dKills: SIM.kills.reduce((a, b) => a + b, 0) - before.kills,
    dashEnds: st.dashEnds - before.dashEnds,
    dashEndBirds: st.dashEndBirds - before.dashEndBirds,
    dashEndsF0: st.dashEndsFalcon0 - before.dashEndsF0,
    dashEndsF1: st.dashEndsFalcon1 - before.dashEndsF1,
    eatsF0: st.dashEatsFalcon0 - before.eatsF0,
    eatsF1: st.dashEatsFalcon1 - before.eatsF1,
    chainTriggers: st.chainTriggers, dashMaxEats: st.dashMaxEats,
    falconClashes: num(st.falconClashes) - before.falconClashes,
    falconSteals: num(st.falconSteals) - before.falconSteals,
    sharedPcUses: num(st.sharedPcUses) - before.sharedPcUses,
    eventDoubles: num(st.eventDoubles) - before.eventDoubles,
    shepherdFrames: num(st.shepherdFrames) - before.shepherdFrames,
    evtBiasDashes: num(st.evtBiasDashes) - before.evtBiasDashes,
    steals: st.steals - before.steals,
    clashes: st.clashes - before.clashes,
    spdMean: +(allSpd.reduce((a, b) => a + b, 0) / Math.max(1, allSpd.length)).toFixed(3),
    spdVar: variance(allSpd) === null ? null : +variance(allSpd).toFixed(4),
    roleHunter, roleAmbush, roleShepherd, lastRoles,
    score0: +SIM.scores[0].toFixed(1), score1: SIM.scores.length > 1 ? +SIM.scores[1].toFixed(1) : null,
    hash: physicsHash(SIM),
  };
  out.dashEndBirdsPerDash = out.dashEnds > 0 ? +(out.dashEndBirds / out.dashEnds).toFixed(2) : null;
  out.eatMeanF0 = out.dashEndsF0 > 0 ? +(out.eatsF0 / out.dashEndsF0).toFixed(2) : null;
  return out;
}

export async function runMatrix(path, seeds, warm, frames, arms, falconCfgs) {
  const rows = [];
  for (const harrier of arms) for (const nf of falconCfgs) for (const s of seeds) {
    rows.push(await oneRun(s, warm, frames, path, { harrier, falcons: nf }));
  }
  return rows;
}
