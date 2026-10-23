/* ============================================================================
 * T5/W9 阶段 2: 主区块的 3D 视角层 + z 常量/数组 删除
 * ----------------------------------------------------------------------------
 * 用"按锚点删区间"(cutBetween) 处理成块的删除 —— 比逐行锚点稳。
 * 本阶段不碰物理(只删渲染/UI/常量), 守恒线应保持逐位一致。
 * 用法: node _w6w9/t5_p2_view.mjs [--apply]
 * ========================================================================== */
import fs from "node:fs";
const P = "掠食竞赛_2D.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const log = [];

function must(a, b) {
  const n = t.split(a).length - 1;
  if (n !== 1) { log.push(`✗ 命中 ${n} 次: ${a.split(NL)[0].slice(0, 60)}`); return false; }
  t = t.split(a).join(b); log.push(`✓ ${a.split(NL)[0].slice(0, 60)}`); return true;
}
function cutBetween(startA, endA, repl) {
  const i = t.indexOf(startA);
  if (i < 0) { log.push(`✗ 起点未命中: ${startA.slice(0, 60)}`); return false; }
  const j = t.indexOf(endA, i);
  if (j < 0) { log.push(`✗ 终点未命中: ${endA.slice(0, 60)}`); return false; }
  const removed = t.slice(i, j).split(NL).length;
  t = t.slice(0, i) + repl + t.slice(j);
  log.push(`✓ 删区间 ${removed} 行: ${startA.slice(0, 44)} … ${endA.slice(0, 44)}`);
  return true;
}

/* ---- 1. z 常量整合段 -> 只留 GRAV_ON 常量 ---- */
cutBetween(
  'const Z_INIT = 170;                    // 初始飞行高度',
  'let   zLowLive = FLOOR_Z, zHighLive = Z_INIT + Z_SPREAD;   // 高度范围(三维亮度映射用)\n',
  '/* 【W9 2D 变体】z 轴与重力整体删除: 原来这里的 Z_INIT/Z_SPREAD/G_GRAV/ALT_SPRING/ALT_DAMP/\n' +
  ' * ZT_SPREAD_K/FALCON_* 层差/EAT_3D/Z_CEIL/FLOOR_Z/FLOOR_PUSH/CLIMB_RATE/DIVE_RATE/DIVE_BOOST/\n' +
  ' * GROUND_MARGIN/GOOSE_LAYER/zMeanLive/zLowLive/zHighLive 全部随三维化一起移除。\n' +
  ' * 保留 GRAV_ON 这个名字并**常量化 false**: 老脚本/钩子还在读它, 语义是"本版本没有重力"。 */\n' +
  'const GRAV_ON = false;                 // 【W9】常量 false(?grav= 解析已删除)\n'
);

/* ---- 2. z 数组 ---- */
must(
  'const Z = new Float32Array(MAXN);         // 第 8 轮: 高度(z 轴, 与 xy 解耦)\n' +
  'const VZ = new Float32Array(MAXN);        // 第 8 轮: 垂直速度\n' +
  'const ZT = new Float32Array(MAXN);        // 第 8 轮修正: 每只鸟的"个人飞行层"(初值抽一次, 让云团有厚度)\n',
  '/* 【W9 2D】Z / VZ / ZT 三个高度数组已物理删除。 */\n'
);
must(
  'const Z2 = new Float32Array(M);           // 第 8 轮: 雁的高度\n' +
  'const VZ2 = new Float32Array(M);\n',
  '/* 【W9 2D】Z2 / VZ2 两个雁高度数组已物理删除。 */\n'
);

/* ---- 3. 三维视角层: VIEW3D / 相机 / 投影 ---- */
cutBetween(
  'let VIEW3D = true;',
  'const cam = { yaw: 0.7, pitch: 0.52, dist: 950, tx: W / 2, ty: H / 2, tz: Z_INIT, auto: false };   // 【第 8 轮修正⑤】默认不自动转(要转再勾)\n',
  '/* 【W9 2D】三维视角层整体删除: 没有 VIEW3D 开关 / 轨道相机 / 透视投影 / 深度雾。\n' +
  ' * 只保留"2D 俯视 + 相机平移"(跟随鸟群质心, 免得鸟群跑出视口之外)。 */\n' +
  'let ovClear = false;                       // 叠加层本帧是否需要 clear(底层是 GL 不透明画面时)\n'
);
/* vpM 声明单独删 */
must('let vpM = new Float32Array(16);\n', 'const cam = { tx: W / 2, ty: H / 2 };      // 【W9 2D】相机只剩平移(口径同原 ?view=top 分支)\n');
/* perspM / lookAtM / mulM / updateCamera -> 只留平移版 updateCamera */
cutBetween(
  'function perspM(fov, aspect, near, far) {',
  'function project(x, y, z, out) {',
  'function updateCamera() {\n' +
  '  cam.tx += (cxmI - cam.tx) * 0.04;\n' +
  '  cam.ty += (cymI - cam.ty) * 0.04;\n' +
  '}\n' +
  '\n' +
  '/* 【W9 2D】3D -> 屏幕的映射退化为"恒等 + 相机平移"。\n' +
  ' * 保留 (x,y,z,out) 签名与 {s,f,ok} 字段: 所有渲染调用点一行都不用改(s 恒 1, f 恒 1)。 */\n' +
  'const PR_A = { x: 0, y: 0, s: 1, f: 1, ok: true };\n' +
  'const PR_B = { x: 0, y: 0, s: 1, f: 1, ok: true };\n' +
  'const PR_C = { x: 0, y: 0, s: 1, f: 1, ok: true };\n'
);
/* project 本体 -> 2D */
cutBetween(
  'function project(x, y, z, out) {',
  'function toggleView() {',
  'function project(x, y, z, out) {\n' +
  '  out.x = x - (cam.tx - VIEW_W * 0.5);\n' +
  '  out.y = y - (cam.ty - VIEW_H * 0.5);\n' +
  '  out.s = 1; out.f = 1; out.ok = true;\n' +
  '  return out;\n' +
  '}\n' +
  '\n'
);
/* toggleView + 相机输入监听 -> 删 */
cutBetween(
  'function toggleView() {',
  '/* ------------------------------ 7. 渲染 ------------------------------ */',
  '/* 【W9 2D】toggleView(俯视/三维切换)与相机拖拽/滚轮输入监听一并删除。 */\n' +
  '\n'
);
/* renderSoft3D -> 删 */
cutBetween(
  'function renderSoft3D() {',
  '/* ---- 渲染分发',
  '/* 【W9 2D】renderSoft3D(CPU 透视软渲染)已删除。 */\n' +
  '\n'
);
/* render() -> 纯 2D 分发 */
cutBetween(
  'function render() {',
  '// 小地图: 开阔世界专用',
  '/* 【W9 2D】渲染分发只剩两条平面路径: WebGL 2D 实例化(?render=2d 以外) 与 Canvas2D 全路径。 */\n' +
  'function render() {\n' +
  '  const t0 = performance.now();\n' +
  '  updateCamera();                              // 相机平移跟随群体质心(每帧, 暂停时也生效)\n' +
  '  if (glReady) {\n' +
  '    try {\n' +
  '      window.GLBackend.draw(glScene);          // 2D 实例化(俯视专用)\n' +
  '      glUsed = true;\n' +
  '    } catch (e) {\n' +
  '      glReady = false;\n' +
  '      perf.gl = false;\n' +
  '      console.warn("WebGL 后端异常, 回退 Canvas2D:", e && e.message);\n' +
  '    }\n' +
  '  }\n' +
  '  ovClear = glReady;\n' +
  '  if (glReady) renderOverlay();\n' +
  '  else render2D();                             // 原 Canvas2D 全路径\n' +
  '  perf.renderMs = perf.renderMs * 0.9 + (performance.now() - t0) * 0.1;\n' +
  '  perf.gl = glReady;\n' +
  '}\n' +
  '\n'
);

fs.writeFileSync(P + (APPLY ? "" : ".dry"), t);
log.forEach(l => console.log(l));
const failed = log.filter(l => l.startsWith("✗")).length;
console.log(`失败锚点 ${failed}`);
if (!APPLY) { console.log("(体检模式, 写出 .dry 供检查, 未覆盖原文件)"); process.exit(failed ? 1 : 0); }
if (failed) { console.log("有锚点失败 —— 不写回"); process.exit(1); }
fs.writeFileSync(P, t);
console.log("T5 阶段2 已应用");
