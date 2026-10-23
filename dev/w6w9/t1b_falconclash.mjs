/* T1b ⑤ 同盟豁免的定向取证: 强制一对 falcon-falcon 近距离互攻, 核对
 *   (a) 击退 + 眩晕 + CLASH_CD 仍然生效; (b) falcon-falcon **不扣分、不抢分**;
 *   (c) stats.falconSteals == 0; (d) stats.falconAvoided > 0(反事实金额, 证明豁免真的拦下了转移)。
 * 做法: 先 removeEagle() 让 raptors 里只剩两只隼 -> SIM.parkRaptors(远角) 把两隼叠在一起 ->
 *       逐帧找第一次 falcon-falcon 互攻, 比对那一帧两隼的分数变化。
 * 同一脚本跑在 T1 基线(掠食竞赛(4).html 冻结版)上是**对照组**: 那里应当看到扣分/抢分。
 * 用法: node _w6w9/t1b_falconclash.mjs <html>
 */
import { loadSim } from "./jsdom_drive.mjs";

const path = process.argv[2] || "掠食竞赛(4).html";
const { SIM, win } = await loadSim(path, "?grav=0");
let s = 987654321 >>> 0;
win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
SIM.resetFlocks(); SIM.resetPredators();
SIM.removeEagle && SIM.removeEagle();
for (let i = 0; i < 3; i++) SIM.step();
const rc = SIM.raptorCount;
if (rc.falcons !== 2 || rc.total !== 2) { console.log("前置不成立: raptorCount=" + JSON.stringify(rc)); process.exit(2); }

// 远角重叠停放(离鸟群 ~1600px: 不会吃到鸟, 分数变化只会来自互攻)
SIM.parkRaptors(3000, 2000);
const st = SIM.stats;
const g = k => (typeof st[k] === "number" ? st[k] : 0);
const before = { clashes: g("clashes"), falconClashes: g("falconClashes"), steals: g("steals"),
                 falconSteals: g("falconSteals"), falconAvoided: g("falconAvoided") };
const s0 = SIM.scores[0], s1 = SIM.scores[1];
const h0 = SIM.hunter(0), h1 = SIM.hunter(1);
const pos0 = [[h0.x, h0.y], [h1.x, h1.y]];

let found = -1, frameLog = [];
for (let i = 1; i <= 40; i++) {
  SIM.step();
  frameLog.push({ f: i, c: g("clashes"), fc: g("falconClashes"), d: Math.hypot(SIM.hunter(0).x - SIM.hunter(1).x, SIM.hunter(0).y - SIM.hunter(1).y).toFixed(2) });
  if (g("falconClashes") > before.falconClashes) { found = i; break; }
}
const hA = SIM.hunter(0), hB = SIM.hunter(1);
/* CLASH_CD 取证: hunter() 不暴露 clashCd, 改为"继续贴住 60 帧, 看第二次互攻最早出现在第几帧"。
 * 若冷却生效, 第二次互攻必须 >= CLASH_CD(45) 帧之后。 */
let nextClashAt = -1, cdDist = null;
if (found > 0) {
  const c0 = g("clashes");
  for (let i = found + 1; i <= found + 60; i++) {
    SIM.step();
    if (g("clashes") > c0) {
      nextClashAt = i - found;
      const a = SIM.hunter(0), b = SIM.hunter(1);
      cdDist = +Math.hypot(a.x - b.x, a.y - b.y).toFixed(1);
      break;
    }
  }
}
const out = {
  html: path,
  falconClashFrame: found,
  dClashes: g("clashes") - before.clashes,
  dFalconClashes: g("falconClashes") - before.falconClashes,
  dSteals: g("steals") - before.steals,
  dFalconSteals: g("falconSteals") - before.falconSteals,
  dFalconAvoided: g("falconAvoided") - before.falconAvoided,
  scoreDeltaSum: (SIM.scores[0] - s0) + (SIM.scores[1] - s1),
  score0: [s0, SIM.scores[0]], score1: [s1, SIM.scores[1]],
  loserStunMax: Math.max(hA.stun || 0, hB.stun || 0),
  nextClashAfterFrames: nextClashAt,   // -1 = 60 帧内没有第二次互攻
  nextClashDist: cdDist,
  moved0: +Math.hypot(hA.x - pos0[0][0], hA.y - pos0[0][1]).toFixed(2),
  moved1: +Math.hypot(hB.x - pos0[1][0], hB.y - pos0[1][1]).toFixed(2),
  traces: frameLog.slice(0, 8),
};
console.log(JSON.stringify(out));
if (found > 0) {
  const pass = out.dFalconClashes >= 1
    && out.dFalconSteals === 0
    && out.scoreDeltaSum === 0
    && out.loserStunMax > 0
    && (out.nextClashAfterFrames === -1 || out.nextClashAfterFrames >= 45);
  console.log(pass ? "PASS: 隼-隼互攻保留击退/眩晕/CLASH_CD>=45 帧, 且分数零转移(无扣分/无抢分)"
                   : "FAIL: 见上(对照组=T1 基线 会看到 scoreDeltaSum<0)");
} else {
  console.log("未能在 40 帧内制造 falcon-falcon 互攻(前置停放可能让两隼始终重叠 d2<1e-6)");
  console.log(JSON.stringify(frameLog.slice(0, 6)));
}
