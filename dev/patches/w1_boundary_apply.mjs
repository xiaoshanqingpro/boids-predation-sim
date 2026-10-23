/* W1: 世界与视口解耦 + 边界"厌恶值"(取代硬夹取) —— 第 8 轮修正⑥
 * 用精确字符串替换, 全部命中才写回。 */
import fs from "node:fs";
const P = "掠食竞赛.html";
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const reps = [];
const add = (a, b) => reps.push([a, b]);

// ---------- 1) 常量: 视口与世界解耦 ----------
add(
  'const W = 1280, H = 720;          // 视口(画布)尺寸' + NL +
  'const PAD_OPEN = 170;             // 开阔世界的视口外缓冲带宽度',
  'const VIEW_W = 1280, VIEW_H = 720;   // 视口(画布)尺寸 —— 只管画布/投影, 与"世界"无关' + NL +
  '// 【第 8 轮修正⑥】世界尺寸与视口**解耦**: 鸟的活动范围不再是"视口 ± 缓冲带", 而是整个世界。' + NL +
  '// 边界不是墙, 是一圈"厌恶值": 进入 BOUND_R 带内就开始自主转向远离, 越近越强(二次增长),' + NL +
  '// 因此个体永远不会被硬夹在边上(wrapX/wrapY 里原来的 clamp 已经删掉)。' + NL +
  'const W = 3200, H = 2200;            // 世界尺寸(≈2.5×2.9 个视口)' + NL +
  'const BOUND_R = 420;                 // 边界厌恶半径(进入这个带内开始转向)' + NL +
  'const PAD_OPEN = 170;                // 网格额外边距(不再代表世界边界)'
);

// ---------- 2) wrapX/wrapY: 删掉硬夹取 ----------
add(
  '// 位置收拢: 开阔世界用硬夹紧兜底(软边界力已经在推回来了), 环面直接取模' + NL +
  'const wrapX = x => TORUS ? ((x % W) + W) % W : clamp(x, -PAD - 60, W + PAD + 60);' + NL +
  'const wrapY = y => TORUS ? ((y % H) + H) % H : clamp(y, -PAD - 60, H + PAD + 60);',
  '  // 位置收拢: 环面取模; 开阔世界**不再夹取** —— 边界由 applyBoundary 的厌恶力处理,' + NL +
  '  // 位置本身保持自由(网格索引在 cellOf 里夹取, 越界也不会越数组)。' + NL +
  '  const wrapX = x => TORUS ? ((x % W) + W) % W : x;' + NL +
  '  const wrapY = y => TORUS ? ((y % H) + H) % H : y;'
);

// ---------- 3) applyBoundary: 厌恶力 + 数值兜底 + 冲刺期内主动收势 ----------
add(
  '// 开阔世界的柔性边界: 越过缓冲带边界才受力, 没有空气墙' + NL +
  'function applyBoundary(o, k) {' + NL +
  '  if (TORUS) return;' + NL +
  '  if (o.x < -PAD) o.vx += BOUND_FORCE * k;' + NL +
  '  else if (o.x > W + PAD) o.vx -= BOUND_FORCE * k;' + NL +
  '  if (o.y < -PAD) o.vy += BOUND_FORCE * k;' + NL +
  '  else if (o.y > H + PAD) o.vy -= BOUND_FORCE * k;' + NL +
  '}',
  '/* 【第 8 轮修正⑥】边界 = 厌恶值(不是墙):' + NL +
  ' *   ① 进入 BOUND_R 带内 -> 加一个指向世界内部的力, 大小随 (1-d/R)² 增长(越近越强);' + NL +
  ' *   ② 同时削掉"朝外"的速度分量, 免得带着惯性冲出去(只削朝外那部分, 不碰横向);' + NL +
  ' *   ③ 正在冲刺(dashT>0)的猛禽速度是锁定的, 靠 ① 转不动 -> 进入带内较深处就主动收势(dashT=0);' + NL +
  ' *   ④ 极远处的数值兜底(正常永不触发, 触发即计入 boundClamp 供验收检查)。' + NL +
  ' * 这样所有个体都是"自己转开", 不会出现贴边/撞边。 */' + NL +
  'let boundClamp = 0, boundPeak = 0, boundMinEdge = Infinity;' + NL +
  'function applyBoundary(o, k) {' + NL +
  '  if (TORUS) return;' + NL +
  '  const dl = o.x, dr = W - o.x, dt = o.y, db = H - o.y;' + NL +
  '  let nX = 0, nY = 0, pen = 0;' + NL +
  '  if (dl < BOUND_R) { const u = 1 - dl / BOUND_R; nX += u; if (u > pen) pen = u; }' + NL +
  '  if (dr < BOUND_R) { const u = 1 - dr / BOUND_R; nX -= u; if (u > pen) pen = u; }' + NL +
  '  if (dt < BOUND_R) { const u = 1 - dt / BOUND_R; nY += u; if (u > pen) pen = u; }' + NL +
  '  if (db < BOUND_R) { const u = 1 - db / BOUND_R; nY -= u; if (u > pen) pen = u; }' + NL +
  '  const e = Math.min(dl, dr, dt, db);' + NL +
  '  if (e < boundMinEdge) boundMinEdge = e;' + NL +
  '  if (pen > 0) {' + NL +
  '    if (pen > boundPeak) boundPeak = pen;' + NL +
  '    const m = Math.hypot(nX, nY) || 1; nX /= m; nY /= m;' + NL +
  '    const F = BOUND_FORCE * k * pen * pen * 9;' + NL +
  '    o.vx += nX * F; o.vy += nY * F;' + NL +
  '    const vOut = o.vx * nX + o.vy * nY;' + NL +
  '    if (vOut < 0) { const cut = -vOut * 0.35 * pen; o.vx += nX * cut; o.vy += nY * cut; }' + NL +
  '    if (o.dashT > 0 && pen > 0.5) o.dashT = 0;      // 冲刺中不硬转, 直接收势' + NL +
  '  }' + NL +
  '  // 数值兜底: 只有真的跑到世界外 2×BOUND_R 才动手(正常永不发生)' + NL +
  '  if (o.x < -BOUND_R * 2 || o.x > W + BOUND_R * 2 || o.y < -BOUND_R * 2 || o.y > H + BOUND_R * 2) {' + NL +
  '    o.x = clamp(o.x, -BOUND_R * 2, W + BOUND_R * 2); o.y = clamp(o.y, -BOUND_R * 2, H + BOUND_R * 2);' + NL +
  '    boundClamp++;' + NL +
  '  }' + NL +
  '}' + NL +
  '// 同上, 但直接在"数组结构(AoS 的 SoA 版)"上作用: 椋鸟/雁用力累加' + NL +
  'function boundAccel(x, y, vx, vy, dashT) {' + NL +
  '  if (TORUS) return null;' + NL +
  '  const dl = x, dr = W - x, dt = y, db = H - y;' + NL +
  '  let nX = 0, nY = 0, pen = 0;' + NL +
  '  if (dl < BOUND_R) { const u = 1 - dl / BOUND_R; nX += u; if (u > pen) pen = u; }' + NL +
  '  if (dr < BOUND_R) { const u = 1 - dr / BOUND_R; nX -= u; if (u > pen) pen = u; }' + NL +
  '  if (dt < BOUND_R) { const u = 1 - dt / BOUND_R; nY += u; if (u > pen) pen = u; }' + NL +
  '  if (db < BOUND_R) { const u = 1 - db / BOUND_R; nY -= u; if (u > pen) pen = u; }' + NL +
  '  const e = Math.min(dl, dr, dt, db);' + NL +
  '  if (e < boundMinEdge) boundMinEdge = e;' + NL +
  '  if (pen <= 0) return null;' + NL +
  '  if (pen > boundPeak) boundPeak = pen;' + NL +
  '  const m = Math.hypot(nX, nY) || 1;' + NL +
  '  return [nX / m, nY / m, pen];' + NL +
  '}'
);

// ---------- 4) 椋鸟: 用厌恶力取代"越过 -PAD 才推一下" ----------
add(
  '    if (!tor) {                                // 开阔世界的柔性边界' + NL +
  '      if (xi < -PAD) ax += BOUND_FORCE;' + NL +
  '      else if (xi > W + PAD) ax -= BOUND_FORCE;' + NL +
  '      if (yi < -PAD) ay += BOUND_FORCE;' + NL +
  '      else if (yi > H + PAD) ay -= BOUND_FORCE;' + NL +
  '    }',
  '    if (!tor) {                                // 【第 8 轮修正⑥】边界厌恶力(不是墙)' + NL +
  '      const bd = boundAccel(xi, yi, V[vi], V[vi + 1], 0);' + NL +
  '      if (bd) {' + NL +
  '        const pen = bd[2];' + NL +
  '        const F = BOUND_FORCE * pen * pen * 9;' + NL +
  '        ax += bd[0] * F; ay += bd[1] * F;' + NL +
  '        const vOut = V[vi] * bd[0] + V[vi + 1] * bd[1];' + NL +
  '        if (vOut < 0) { const cut = -vOut * 0.35 * pen; ax += bd[0] * cut; ay += bd[1] * cut; }' + NL +
  '      }' + NL +
  '    }'
);

// ---------- 5) 雁: 同样加厌恶力(在朝向积分之前) ----------
add(
  '    // 第 8 轮 z 轴: 重力 + 朝领队层的弱弹簧(雁群保持稳定的分层, 不散乱)',
  '    if (!TORUS) {                              // 【第 8 轮修正⑥】雁也要"厌恶边界"' + NL +
  '      const bd = boundAccel(xi, yi, V2[2*i], V2[2*i+1], 0);' + NL +
  '      if (bd) {' + NL +
  '        const pen = bd[2], F = BOUND_FORCE * pen * pen * 9;' + NL +
  '        V2[2*i] += bd[0] * F; V2[2*i+1] += bd[1] * F;' + NL +
  '      }' + NL +
  '    }' + NL +
  '    // 第 8 轮 z 轴: 重力 + 朝领队层的弱弹簧(雁群保持稳定的分层, 不散乱)'
);

// ---------- 6) 渲染后端: 视口尺寸(s.W/s.H)与会话世界尺寸分开 ----------
add(
  'const glScene = {' + NL +
  '  W, H, P, V, alive, P2, V2, galive, maxN: MAXN, maxM: M,',
  '  const glScene = {' + NL +
  '    // 【第 8 轮修正⑥】s.W/s.H 是**视口**(纹理/投影/像素尺度都用它), 世界尺寸另给 worldW/worldH' + NL +
  '    W: VIEW_W, H: VIEW_H, worldW: W, worldH: H, P, V, alive, P2, V2, galive, maxN: MAXN, maxM: M,'
);
add(
  '  paramsF32[4] = s.grid.cell; paramsF32[5] = s.grid.pad; paramsF32[6] = s.W; paramsF32[7] = s.H;',
  '  paramsF32[4] = s.grid.cell; paramsF32[5] = s.grid.pad;' + NL +
  '  paramsF32[6] = s.worldW || s.W; paramsF32[7] = s.worldH || s.H;   // 计算端的网格必须按**世界**尺寸建'
);

// ---------- 7) SIM 钩子: 世界/边界信息 + 验收用的边界统计 ----------
add(
  '  setTrail3: (v, len, w, alpha) => {' + NL +
  '    if (v !== undefined) TRAIL3_ON = !!v;',
  '  // 【第 8 轮修正⑥】世界与边界验收钩子 + 3D 吃判开关(之前只加了常量, 忘了出口)' + NL +
  '  worldInfo: () => ({ worldW: W, worldH: H, viewW: VIEW_W, viewH: VIEW_H, torus: TORUS,' + NL +
  '                     boundR: BOUND_R, clampCount: boundClamp, peakPenetration: boundPeak,' + NL +
  '                     minEdgeDist: boundMinEdge === Infinity ? null : boundMinEdge }),' + NL +
  '  resetBoundStats: () => { boundClamp = 0; boundPeak = 0; boundMinEdge = Infinity; return 1; },' + NL +
  '  setEat3D: (v) => { EAT_3D = !!v; const cb = el("cbEat3D"); if (cb) cb.checked = EAT_3D; return EAT_3D; },' + NL +
  '  get eat3D() { return EAT_3D; },' + NL +
  '  setTrail3: (v, len, w, alpha) => {' + NL +
  '    if (v !== undefined) TRAIL3_ON = !!v;'
);
// 3D 吃判的面板开关(与 SIM.setEat3D 联动)
add(
  '    <label class="chk"><input type="checkbox" id="cbTrail" checked>三维拖尾</label>',
  '    <label class="chk"><input type="checkbox" id="cbTrail" checked>三维拖尾</label>' + NL +
  '    <label class="chk"><input type="checkbox" id="cbEat3D">3D 吃判(捕食率约 1/4)</label>'
);
add(
  'el("cbTrail").onchange  = e => { TRAIL3_ON = e.target.checked; };   // 第 8 轮之三: 三维拖尾开关',
  'el("cbTrail").onchange  = e => { TRAIL3_ON = e.target.checked; };   // 第 8 轮之三: 三维拖尾开关' + NL +
  'el("cbEat3D").onchange  = e => { EAT_3D = e.target.checked; };      // 第 8 轮修正③: 吃判是否升 3D 球'
);

// ---------- 8) 面板: 世界/视口/边界一行 ----------
add(
  '    ` · 拖尾 ${TRAIL3_ON ? "开" : "关"}` +',
  '    ` · 拖尾 ${TRAIL3_ON ? "开" : "关"}` +' + NL +
  '    ` · 世界 ${W}×${H}(视口 ${VIEW_W}×${VIEW_H}, 厌恶 ${BOUND_R}px)` +'
);

let ok = 0;
for (const [a, b] of reps) {
  if (t.includes(a)) { t = t.split(a).join(b); ok++; }
  else console.log("✗ 未命中锚点: " + a.split(NL)[0].slice(0, 70));
}
if (ok !== reps.length) { console.log(`只命中 ${ok}/${reps.length} —— 不写回, 请修正锚点`); process.exit(1); }
fs.writeFileSync(P, t);
console.log(`W1 补丁已应用: ${ok}/${reps.length} 处`);
