/* ============================================================================
 * 第 4 轮(A~G 之后)四部分改动的行为探针: 雁中心化 / 采样目标 / 隼策略进化 / 借网预警
 * 用法: node _checks/probe4.mjs [帧数] [ES评估期覆盖]
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(here, "..", "掠食竞赛.html"), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const FRAMES = Number(process.argv[2] || 12000);
const ESF = Number(process.argv[3] || 0);

function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "createRadialGradient" || p === "createLinearGradient") return () => grad;
      if (p === "measureText") return () => ({ width: 10 });
      if (p === "canvas") return { width: 1280, height: 720 };
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
const els = new Map();
const documentStub = {
  getElementById(id) {
    if (!els.has(id)) els.set(id, { id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, classList: { toggle() {} }, getContext: makeCtx, width: 250, height: 100, addEventListener() {} });
    return els.get(id);
  },
  addEventListener() {},
};
const sandbox = { document: documentStub, window: {}, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "sim.js" });
const SIM = sandbox.window.SIM;
SIM.setGeometry(false);
if (ESF) SIM.setEvalFrames(ESF);
else SIM.setEvalFrames(300);              // 探针默认缩短评估期, 否则 60 秒才一期

console.log(`跑 ${FRAMES} 帧 (${(FRAMES / 60).toFixed(0)}s 仿真), ES 评估期 = ${ESF || 300} 帧\n`);

let nan = 0, outOf = 0;
let leaderChanges = 0, lastLeader = SIM.geeseInfo.leaderIdx, lastDisarray = 0;
const coneDashEnds = { inCone: 0, total: 0 };
for (let s = 1; s <= FRAMES; s++) {
  SIM.step();
  const gi = SIM.geeseInfo;
  if (gi.leaderIdx !== lastLeader) { leaderChanges++; lastLeader = gi.leaderIdx; }
  if (gi.disarray > 0 && lastDisarray === 0) { /* 混乱开始 */ }
  lastDisarray = gi.disarray;
  if (s % 37 === 0) {
    for (let i = 0; i < 200; i += 7) {
      const b = SIM.starling(i);
      if (b.alive && (!Number.isFinite(b.x) || !Number.isFinite(b.y))) nan++;
    }
    for (let i = 0; i < 60; i++) {
      const g = SIM.goose(i);
      if (g.alive && (!Number.isFinite(g.x) || !Number.isFinite(g.y))) nan++;
    }
    for (let i = 0; i < 3; i++) {
      const h = SIM.hunter(i);
      if (!Number.isFinite(h.x) || !Number.isFinite(h.y)) nan++;
    }
  }
  if (s % 3000 === 0) {
    const st = SIM.stats;
    console.log(`--- ${s} 帧 (${(s / 60).toFixed(0)}s) ---`);
    console.log(`  雁: 领队 #${gi.leaderIdx} (换岗 ${leaderChanges} 次) 混乱 ${gi.disarray} 沮丧 ${gi.debuff} 幼雁 ${gi.juvenileAlive}/${gi.juvenileTotal} 斩首 ${gi.disarrayCount} 存活 ${gi.galiveCount}`);
    console.log(`  借网: 预警 ${gi.alerts} 次, 其中无猛禽 400px 内的误报 ${gi.falseAlerts} 次`);
    console.log(`  锥: 隼锥内帧 ${st.coneFalconFrames} · 鹰锥内失血 ${st.coneEagleDrain} 帧`);
    console.log(`  采样: 冲刺结束 ${st.dashEnds} 次, 终点 80px 内平均可见鸟 ${st.dashEnds ? (st.dashEndBirds / st.dashEnds).toFixed(2) : "-"}, 单次最多吃 锁定${st.dashMaxEatsLocked}/未锁定${st.dashMaxEatsFree}, 无目标放弃 ${st.noLockAborts}`);
    console.log(`  锥验收: 终点锥内 ${st.dashEndInCone} 次, 终点到 V 尖均值 ${st.dashEnds ? (st.dashEndApexSum / st.dashEnds).toFixed(0) : "-"}px, <200px ${st.dashEndApexNear} 次 | 雁尖到最近隼均值 ${st.apexDistSamples ? (st.apexDistSum / st.apexDistSamples).toFixed(0) : "-"}px, <300px ${st.apexClose}/${st.apexDistSamples}`);
    console.log(`  分数 ${SIM.scores.join("/")} 捕获 ${SIM.kills.join("/")} 空冲刺 ${st.missFalcon}/${st.missEagle} 互攻 ${st.clashes}`);
    for (const p of SIM.falconPolicies) {
      console.log(`  隼${p.id + 1} 策略: gen=${p.gen} periods=${p.periods} lastFit=${p.lastFit.toFixed(0)} baseFit=${p.baseFit === -Infinity ? "-Inf" : p.baseFit.toFixed(0)} | dashMin=${p.vals.dashMin.toFixed(1)} lowE=${p.vals.energyLow.toFixed(1)} dbl=${p.vals.doubleTeam.toFixed(1)} ahead=${p.vals.interceptAhead.toFixed(2)} mobTol=${p.vals.mobTol.toFixed(2)}`);
    }
  }
}
console.log(`\nNaN=${nan} 越界=${outOf} 换岗 ${leaderChanges} 次 (每 ${(FRAMES / Math.max(leaderChanges, 1)).toFixed(0)} 帧一次)`);
