/* ============================================================================
 * T5/W9 阶段 3a: 主区块剩余 z 引用清理(对象字段 / 感知 / 渲染 / 面板 / SIM 钩子)
 * 用法: node _w6w9/t5_p3a_zrefs.mjs [--apply]
 * ========================================================================== */
import fs from "node:fs";
const P = "掠食竞赛_2D.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const reps = [];
const must = (a, b) => reps.push([a, b]);
const del = a => reps.push([a, ""]);

/* ---- 常量残留 ---- */
del('let   zLowLive = FLOOR_Z, zHighLive = Z_INIT + Z_SPREAD;   // 高度范围(三维亮度映射用)\n');
del('const GH_LAYER_OFF = 90;                       // 巡航高于目标层多少(俯冲攻击)\n');
del('const GH_CLIMB_RATE = CLIMB_RATE * 2.0;        // 0.28(隼 0.14) —— 垂直机动更高\n');
del('const GH_DIVE_RATE  = DIVE_RATE * 2.0;         // 0.52(隼 0.26)\n');
del('const HARRIER_Z = 150;                     // 飞行高度(与鹰同层: 不与鸟群/雁群层混淆)\n');

/* ---- 工厂 / 重置里的高度字段 ---- */
must(
  '  return { x, y, vx, vy, z: 140, vz: 0, targetZ: -1, color, label, kind: "falcon",',
  '  return { x, y, vx, vy, color, label, kind: "falcon",   // 【W9 2D】无 z/vz/targetZ'
);
must(
  '           energy: ENERGY_MAX, dashT: 0, circleT, dashEats: 0, lockIdx: -1, stoopT: 0,',
  '           energy: ENERGY_MAX, dashT: 0, circleT, dashEats: 0, lockIdx: -1,'
);
must(
  '  return { x, y, vx: 0, vy: 0, z: Z_INIT, vz: 0, targetZ: -1, kind: "eagle",',
  '  return { x, y, vx: 0, vy: 0, kind: "eagle",       // 【W9 2D】无 z/vz/targetZ'
);
must(
  '           dashT: 0, cool: 0, dashEats: 0, lockIdx: -1, stoopT: 0,',
  '           dashT: 0, cool: 0, dashEats: 0, lockIdx: -1,'
);
must(
  '  return { x, y, z: GOOSE_LAYER + GH_LAYER_OFF, vz: 0, targetZ: -1, kind: "ghunter",',
  '  return { x, y, kind: "ghunter",                   // 【W9 2D】无 z/vz/targetZ'
);
must(
  '           energy: ENERGY_MAX, dashT: 0, dashEats: 0, dashS: 0, lockIdx: -1, stoopT: 0,',
  '           energy: ENERGY_MAX, dashT: 0, dashEats: 0, dashS: 0, lockIdx: -1,'
);
must(
  '  return { x, y, z: HARRIER_Z, vx: 0, vy: 0, kind: "harrier",',
  '  return { x, y, vx: 0, vy: 0, kind: "harrier",      // 【W9 2D】无 z'
);
must(
  '  h.x = p.x; h.y = p.y; h.z = HARRIER_Z; h.vx = 0; h.vy = 0;',
  '  h.x = p.x; h.y = p.y; h.vx = 0; h.vy = 0;'
);
del('  r2.targetZ = -1;\n');
del('  for (let i = 0; i < M; i++) { Z2[i] = GOOSE_LAYER + (i % 5) * 6; VZ2[i] = 0; }   // 第 8 轮: 雁在明显更高的稳定层(分层可见)\n');
del('    f.z = 140; f.vz = 0; f.targetZ = -1;                              // 第 8 轮\n');
del('    E.z = Z_INIT; E.vz = 0; E.targetZ = -1;                           // 第 8 轮\n');

/* ---- 感知 PC: 去掉高度字段 ---- */
must(
  'const PC = { x: 0, y: 0, n: 0, bi: -1, cx: -1, cy: -1, lockIdx: -1, score: 0, z: Z_INIT, mvx: 0, mvy: 0 };   // W6b①: +群体均速',
  'const PC = { x: 0, y: 0, n: 0, bi: -1, cx: -1, cy: -1, lockIdx: -1, score: 0, mvx: 0, mvy: 0 };   // W6b①: +群体均速【W9 2D】无 z'
);
must(
  'function makePC() { return { cx: -1, cy: -1, lockIdx: -1, score: 0, n: 0, mvx: 0, mvy: 0, x: 0, y: 0, z: Z_INIT, lockZ: Z_INIT, frame: -1e9 }; }',
  'function makePC() { return { cx: -1, cy: -1, lockIdx: -1, score: 0, n: 0, mvx: 0, mvy: 0, x: 0, y: 0, frame: -1e9 }; }   // 【W9 2D】无 z/lockZ'
);
must(
  '  dst.mvx = src.mvx; dst.mvy = src.mvy; dst.x = src.x; dst.y = src.y; dst.z = src.z; dst.lockZ = src.lockZ;',
  '  dst.mvx = src.mvx; dst.mvy = src.mvy; dst.x = src.x; dst.y = src.y;   // 【W9 2D】无 z/lockZ'
);
must(
  '      } else { sumX += P[2*j]; sumY += P[2*j+1]; sumZ += Z[j]; sumVX += V[2*j]; sumVY += V[2*j+1]; }   // 第 8 轮 + W6b①',
  '      } else { sumX += P[2*j]; sumY += P[2*j+1]; sumVX += V[2*j]; sumVY += V[2*j+1]; }   // W6b①【W9 2D】无 sumZ'
);
del('  PC.z = cnt ? sumZ / cnt : Z_INIT;          // 视野内鸟群的平均高度(参考)\n');
del('  PC.lockZ = (lockIdx >= 0) ? Z[lockIdx] : PC.z;\n');
must(
  '          f.dashTZ = Z[cand];',
  '          f.dashTZ = 0;                    // 【W9 2D】无高度'
);

/* ---- glScene: 去掉 3D 实例属性 ---- */
must(
  '    get panX() { return VIEW3D ? 0 : cam.tx - VIEW_W * 0.5; },\n' +
  '    get panY() { return VIEW3D ? 0 : cam.ty - VIEW_H * 0.5; },',
  '    get panX() { return cam.tx - VIEW_W * 0.5; },   // 【W9 2D】平面平移(与叠加层同一口径)\n' +
  '    get panY() { return cam.ty - VIEW_H * 0.5; },'
);
del('  Z, VZ, Z2, VZ2,                                    // 第 8 轮: 3D 实例属性源\n');
del('  get size3dMul() { return SIZE3D_MUL; },\n' +
    '  get trail3() { return { on: TRAIL3_ON, len: TRAIL3_LEN, w: TRAIL3_W, alpha: TRAIL3_ALPHA }; },\n');
del('  get stoop() { return raptors.map(r => r.stoopT || 0); },\n' +
    '  size3dMinPx: SIZE3D_MINPX,\n');
del('  get zLow() { return zLowLive; },\n');
del('  get zHigh() { return zHighLive; },\n');

/* ---- 渲染里的高度引用 ---- */
must(
  '      project(h.shock.x, h.shock.y, h.shock.z || Z_INIT, PR_B);',
  '      project(h.shock.x, h.shock.y, 0, PR_B);      // 【W9 2D】平面冲击波'
);
must('    const LZ = Z2[leaderIdx];', '    const LZ = 0;                      // 【W9 2D】无高度');
must('      project(Lx, Ly, Z2[leaderIdx], PR_A);', '      project(Lx, Ly, 0, PR_A);');
must('      project(Lx - hx * back + qx * side * arm, Ly - hy * back + qy * side * arm, Z2[leaderIdx], PR_B);',
     '      project(Lx - hx * back + qx * side * arm, Ly - hy * back + qy * side * arm, 0, PR_B);');
must('\n  project(Lx, Ly, Z2[leaderIdx], PR_A);', '\n  project(Lx, Ly, 0, PR_A);');
must('\n      project(Lx, Ly, Z2[leaderIdx], PR_A);', '\n      project(Lx, Ly, 0, PR_A);');
must('    project(deathX[k], deathY[k], Z_INIT, PR_A);', '    project(deathX[k], deathY[k], 0, PR_A);');
must('      project(P2[2*g.tgtGoose], P2[2*g.tgtGoose+1], Z2[g.tgtGoose], PR_B);',
     '      project(P2[2*g.tgtGoose], P2[2*g.tgtGoose+1], 0, PR_B);');
/* 尸体绘制段(仅 GRAV_ON) */
del(
  '  if (GRAV_ON) {\n' +
  '    ctx.fillStyle = "rgb(180, 195, 215)";\n' +
  '    for (let k = 0; k < CORPSE_CAP; k++) {\n' +
  '      if (cT[k] <= 0) continue;\n' +
  '      project(cX[k], cY[k], cZ[k], PR_A);\n' +
  '      if (!PR_A.ok) continue;\n' +
  '      const grounded = cZ[k] <= FLOOR_Z;\n' +
  '      const fade = grounded ? Math.max(0, 1 - (cT[k] - 1) / 60) : 1;\n' +
  '      ctx.globalAlpha = 0.55 * PR_A.f * fade;\n' +
  '      const r = Math.max(1, 1.6 * PR_A.s);\n' +
  '      ctx.fillRect(PR_A.x - r / 2, PR_A.y - r / 2, r, r);\n' +
  '    }\n' +
  '    ctx.globalAlpha = 1;\n' +
  '  }\n'
);

/* ---- 面板: 视图行只描述 2D ---- */
must(
  '  el("viewLine").innerHTML =\n' +
  '    `<b>${VIEW3D ? "三维" : "俯视"}</b> · 重力 <b>${GRAV_ON ? "开" : "关"}</b>` +\n' +
  '    ` · 相机 ${cam.dist.toFixed(0)}px${cam.auto ? "(自动环绕)" : ""}` +\n' +
  '    ` · 拖尾 ${TRAIL3_ON ? "开" : "关"}` +\n' +
  '    ` · 世界 ${W}×${H}(视口 ${VIEW_W}×${VIEW_H}, 厌恶 ${BOUND_R}px)` +\n' +
  '    ` · 渲染 ${VIEW3D ? (gl3dReady ? "WebGL·3D" : "软渲染·3D") : (glReady ? "WebGL" : "Canvas2D")}${want2D ? "(强制)" : ""}` +\n' +
  '    ` · 计算 ${gpuCompute ? "WebGPU" : "CPU"}${computeMode === "cpu" ? "(强制)" : ""}`;',
  '  el("viewLine").innerHTML =\n' +
  '    `<b>二维</b> · 世界 ${W}×${H}(视口 ${VIEW_W}×${VIEW_H}, 厌恶 ${BOUND_R}px, 平移 ${(cam.tx - VIEW_W * 0.5).toFixed(0)},${(cam.ty - VIEW_H * 0.5).toFixed(0)})` +\n' +
  '    ` · 渲染 ${glReady ? "WebGL" : "Canvas2D"}${want2D ? "(强制)" : ""}` +\n' +
  '    ` · 计算 ${gpuCompute ? "WebGPU" : "CPU"}${computeMode === "cpu" ? "(强制)" : ""}`;'
);
/* SIMzRange / corpseCount -> deprecated 桩 */
must(
  '/* z 范围与尸体数(面板用; 与 SIM.zRange/corpses 同口径) */\n' +
  'function SIMzRange() {\n' +
  '  let lo = 1e9, hi = -1e9, sum = 0, cnt = 0;\n' +
  '  for (let i = 0; i < N; i++) if (alive[i]) { const z = Z[i]; if (z < lo) lo = z; if (z > hi) hi = z; sum += z; cnt++; }\n' +
  '  let glo = 1e9, ghi = -1e9, gsum = 0, gcnt = 0;\n' +
  '  for (let i = 0; i < M; i++) if (galive[i]) { const z = Z2[i]; if (z < glo) glo = z; if (z > ghi) ghi = z; gsum += z; gcnt++; }\n' +
  '  return { starling: cnt ? { lo, hi, mean: sum / cnt } : null, goose: gcnt ? { lo: glo, hi: ghi, mean: gsum / gcnt } : null };\n' +
  '}\n' +
  'function corpseCount() {\n' +
  '  let c = 0;\n' +
  '  for (let k = 0; k < CORPSE_CAP; k++) if (cT[k] > 0) c++;\n' +
  '  return c;\n' +
  '}\n',
  '/* 【W9 2D】原 SIMzRange / corpseCount 依赖 z 与尸体系统, 已随二者删除 —— 保留同名桩避免老脚本报错。 */\n' +
  'function SIMzRange() { return { starling: null, goose: null }; }\n' +
  'function corpseCount() { return 0; }\n'
);
/* 面板刷新里的高度/尸体行 */
del(
  '  const zr = SIMzRange();\n' +
  '  el("zStar").textContent = zr.starling ? zr.starling.mean.toFixed(0) : "—";\n' +
  '  el("zGoose").textContent = zr.goose ? zr.goose.mean.toFixed(0) : "—";\n' +
  '  el("zSpan").textContent = zr.starling ? (zr.starling.hi - zr.starling.lo).toFixed(0) : "—";\n' +
  '  el("corpseN").textContent = corpseCount();\n'
);
/* 面板控件处理 */
del(
  'el("btnView").onclick = () => toggleView();\n' +
  'el("btnCamReset").onclick = () => { cam.yaw = 0.7; cam.pitch = 0.52; cam.dist = 950; };\n' +
  'el("cbGravity").onchange = e => { GRAV_ON = e.target.checked; };\n' +
  'el("cbAuto").onchange = e => { cam.auto = e.target.checked; };\n'
);
del('el("cbTrail").onchange  = e => { TRAIL3_ON = e.target.checked; };   // 第 8 轮之三: 三维拖尾开关\n');
del('el("cbEat3D").onchange  = e => { EAT_3D = e.target.checked; };      // 第 8 轮修正③: 吃判是否升 3D 球\n');

/* ---- SIM 钩子: 保留名字, 值退化为 0/false(deprecated) ---- */
must('  get leader() { return { x: Lx, y: Ly, ang: leaderAng, z: Z2[leaderIdx] }; },',
     '  get leader() { return { x: Lx, y: Ly, ang: leaderAng, z: 0 }; },   // 【W9 2D】z 恒 0');
must(
  '             climbRate: GH_CLIMB_RATE, diveRate: GH_DIVE_RATE, eatRGoose: GH_EAT_R_G,',
  '             eatRGoose: GH_EAT_R_G,   // 【W9 2D】无 climbRate/diveRate'
);
must(
  '             climbRatio: GH_CLIMB_RATE / CLIMB_RATE, diveRatio: GH_DIVE_RATE / DIVE_RATE };',
  '             climbRatio: 0, diveRatio: 0 };   // 【W9 2D】无垂向机动'
);
must(
  '  setSize3D: (m) => { SIZE3D_MUL = clamp(+m || 0, 0.5, 12); return SIZE3D_MUL; },\n' +
  '  get size3D() { return SIZE3D_MUL; },',
  '  setSize3D: (m) => 1,                 // 【W9 deprecated】三维体积倍数: 2D 版无意义, 保留钩子\n' +
  '  get size3D() { return 1; },'
);
must(
  '  setEat3D: (v) => { EAT_3D = !!v; const cb = el("cbEat3D"); if (cb) cb.checked = EAT_3D; return EAT_3D; },\n' +
  '  get eat3D() { return EAT_3D; },',
  '  setEat3D: (v) => false,              // 【W9 deprecated】3D 吃判: 平面版恒为 false\n' +
  '  get eat3D() { return false; },'
);
must(
  '  hunterDetail: (k) => { const h = raptors[k]; if (!h) return null; return { kind: h.kind, label: h.label, x: h.x, y: h.y, z: h.z,\n' +
  '    vx: h.vx, vy: h.vy, vz: h.vz || 0, energy: h.energy, dashT: h.dashT, cool: h.cool || 0, circleT: h.circleT,\n' +
  '    stun: h.stun, mob: h.mob, lockIdx: h.lockIdx, stoopT: h.stoopT || 0, score: h.score, kills: h.kills,',
  '  hunterDetail: (k) => { const h = raptors[k]; if (!h) return null; return { kind: h.kind, label: h.label, x: h.x, y: h.y, z: 0,   // 【W9 2D】z 恒 0\n' +
  '    vx: h.vx, vy: h.vy, vz: 0, energy: h.energy, dashT: h.dashT, cool: h.cool || 0, circleT: h.circleT,\n' +
  '    stun: h.stun, mob: h.mob, lockIdx: h.lockIdx, stoopT: 0, score: h.score, kills: h.kills,'
);
must(
  '  setTrail3: (v, len, w, alpha) => {\n' +
  '    if (v !== undefined) TRAIL3_ON = !!v;\n' +
  '    if (len !== undefined) TRAIL3_LEN = clamp(+len, 0, 40);\n' +
  '    if (w !== undefined) TRAIL3_W = clamp(+w, 0.05, 4);\n' +
  '    if (alpha !== undefined) TRAIL3_ALPHA = clamp(+alpha, 0, 1);\n' +
  '    return { on: TRAIL3_ON, len: TRAIL3_LEN, w: TRAIL3_W, alpha: TRAIL3_ALPHA };\n' +
  '  },\n' +
  '  get trail3() { return { on: TRAIL3_ON, len: TRAIL3_LEN, w: TRAIL3_W, alpha: TRAIL3_ALPHA }; },',
  '  // 【W9 deprecated】三维拖尾已删除; 保留同名钩子返回"关"以免老脚本报错\n' +
  '  setTrail3: (v, len, w, alpha) => ({ on: false, len: 0, w: 0, alpha: 0 }),\n' +
  '  get trail3() { return { on: false, len: 0, w: 0, alpha: 0 }; },'
);
must('  get stoop() { return raptors.map(r => r.stoopT || 0); },\n' +
     '  get zRange() {',
     '  get stoop() { return raptors.map(() => 0); },   // 【W9 2D】无俯冲相\n' +
     '  get zRange() {');
must(
  '  get zRange() {\n' +
  '    let lo = 1e9, hi = -1e9, sum = 0, cnt = 0;\n' +
  '    for (let i = 0; i < N; i++) if (alive[i]) { const z = Z[i]; if (z < lo) lo = z; if (z > hi) hi = z; sum += z; cnt++; }\n' +
  '    let glo = 1e9, ghi = -1e9, gsum = 0, gcnt = 0;\n' +
  '    for (let i = 0; i < M; i++) if (galive[i]) { const z = Z2[i]; if (z < glo) glo = z; if (z > ghi) ghi = z; gsum += z; gcnt++; }\n' +
  '    return { starling: cnt ? { lo, hi, mean: sum / cnt } : null,\n' +
  '             goose: gcnt ? { lo: glo, hi: ghi, mean: gsum / gcnt } : null,\n' +
  '             zMeanLive, zLowLive, zHighLive };\n' +
  '  },',
  '  get zRange() { return { starling: null, goose: null }; },   // 【W9 2D】无高度'
);
must(
  '  get scene() { return { gravity: GRAV_ON, view3D: VIEW3D, camYaw: cam.yaw, camPitch: cam.pitch, camDist: cam.dist, camAuto: cam.auto }; },',
  '  get scene() { return { gravity: false, view3D: false, camX: cam.tx, camY: cam.ty, panX: cam.tx - VIEW_W * 0.5, panY: cam.ty - VIEW_H * 0.5 }; },   // 【W9 2D】'
);
must(
  '  starling(i) { return { x: P[2*i], y: P[2*i+1], z: Z[i], vx: V[2*i], vy: V[2*i+1], vz: VZ[i], alive: !!alive[i], mobber: !!isMobber[i] }; },',
  '  starling(i) { return { x: P[2*i], y: P[2*i+1], z: 0, vx: V[2*i], vy: V[2*i+1], vz: 0, alive: !!alive[i], mobber: !!isMobber[i] }; },   // 【W9 2D】z/vz 恒 0'
);
must(
  '  goose(i) { return { x: P2[2*i], y: P2[2*i+1], z: Z2[i], alive: !!galive[i] }; },',
  '  goose(i) { return { x: P2[2*i], y: P2[2*i+1], z: 0, alive: !!galive[i] }; },   // 【W9 2D】z 恒 0'
);
must(
  '    return { x: h.x, y: h.y, z: h.z, vx: h.vx, vy: h.vy, vz: h.vz || 0, energy: h.energy || 0, dashT: h.dashT || 0,',
  '    return { x: h.x, y: h.y, z: 0, vx: h.vx, vy: h.vy, vz: 0, energy: h.energy || 0, dashT: h.dashT || 0,   // 【W9 2D】z/vz 恒 0'
);
must(
  '  get view3D() { return VIEW3D; },\n' +
  '  setView3D(v) { if (!!v !== VIEW3D) toggleView(); },\n' +
  '  get gravity() { return GRAV_ON; },\n' +
  '  setGravity(v) { GRAV_ON = !!v; const cb = el("cbGravity"); if (cb) cb.checked = GRAV_ON; },',
  '  // 【W9 2D deprecated】视角/重力开关已删除: 保留同名钩子(值恒 2D/无重力), 老脚本不报错\n' +
  '  get view3D() { return false; },\n' +
  '  setView3D(v) { return false; },\n' +
  '  get gravity() { return false; },\n' +
  '  setGravity(v) { return false; },'
);
must('  get corpses() { let c = 0; for (let k = 0; k < CORPSE_CAP; k++) if (cT[k] > 0) c++; return c; },',
     '  get corpses() { return 0; },   // 【W9 2D】无尸体系统');

/* ---- 面板 HTML: 删 3D 行/按钮/开关 ---- */
del('    <tr><td style="color:#8b93b5">高度 鸟 / 雁</td><td class="num" id="zStar">—</td><td class="num" id="zGoose">—</td></tr>\n');
del('    <tr><td style="color:#8b93b5">云厚 / 尸体</td><td class="num" id="zSpan">—</td><td class="num" id="corpseN">0</td></tr>\n');
del('  <div class="row"><button id="btnView">切换俯视（T）</button><button id="btnCamReset">复位视角</button></div>\n');
del('    <label class="chk"><input type="checkbox" id="cbGravity" checked>重力</label>\n');
del('    <label class="chk"><input type="checkbox" id="cbAuto">自动环绕</label>\n');
del('    <label class="chk"><input type="checkbox" id="cbTrail" checked>三维拖尾</label>\n');
del('    <label class="chk"><input type="checkbox" id="cbEat3D">3D 吃判(捕食率约 1/4)</label>\n');

let bad = 0;
reps.forEach(([a], i) => { const n = t.split(a).length - 1; if (n !== 1) { bad++; console.log(`✗ #${i + 1} 命中 ${n} 次 (${a.split(NL).length} 行) ${a.split(NL)[0].slice(0, 58)}`); } });
console.log(`锚点 ${reps.length} 处, 异常 ${bad} 处`);
if (!APPLY) { console.log("(体检模式)"); process.exit(bad ? 1 : 0); }
if (bad) { console.log("不写回"); process.exit(1); }
for (const [a, b] of reps) t = t.split(a).join(b);
fs.writeFileSync(P, t);
console.log(`T5 阶段3a 已应用: ${reps.length} 处`);
