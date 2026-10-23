/* 最终态锚点自检: 该在的在, 该清的清 */
import fs from "node:fs";
const t = fs.readFileSync("掠食竞赛.html", "utf8");
const good = [
  "const BOUND_F_MAX = 0.60;",
  "const BOUND_CUT_LO = 0.35;",
  "const BOUND_CUT_K = 2.0;",
  "const DASH_BOUND_MARGIN = 40;",
  "const BOUND_FALLBACK = 60;",
  "function boundAversion(",
  "function boundPredOut(",
  "function flockCenter(",
  "function spawnPoint(",
  "const SPAWN_MARGIN = 130;",
  "const FILL_INSET = 120;",
  "kind: h.kind || ",
  "if (boundPredOut(f.x, f.y, dx / n * DASH_SPEED",
  "!boundPredOut(E.x, E.y, dx / dth * EAGLE_DASH",
  "const bd = boundAccel(xi, yi);",
  "o.dashT = Math.min(o.dashT, 1);",
];
const bad = [
  "BOUND_FORCE * k * pen * pen * 9",
  "BOUND_FORCE * pen * pen * 9",
  "boundAccel(xi, yi, V[vi]",
  "boundAccel(xi, yi, V2[2*i]",
  '"隼① FALCON",   W / 2, -40',
  "makeEagle(W * 0.7, H * 0.7",
  "{ x: -PAD - 20",
  "Lx = wrapX(W * 0.3)",
  "f0.x = W / 2; f0.y = inOpen",
];
let fail = 0;
for (const s of good) { const ok = t.includes(s); if (!ok) fail++; console.log(`${ok ? "✓" : "✗"} 存在: ${s}`); }
for (const s of bad) { const hit = t.includes(s); if (hit) fail++; console.log(`${hit ? "✗ 残留" : "✓ 已清"}: ${s}`); }
console.log(fail ? `自检失败 ${fail} 项` : "自检全通过");
process.exit(fail ? 1 : 0);
