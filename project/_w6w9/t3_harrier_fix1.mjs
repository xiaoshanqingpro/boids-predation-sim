/* ============================================================================
 * T3/W8 修正 1: 让驱逐鸟真的"咬得住"目标(命中率 13.9% -> 目标 ≥70%)
 * ----------------------------------------------------------------------------
 * 实测归因(_w6w9/diag_harrier.mjs, 种子 11): 速度只比猛禽巡航快 1.0px/帧, 而出生点
 *   离目标 300~600px -> 前 450 帧都在追(距离一度涨到 800px), 命中率 13.9%。
 *   规格只规定了"重生点在椋鸟群质心外 300px", **出生点与重生方位未规定**。
 * 处置: ① 出生: 直接落在"当前最高分猛禽"身边 90px 的环绕环上(开局分数全 0 -> 隼①);
 *       ② 追击: 距离 > 2×环绕半径 时走**纯追踪**(不再绕环浪费脚程), 近了才绕环站位;
 *       ③ 重生方位: 取"质心 -> 当前点名目标"的方向(仍是质心外 300px, 合规);
 *       ④ 转艏上限 0.14 -> 0.18(必胜鸟/贼鸥的现实敏捷度; 减少换目标时的回头损耗)。
 * 用法: node _w6w9/t3_harrier_fix1.mjs [--apply]
 * ========================================================================== */
import fs from "node:fs";
const P = "掠食竞赛(4).html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const reps = [];
const must = (a, b) => reps.push([a, b]);

must(
  'const HARRIER_MAX_TURN = 0.14;             // 每帧转艏上限(rad): 比隼盘旋 0.07 灵活, 但仍有限',
  'const HARRIER_MAX_TURN = 0.18;             // 每帧转艏上限(rad): 比隼盘旋 0.07 灵活得多(必胜鸟/贼鸥的现实敏捷度),\n' +
  '                                           // 但仍有限 -> 换目标时要花 ~17 帧回头, 不是瞬移'
);

must(
  'function resetHarriers() {\n' +
  '  harriers.length = 0;\n' +
  '  for (let i = 0; i < HARRIER_N; i++) {\n' +
  '    const p = spawnPoint(Math.PI * 0.7 + i * TAU / HARRIER_N, RAPTOR_HOME_R);\n' +
  '    harriers.push(makeHarrier(p.x, p.y, i));\n' +
  '  }\n' +
  '  harrierTarget = null; harrierRespawnSeq = 0; harrierSkuaHits = 0;',
  'function resetHarriers() {\n' +
  '  harriers.length = 0;\n' +
  '  /* 出生点: 直接落在"当前最高分猛禽"身边 90px 的环绕环上(开局分数全 0 -> 取第一只 = 隼①)。\n' +
  '   * 【实测依据】速度只比猛禽巡航快 1.0px/帧: 出生在 300~600px 外时前 450 帧都在追\n' +
  '   * (距离一度涨到 800px), 命中率只有 13.9%; 出生即入环则立刻开始施压。\n' +
  '   * 规格只规定"重生点在椋鸟群质心外 300px", 出生点未规定 -> 这里取射程内落位。 */\n' +
  '  let T0 = null, bs0 = -Infinity;\n' +
  '  for (let i = 0; i < raptors.length; i++) { const r = raptors[i]; if (r.score > bs0) { bs0 = r.score; T0 = r; } }\n' +
  '  for (let i = 0; i < HARRIER_N; i++) {\n' +
  '    const ang = Math.PI * 0.7 + i * TAU / HARRIER_N;\n' +
  '    let p;\n' +
  '    if (T0) p = { x: wrapX(clamp(T0.x + Math.cos(ang) * HARRIER_ORBIT_R, SPAWN_MARGIN, W - SPAWN_MARGIN)),\n' +
  '                  y: wrapY(clamp(T0.y + Math.sin(ang) * HARRIER_ORBIT_R, SPAWN_MARGIN, H - SPAWN_MARGIN)) };\n' +
  '    else p = spawnPoint(ang, RAPTOR_HOME_R);\n' +
  '    harriers.push(makeHarrier(p.x, p.y, i));\n' +
  '  }\n' +
  '  harrierTarget = null; harrierRespawnSeq = 0; harrierSkuaHits = 0;'
);

must(
  'function respawnHarrier(h) {\n' +
  '  harrierRespawnSeq++;\n' +
  '  const ang = harrierRespawnSeq * 2.399963229728653;      // 黄金角: 每次方位错开, 且不消耗随机数\n' +
  '  const p = spawnPoint(ang, HARRIER_RESPAWN_R);           // 椋鸟群质心外 300px',
  'function respawnHarrier(h) {\n' +
  '  harrierRespawnSeq++;\n' +
  '  // 规格: 60 帧后在椋鸟群质心外 300px 重生(距离固定)。方位未规定 -> 取"质心 -> 当前点名目标"\n' +
  '  // 的方向: 否则重生后又得追几百帧(与出生点同一条实测教训)。没有目标时退回黄金角。\n' +
  '  let ang = harrierRespawnSeq * 2.399963229728653;        // 黄金角: 每次方位错开, 且不消耗随机数\n' +
  '  if (harrierTarget) {\n' +
  '    const c0 = flockCenter();\n' +
  '    const ax = harrierTarget.x - c0.x, ay = harrierTarget.y - c0.y;\n' +
  '    if (ax * ax + ay * ay > 1) ang = Math.atan2(ay, ax);\n' +
  '  }\n' +
  '  const p = spawnPoint(ang, HARRIER_RESPAWN_R);           // 椋鸟群质心外 300px'
);

must(
  '    let tx = h.memX, ty = h.memY, hasT = false;\n' +
  '    if (T) {                                       // 环绕点 = 点名目标 + 90px(< 压力半径, 一直咬住)\n' +
  '      h.orbitA += HARRIER_ORBIT_W;\n' +
  '      tx = wrapX(T.x + Math.cos(h.orbitA) * HARRIER_ORBIT_R);\n' +
  '      ty = wrapY(T.y + Math.sin(h.orbitA) * HARRIER_ORBIT_R);\n' +
  '      hasT = true; h.memX = tx; h.memY = ty; h.memT = frame;\n' +
  '    } else if (freshMem(h)) hasT = true;',
  '    let tx = h.memX, ty = h.memY, hasT = false;\n' +
  '    if (T) {\n' +
  '      const tdx = minImageX(T.x - h.x), tdy = minImageY(T.y - h.y);\n' +
  '      if (tdx * tdx + tdy * tdy > (HARRIER_ORBIT_R * 2) * (HARRIER_ORBIT_R * 2)) {\n' +
  '        tx = T.x; ty = T.y;                          // 远: 纯追踪, 别绕环浪费脚程\n' +
  '      } else {                                       // 近: 环绕点 = 目标 + 90px(< 压力半径, 一直咬住)\n' +
  '        h.orbitA += HARRIER_ORBIT_W;\n' +
  '        tx = wrapX(T.x + Math.cos(h.orbitA) * HARRIER_ORBIT_R);\n' +
  '        ty = wrapY(T.y + Math.sin(h.orbitA) * HARRIER_ORBIT_R);\n' +
  '      }\n' +
  '      hasT = true; h.memX = tx; h.memY = ty; h.memT = frame;\n' +
  '    } else if (freshMem(h)) hasT = true;'
);

let bad = 0;
reps.forEach(([a], i) => { const n = t.split(a).length - 1; if (n !== 1) bad++; console.log(`${n === 1 ? "✓" : "✗"} #${i + 1} 命中 ${n} 次 ${a.split(NL)[0].slice(0, 56)}`); });
console.log(`锚点 ${reps.length} 处, 异常 ${bad} 处`);
if (!APPLY) { console.log("(体检模式)"); process.exit(bad ? 1 : 0); }
if (bad) { console.log("不写回"); process.exit(1); }
for (const [a, b] of reps) t = t.split(a).join(b);
fs.writeFileSync(P, t);
console.log(`T3 修正 1 已应用: ${reps.length} 处`);
