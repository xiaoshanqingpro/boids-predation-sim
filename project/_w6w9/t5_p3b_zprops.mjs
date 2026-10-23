/* ============================================================================
 * T5/W9 阶段 3b: 修掉剩余的 z 属性读取(会抛 TypeError 的那些) + 弃用钩子
 * 【纪律】spawnRaptor 里那行 `r2.z = 120 + Math.random() * 100` **必须保留 Math.random()**:
 *   它在基线 (?grav=0) 里也会执行 -> 删掉会改变随机数流, 守恒线立刻不成立。
 *   因此只保留字段写入(不再有任何代码读它), 并在注释里写明原因。
 * 用法: node _w6w9/t5_p3b_zprops.mjs [--apply]
 * ========================================================================== */
import fs from "node:fs";
const P = "掠食竞赛_2D.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const reps = [];
const must = (a, b) => reps.push([a, b]);

/* 1) 入侵: spawnRaptor 的高度字段(保留随机数调用!) */
must(
  '  r2.z = 120 + Math.random() * 100;        // 第 8 轮: 增援从不同高度入场',
  '  r2.z = 120 + Math.random() * 100;        // 【W9 2D】字段已无人读; **保留这行 Math.random()** —— 它在基线\n' +
  '                                           // (?grav=0)里同样执行, 删掉会改变随机数流, 破坏守恒线。'
);
/* 2) tryDash 取证字段 */
must('  f.dashTX = tx; f.dashTY = ty; f.dashTZ = (tz === undefined ? f.z : tz); f.dashAng = Math.acos(clamp(cosA, -1, 1));',
     '  f.dashTX = tx; f.dashTY = ty; f.dashTZ = 0; f.dashAng = Math.acos(clamp(cosA, -1, 1));   // 【W9 2D】dashTZ 恒 0');
/* 3) 雁的垂向邻居 nz */
must('      if (d2 < nd) { nd = d2; nx = dx; ny = dy; nz = GRAV_ON ? f.z : 0; nKind = f.kind || ""; }',
     '      if (d2 < nd) { nd = d2; nx = dx; ny = dy; nKind = f.kind || ""; }   // 【W9 2D】无 nz');
/* 4) 威慑锥调用点(去掉第三参) */
must('    if (inCone3(E.x, E.y, E.z)) { E.pending -= CONE_EAGLE_DRAIN; stats.coneEagleDrain++; }   // 第 8 轮: 3D 锥',
     '    if (inCone3(E.x, E.y)) { E.pending -= CONE_EAGLE_DRAIN; stats.coneEagleDrain++; }   // 【W9 2D】平面锥');
must('    const coneHit = inCone3(f.x, f.y, f.z);    // P2D/第 8 轮: 闯进雁群正面 -> 失血(3D 锥)',
     '    const coneHit = inCone3(f.x, f.y);         // 【W9 2D】闯进雁群正面 -> 失血(平面锥)');
must('          if (inCone3(f.x, f.y, f.z)) stats.dashEndInCone++;      // 第 8 轮: 3D 锥',
     '          if (inCone3(f.x, f.y)) stats.dashEndInCone++;      // 【W9 2D】平面锥');
/* 5) 鹰的目标高度 */
must('    let txp = 0, typ = 0, tzp = E.z, hasT = false;   // 第 8 轮: tzp = 目标高度(默认保持)',
     '    let txp = 0, typ = 0, hasT = false;            // 【W9 2D】无 tzp');
must('    else if (a === 3 && ri >= 0) { txp = falcons[ri].x; typ = falcons[ri].y; tzp = falcons[ri].z; hasT = true; }',
     '    else if (a === 3 && ri >= 0) { txp = falcons[ri].x; typ = falcons[ri].y; hasT = true; }');
/* 6) 隼的 tryDash/logDec 高度 */
must('          else if (tryDash(f, pc.cx, pc.cy, pc.lockIdx, pc.lockZ)) {   // 第 8 轮修正③: 冲刺瞄锁定个体\n' +
     '        logDec(1, fi, "追猎冲刺: 采样中心 (" + pc.cx.toFixed(0) + "," + pc.cy.toFixed(0) + ") z=" + pc.z.toFixed(0) +',
     '          else if (tryDash(f, pc.cx, pc.cy, pc.lockIdx)) {   // 【W9 2D】冲刺瞄锁定个体(无高度)\n' +
     '        logDec(1, fi, "追猎冲刺: 采样中心 (" + pc.cx.toFixed(0) + "," + pc.cy.toFixed(0) + ") 水平" +');
must('          else if (tryDash(f, pc.cx, pc.cy, pc.lockIdx, pc.lockZ)) {   // 第 8 轮修正③: 冲刺瞄锁定个体\n' +
     '        logDec(1, fi, "配合双打冲刺(事件触发): 能量 "',
     '          else if (tryDash(f, pc.cx, pc.cy, pc.lockIdx)) {   // 【W9 2D】无高度\n' +
     '        logDec(1, fi, "配合双打冲刺(事件触发): 能量 "');
must('          if (tryDash(f, rv.x, rv.y, -1, rv.z)) {',
     '          if (tryDash(f, rv.x, rv.y, -1)) {');
must('          logDec(1, fi, "驱逐竞争者冲刺(目标 z=" + rv.z.toFixed(0) + ")");',
     '          logDec(1, fi, "驱逐竞争者冲刺(平面)");');
/* 7) 雁隼的目标高度 */
must('      sxT = pc.cx; syT = pc.cy; szT = pc.z;',
     '      sxT = pc.cx; syT = pc.cy;                // 【W9 2D】无 szT');
must('    let hasT = false, tx = 0, ty = 0, tz = g.z;',
     '    let hasT = false, tx = 0, ty = 0;          // 【W9 2D】无 tz');
must('    if (!hasT && freshMem(g)) { tx = g.memX; ty = g.memY; tz = g.z; hasT = true; }',
     '    if (!hasT && freshMem(g)) { tx = g.memX; ty = g.memY; hasT = true; }');
must('    const baseZ = useGoose ? gzT : (starlingAvail ? pc.z : g.z);',
     '    /* 【W9 2D】原 baseZ(巡航层)已随 z 轴删除。 */');
/* 8) 弃用钩子 */
must('  setGhunterZ: (i, z) => { const g = ghunters[i]; if (!g) return null; g.z = +z; return g.z; },   // 守恒线验收用',
     '  setGhunterZ: (i, z) => 0,   // 【W9 deprecated】雁隼高度: 平面版无 z, 保留钩子返回 0');
must('             list: harriers.map(h => ({ id: h.slot, x: h.x, y: h.y, z: h.z, dead: h.dead,',
     '             list: harriers.map(h => ({ id: h.slot, x: h.x, y: h.y, z: 0, dead: h.dead,');
must('      x: g.x, y: g.y, z: g.z }));',
     '      x: g.x, y: g.y, z: 0 }));   // 【W9 2D】z 恒 0');

let bad = 0;
reps.forEach(([a], i) => { const n = t.split(a).length - 1; if (n !== 1) { bad++; console.log(`✗ #${i + 1} 命中 ${n} 次 (${a.split(NL).length} 行) ${a.split(NL)[0].slice(0, 58)}`); } });
console.log(`锚点 ${reps.length} 处, 异常 ${bad} 处`);
if (!APPLY) { console.log("(体检模式)"); process.exit(bad ? 1 : 0); }
if (bad) { console.log("不写回"); process.exit(1); }
for (const [a, b] of reps) t = t.split(a).join(b);
fs.writeFileSync(P, t);
console.log(`T5 阶段3b 已应用: ${reps.length} 处`);
