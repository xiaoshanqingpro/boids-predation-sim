/* T3/W8 最终态自检: 该在的在, 该清的清 */
import fs from "node:fs";
const t = fs.readFileSync("掠食竞赛(4).html", "utf8");
const good = [
  "const HARRIER_N = 6;", "const HARRIER_SPEED = 6.0;", 'const HARRIER_COLOR = "90,220,180";',
  "const HARRIER_LOCK_FRAMES = 60;", "const HARRIER_RANGE = 120;", "const HARRIER_LAYER_MAX = 30;",
  "const HARRIER_TURN_PEN = 0.02;", "const HARRIER_DRAIN_PEN = 0.03;",
  "const HARRIER_DIVE_STUN = 12;", "const HARRIER_DIVE_BURN = 0.05;", "const HARRIER_SKUA_BURN = 0.15;",
  "const HARRIER_RECOVER = 20;", "const HARRIER_RESPAWN_FRAMES = 60;", "const HARRIER_RESPAWN_R = 300;",
  "const harriers = [];", "function makeHarrier(", "function resetHarriers(", "function respawnHarrier(",
  "function harrierStep(", "function hTurnPen(", "function hDrainPen(",
  "if (harrierOn) harrierStep();",
  "const hpk = hTurnPen(f);", "const hpk = hTurnPen(E);", "const hpk = hTurnPen(g);",
  "hDrainPen(f)", "hDrainPen(g)", "CIRCLE_TURN * hpk", "0.05 * hpk", "GH_STRIKE_TURN * hpk",
  "harrierDives: 0", "harrierScoreBurned: 0", "harrierDowns: 0", "harrierBumps: 0",
  "get harrierCount()", "get harrierInfo()", "get harrierConst()", "setHarrier(v)",
  'id="cbHarrier"', 'el("harrierLine")', "W8 驱逐鸟", '"驱逐鸟"',
  "resetHarriers();",
];
const bad = [
  "threats.push(harrier", "raptors.push(h)", "const burned = T.score * frac;",
];
let fail = 0;
for (const s of good) { const ok = t.includes(s); if (!ok) fail++; console.log(`${ok ? "✓" : "✗"} 存在: ${s}`); }
for (const s of bad) { const hit = t.includes(s); if (hit) fail++; console.log(`${hit ? "✗ 残留" : "✓ 已清"}: ${s}`); }
console.log(fail ? `自检失败 ${fail} 项` : "自检全通过");
process.exit(fail ? 1 : 0);
