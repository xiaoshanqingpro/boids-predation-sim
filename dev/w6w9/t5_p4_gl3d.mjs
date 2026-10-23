/* ============================================================================
 * T5/W9 阶段 4: 删掉 WebGL 后端里的 3D 路径(draw3D + 3D 着色器 + 3D 资产/拖尾初始化)
 * 保留: WebGL 2D 实例化 draw()、ping-pong 残影、以及 block3 的 WebGPU 计算后端。
 * 用法: node _w6w9/t5_p4_gl3d.mjs [--apply]
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
  log.push(`✓ 删区间 ${removed} 行: ${startA.slice(0, 40)} … ${endA.slice(0, 40)}`);
  return true;
}

/* 1) 四个 3D 着色器源码 */
cutBetween(
  '  /* ---- 第 8 轮: 3D 着色器(实例属性 = 位置 xyz + 速度 xyz, 速度建正交基定向) ---- */',
  '  function compile(vsSrc, fsSrc) {',
  '  /* 【W9 2D】三维着色器(VS/FS_BIRD3、VS/FS_TRAIL3)已删除 —— 平面版只保留 2D 实例化与残影。 */\n'
);
/* 2) 初始化里的拖尾缓冲段 */
cutBetween(
  '      /* ---- 拖尾: 同一实例缓冲(位置+速度), 单位带几何, 开混合、关深度写入 ---- */',
  '      gl.disable(gl.DEPTH_TEST);',
  ''
);
/* 3) 初始化里的 3D 资产段 */
cutBetween(
  '      // ---- 第 8 轮: 3D 资产(3D 失败不影响 2D 路径) ----',
  '      U.res = gl.getUniformLocation(progBird, "uRes");',
  '      /* 【W9 2D】3D 资产(prog3/progTrail3、深度帧缓冲、3D 实例缓冲)已删除; 2D 路径不依赖它们。 */\n'
);
/* 4) draw3D 方法 */
cutBetween(
  '    /* 第 8 轮: 3D 一帧 —— 深度清屏 -> 两批实例化(速度定向 + 雾) -> 拷到屏幕。',
  '    info() {',
  '    /* 【W9 2D】draw3D(三维一帧)已删除。 */\n' +
  '\n'
);
/* 5) info() 不再报 3D */
must(
  '      return { gl2: isGL2, maxN, maxM, trail3: !!progTrail3, prog3: !!prog3, gl3d: !!has3DFlag,',
  '      return { gl2: isGL2, maxN, maxM, trail3: false, prog3: false, gl3d: false,   // 【W9 2D】无三维管线'
);
/* 6) 3D 相关变量声明 -> 只留 has3DFlag(has3D() 契约) */
must(
  '  let prog3 = null, instVBO3 = null, star3Buf = null, goose3Buf = null;\n' +
  '  let progTrail3 = null, trailVBO = null, A4 = { unit: -1, pos: -1, vel: -1 }, U4 = {};\n' +
  '  let tex3 = null, fbo3 = null, depth3 = null, has3DFlag = false;',
  '  let has3DFlag = false;            // 【W9 2D】三维程序/缓冲/深度帧缓冲已删除; 只留这个标志位给 has3D() 契约'
);
/* 7) has3D() 恒 false */
must(
  '    has3D() { return !!has3DFlag; },          // 第 8 轮: 3D 管线可用性',
  '    has3D() { return false; },                // 【W9 2D】三维管线已删除'
);

fs.writeFileSync(P + (APPLY ? "" : ".dry"), t);
log.forEach(l => console.log(l));
const failed = log.filter(l => l.startsWith("✗")).length;
console.log(`失败锚点 ${failed}`);
if (!APPLY) { console.log("(体检模式)"); process.exit(failed ? 1 : 0); }
if (failed) { console.log("有锚点失败 —— 不写回"); process.exit(1); }
fs.writeFileSync(P, t);
console.log("T5 阶段4 已应用");
