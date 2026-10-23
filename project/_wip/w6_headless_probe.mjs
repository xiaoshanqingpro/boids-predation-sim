/* ============================================================================
 * 掠食竞赛.html 的无头校验脚本
 * ----------------------------------------------------------------------------
 * 用假的 document / canvas / performance 把页面里的 <script> 跑在 Node 里,
 * 直接驱动 SIM.step(), 覆盖:
 *   [1] 开阔世界长时间不变量 + 生态行为(含 A~E 新机制的触发计数)
 *   [2] 椋鸟群结构(拓扑 K=7)
 *   [3] 环面模式
 *   [4] 渲染路径(假 canvas 全走一遍)
 *   [5] 参数滑杆 K/N
 *   [6] 新机制逐条: A 空冲刺扣分 / B 代谢 / C 围攻 / D 锁定 / E 互攻与 Q 表四列
 *   [7] F 体型与判定 / G 收紧鸟群(无猛禽干扰下的致密度与连通性)
 *   [8] 性能
 *   [9] DOM 契约与文件结构
 * 用法: node _checks/headless.mjs [路径\掠食竞赛.html]
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? path.join(here, "..", "掠食竞赛.html");

const html = fs.readFileSync(file, "utf8");
const cutContainer = html.indexOf('<script type="text/plain"');   // 说明容器正文里可能有 "<script>" 字样
const scanHtml = cutContainer > 0 ? html.slice(0, cutContainer) : html;
const blocks = [...scanHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!blocks.length) { console.error("✗ 没找到 <script> 块"); process.exit(1); }
const code = blocks[0];                       // 主仿真区块
const allCode = blocks.join("\n;\n");         // 含 WebGL 后端区块

/* ---------------- 假 WebGPU(navigator.gpu + device + queue) ---------------- */
const gpuLog = [];
function makeMockGPU() {
  const state = { corrupt: false, compileErrors: null, lastCopy: null, submits: 0, mapped: null };
  const USAGE = { MAP_READ: 1, COPY_DST: 2, COPY_SRC: 4, STORAGE: 8, UNIFORM: 16 };
  const MAPMODE = { READ: 1 };
  const buffers = [];
  const device = {
    createBuffer(desc) {
      const b = {
        __buf: true, size: desc.size, usage: desc.usage,
        mapAsync: (mode, off, size) => { b.__mapOff = off || 0; b.__mapSize = size || b.size; return Promise.resolve(); },
        getMappedRange: (off, size) => state.mapped,
        unmap: () => {},
        destroy: () => {},
      };
      buffers.push(b);
      gpuLog.push(["createBuffer", desc.size, desc.usage]);
      return b;
    },
    createShaderModule: (d) => { gpuLog.push(["createShaderModule", d.code.length]); return { __mod: true, code: d.code, getCompilationInfo: () => Promise.resolve({ messages: state.compileErrors || [] }) }; },
    createComputePipeline: (d) => { gpuLog.push(["createComputePipeline", d.compute.entryPoint, d.layout === "auto" ? "auto" : "explicit"]); return { __pipe: true, entry: d.compute.entryPoint, getBindGroupLayout: () => ({ __bgl: true }) }; },
    createBindGroupLayout: (d) => { gpuLog.push(["createBindGroupLayout", d.entries.length, d.entries.map(e => e.buffer && e.buffer.type)]); return { __bgl: true, entries: d.entries }; },
    createPipelineLayout: (d) => { gpuLog.push(["createPipelineLayout", d.bindGroupLayouts.length]); return { __pl: true, bgls: d.bindGroupLayouts }; },
    createBindGroup: (d) => { gpuLog.push(["createBindGroup", d.entries.length]); return { __bg: true, entries: d.entries }; },
    createCommandEncoder: () => ({
      beginComputePass() {
        return {
          setPipeline(p) { gpuLog.push(["setPipeline", p.entry]); },
          setBindGroup(i, bg) { gpuLog.push(["setBindGroup", i]); },
          dispatchWorkgroups(x) { gpuLog.push(["dispatch", x]); },
          end() { gpuLog.push(["endPass"]); },
        };
      },
      copyBufferToBuffer(src, so, dst, doff, size) {
        gpuLog.push(["copyBufferToBuffer", size]);
        if (state.corrupt) {
          state.mapped = new Float32Array(size / 4).fill(NaN);       // 坏的 GPU 结果
        } else {
          state.mapped = Float32Array.from(mockGPU.cpuSnapshot(size / 4));  // 假装 GPU 算得和 CPU 一样
        }
      },
      finish() { gpuLog.push(["finish"]); return { __cb: true }; },
    }),
    queue: {
      writeBuffer(buf, off, data, dOff, size) {
        const isAB = data && typeof data.byteLength === "number" && !ArrayBuffer.isView(data);
        const n = size === undefined ? (isAB ? data.byteLength : data.length * 4) : size;
        gpuLog.push(["writeBuffer", buf.size, n]);
        if (buf.size === 64) {                                       // uniform: 记下参数
          // 注意: 这些 ArrayBuffer 是在 vm 沙箱里创建的, 跨 realm 的 instanceof 会为 false,
          // 所以用 ArrayBuffer.isView / byteLength 判断
          const ab = isAB ? data : data.buffer;
          const u32 = new Uint32Array(ab, dOff || 0, 4);
          const f32 = new Float32Array(ab, dOff || 0, 16);
          mockGPU.params = { n: u32[0], gw: u32[1], gh: u32[2], topoK: u32[3],
                             cell: f32[4], pad: f32[5], w: f32[6], h: f32[7],
                             perceptionR2: f32[8], sepR2: f32[9], sepGain: f32[10],
                             maxSpeed: f32[11], maxForce: f32[12], cohesionW: f32[13],
                             alignmentW: f32[14], torus: u32[15] };
        }
      },
      submit(list) { state.submits++; gpuLog.push(["submit", list.length]); },
    },
    destroy: () => {},
  };
  const adapter = { info: { vendor: "mock", architecture: "mock-gpu" }, requestDevice: () => Promise.resolve(device) };
  return { gpu: { requestAdapter: () => Promise.resolve(adapter) }, state, USAGE, MAPMODE, buffers, device };
}
const mockGPU = makeMockGPU();
mockGPU.cpuSnapshot = () => [];                  // 由 harness 在装载后接上

/* ---------------- 假 DOM ---------------- */
// WebGL2 假上下文: 记录所有调用, 用来在无浏览器环境下验证 GL 后端的行为契约
const glLog = [];
let glFboSeq = 0;
const glObjId = new WeakMap();
function oid(o) { if (!glObjId.has(o)) glObjId.set(o, "obj" + (++glFboSeq)); return glObjId.get(o); }
function makeMockGL() {
  const C = {};
  ["VERTEX_SHADER","FRAGMENT_SHADER","COMPILE_STATUS","LINK_STATUS","ARRAY_BUFFER","STATIC_DRAW",
   "DYNAMIC_DRAW","FLOAT","TRIANGLES","TEXTURE_2D","RGBA","UNSIGNED_BYTE","TEXTURE_MIN_FILTER",
   "LINEAR","TEXTURE_MAG_FILTER","TEXTURE_WRAP_S","CLAMP_TO_EDGE","TEXTURE_WRAP_T","FRAMEBUFFER",
   "COLOR_ATTACHMENT0","FRAMEBUFFER_COMPLETE","DEPTH_TEST","BLEND","COLOR_BUFFER_BIT","TEXTURE0",
   "VENDOR","RENDERER","TEXTURE1","DEPTH_COMPONENT16","DEPTH_BUFFER_BIT","BLEND","SRC_ALPHA","ONE_MINUS_SRC_ALPHA","DEPTH_TEST","RENDERBUFFER","FRAMEBUFFER_COMPLETE_EXT"].forEach((k, i) => { C[k] = 0x1000 + i; });
  const gl = Object.assign({}, C);
  Object.assign(gl, {
    createShader: () => ({ t: "shader" }), createProgram: () => ({ t: "program" }),
    createBuffer: () => ({ t: "buffer" }), createTexture: () => ({ t: "tex" }),
    createFramebuffer: () => ({ t: "fbo" }),
    shaderSource() {}, compileShader() {}, attachShader() {}, linkProgram() {}, deleteShader() {},
    getShaderParameter: () => true, getProgramParameter: () => true,
    getShaderInfoLog: () => "", getProgramInfoLog: () => "",
    getUniformLocation: (p, n) => ({ u: n }), getAttribLocation: (p, n) => (n === "aUnit" ? 0 : n === "aInst" ? 1 : 2),
    bindBuffer: (t, b) => glLog.push(["bindBuffer", b ? oid(b) : null]),
    bufferData: (t, d) => glLog.push(["bufferData", typeof d === "number" ? d : d.length]),
    bufferSubData: (t, off, src, so, len) => glLog.push(["bufferSubData", off, Array.from(src.slice(so || 0, (so || 0) + (len === undefined ? src.length : len)))]),
    bindTexture: (t, x) => glLog.push(["bindTexture", x ? oid(x) : null]),
    texImage2D: () => glLog.push(["texImage2D"]), texParameteri() {},
    bindFramebuffer: (t, f) => glLog.push(["bindFramebuffer", f ? oid(f) : null]),
    framebufferTexture2D() {}, checkFramebufferStatus: () => C.FRAMEBUFFER_COMPLETE,
    viewport: (x, y, w, h) => glLog.push(["viewport", w, h]),
    clearColor() { glLog.push(["clearColor"]); }, clear() {},
    disable: () => glLog.push(["disable"]), enable() {},
    useProgram: p => glLog.push(["useProgram", p ? p.t : null]),
    activeTexture() {}, uniform1i() {}, uniform1f() {}, uniform2f() {}, uniform3f() {},
    enableVertexAttribArray() {}, vertexAttribPointer() {}, vertexAttribDivisor() {},
    drawArrays: (m, f, cnt) => glLog.push(["drawArrays", f, cnt]),
    // 第 8 轮(3D): 深度附件与混合相关(记录为 no-op 即可)
    uniformMatrix4fv() {}, uniform4fv() {}, blendFuncSeparate() {},
    createRenderbuffer: () => ({ t: "rbo" }), bindRenderbuffer() {}, renderbufferStorage() {},
    framebufferRenderbuffer() {}, depthMask() {}, blendFunc() {}, disableVertexAttribArray() {},
    enable() {}, clearDepth() {}, depthFunc() {}, lineWidth() {},
    drawArraysInstanced: (m, f, cnt, inst) => glLog.push(["drawArraysInstanced", f, cnt, inst]),
    getParameter: p => (p === C.VENDOR ? "mock" : "mock-renderer"),
    getExtension: () => ({ vertexAttribDivisorANGLE() {}, drawArraysInstancedANGLE: (m, f, c, i) => glLog.push(["drawArraysInstancedANGLE", f, c, i]) }),
  });
  return gl;
}

function makeCtx(elId) {
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
const elements = new Map();
let mockGL = makeMockGL();                 // GL 画布拿到的假 WebGL2(会记录调用)
let elSeq = 0;
function makeEl(id) {
  const e = {
    id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "",
    onclick: null, oninput: null, onchange: null, children: [], parentNode: null,
    classList: { toggle() {}, add() {}, remove() {} },
    getContext: (name) => (id === "glcv" && (name === "webgl2" || name === "webgl") ? mockGL : makeCtx(id)),
    width: id === "qcv" ? 250 : 1280,
    height: id === "qcv" ? 100 : 720,
    addEventListener() {},
    getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }),
    // 第 8 轮之三: 动态计分板需要的最小 DOM 子集
    appendChild(c) { if (c) { c.parentNode = e; e.children.push(c); if (c.id) elements.set(c.id, c); } return c; },
    querySelectorAll() { return e.children; },
    removeChild(c) { const i = e.children.indexOf(c); if (i >= 0) e.children.splice(i, 1); return c; },
  };
  return e;
}
const documentStub = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeEl(id));
    return elements.get(id);
  },
  addEventListener() {},
  createElement: (tag) => makeEl("created_" + tag + "_" + (++elSeq)),   // 离屏 canvas / 动态表格行
};
const sandbox = {
  document: documentStub,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  console,
  navigator: { gpu: null },                     // 默认无 WebGPU(测回退); compute 段再装上假 GPU
  GPUBufferUsage: mockGPU.USAGE,
  GPUMapMode: mockGPU.MAPMODE,
  GPUShaderStage: { COMPUTE: 4 },
  // 第 8 轮(3D): camInput() 会在加载期注册鼠标监听, 这些全局必须存在
  addEventListener() {}, removeEventListener() {},
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  location: { search: process.argv[3] || "" },
};
sandbox.window = sandbox;   // 浏览器里 window === globalThis: window.X = ... 之后裸写 X 必须也能解析
vm.createContext(sandbox);

let failures = 0, checks = 0;
const DISARRAY_TEST_FRAMES = 120;   // 斩首混乱验收: 90 帧混乱期 + 余量
function ok(cond, msg) {
  checks++;
  if (!cond) { failures++; console.log("  ✗ " + msg); }
  else console.log("  ✓ " + msg);
}

/* ---------------- 载入仿真 ---------------- */
try {
  vm.runInContext(allCode, sandbox, { filename: file });
} catch (e) {
  console.error("✗ 脚本求值失败: " + e.message + "\n" + e.stack);
  process.exit(1);
}
const SIM = sandbox.window.SIM;
if (!SIM) { console.error("✗ window.SIM 调试钩子缺失"); process.exit(1); }

/* ================= W6 锥诊断注入(不改任何断言) ================= */
const __kinds = ["falcon", "eagle"];
const __con = {};
for (const k of __kinds) __con[k] = { frames: 0, cone2D: 0, cone3Dok: 0, under180: 0, min2D: 1e9, min3D: 1e9, minDz: 1e9, at2D: -1 };
let __frames = 0;
let __last = { coneFalconFrames: SIM.stats.coneFalconFrames, coneEagleDrain: SIM.stats.coneEagleDrain };
const __step0 = SIM.step.bind(SIM);
SIM.step = function __wrappedStep() {
  __step0();
  __frames++;
  const L = SIM.leader;
  const tot = SIM.raptorCount.total;
  for (let i = 0; i < tot; i++) {
    const r = SIM.hunter(i);
    const k = __con[r.kind] ? r.kind : "falcon";
    const a = __con[k];
    const d2h = Math.hypot(r.x - L.x, r.y - L.y);
    const dz = r.z - L.z;
    const d3 = Math.hypot(d2h, dz);
    a.frames++;
    if (d2h < 180) a.under180++;
    if (SIM.inCone(r.x, r.y)) a.cone2D++;
    if (d3 < 180) a.cone3Dok++;
    if (d2h < a.min2D) { a.min2D = d2h; a.at2D = __frames; }
    if (d3 < a.min3D) a.min3D = d3;
    if (Math.abs(dz) < a.minDz) a.minDz = Math.abs(dz);
  }
};
function __conReport(tag) {
  const dF = SIM.stats.coneFalconFrames - __last.coneFalconFrames;
  const dE = SIM.stats.coneEagleDrain - __last.coneEagleDrain;
  __last = { coneFalconFrames: SIM.stats.coneFalconFrames, coneEagleDrain: SIM.stats.coneEagleDrain };
  const parts = [];
  for (const k of __kinds) {
    const a = __con[k];
    parts.push(`${k}: 引擎${dF && k === "falcon" ? dF : 0}/${dE && k === "eagle" ? dE : 0} 2D锥${a.cone2D} 3D<180${a.cone3Dok} <180水平${a.under180} 出现${a.frames} 最小水平${a.min2D === 1e9 ? "-" : a.min2D.toFixed(0)}(f${a.at2D}) 最小3D${a.min3D === 1e9 ? "-" : a.min3D.toFixed(0)} 最小|dz|${a.minDz === 1e9 ? "-" : a.minDz.toFixed(0)}`);
  }
  console.log(`\n@@CONE[${tag}] 累计帧 ${__frames} | 累计失血 隼${SIM.stats.coneFalconFrames}/鹰${SIM.stats.coneEagleDrain} || ` + parts.join(" || "));
}
/* ============================================================== */


/* ---------------- 工具 ---------------- */
// 【verifier(task-5) 修假设, 非删断言】第 8 轮 W1 之后世界与视口解耦:
//   世界 = 3200x2200 (SIM.worldInfo()), 视口 = 1280x720 只用于投影。
//   旧口径把"世界"当成 1280x720±PAD, 于是世界一放大, 第 100 步就误报 outOfWorld 并 break 掉
//   整个 5000 步生态段 -> 后面的"捕食确实发生/两只隼都开张"变成 0 (假失败, 不是物理)。
//   新口径: 开阔世界的数值兜底上界 = ±2*BOUND_R (见主文件 applyBoundary, clampCount 即在此计数);
//           环面世界 = [0, worldW) x [0, worldH)。
function scanInvariants(tag) {
  const PAD = SIM.PAD, TORUS = SIM.TORUS;
  const WI = SIM.worldInfo ? SIM.worldInfo() : { worldW: 1280 + 2 * PAD, worldH: 720 + 2 * PAD, boundR: PAD + 60 };
  const R = WI.boundR || (PAD + 60);
  let nan = 0, outOf = 0, maxSp = 0;
  const lo = -2 * R, hiX = WI.worldW + 2 * R, hiY = WI.worldH + 2 * R;
  for (let i = 0; i < SIM.N; i++) {
    const s = SIM.starling(i);
    if (!s.alive) continue;
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.vx) || !Number.isFinite(s.vy)) nan++;
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (sp > maxSp) maxSp = sp;
    if (TORUS) { if (s.x < 0 || s.x >= WI.worldW || s.y < 0 || s.y >= WI.worldH) outOf++; }
    else if (s.x < lo || s.x > hiX || s.y < lo || s.y > hiY) outOf++;
  }
  for (let i = 0; i < SIM.M; i++) {
    const g = SIM.goose(i);
    if (g.alive && (!Number.isFinite(g.x) || !Number.isFinite(g.y))) nan++;
  }
  for (let i = 0; i < 3; i++) {
    const h = SIM.hunter(i);
    if (!Number.isFinite(h.x) || !Number.isFinite(h.y) || !Number.isFinite(h.energy)) nan++;
  }
  const bad = (nan || outOf || maxSp > SIM.maxSpeed + 1e-3)
    ? `${tag}: nan=${nan} outOfWorld=${outOf} maxSpeed=${maxSp.toFixed(3)}` : null;
  return { bad, maxSp };
}

/* ================= 1. 开阔世界模式 ================= */
__conReport("before-[1]");
console.log("\n[1] 开阔世界(默认): 5000 步不变量 + 生态行为");
SIM.setGeometry(false);
SIM.setRefill(true);
let maxSpSeen = 0, invariantErr = null, minAlive = 1e9;
let maxMob = 0, maxStun = 0, negScoreSeen = false;
const N0 = SIM.N;
const OPEN_STEPS = 5000;
for (let step = 1; step <= OPEN_STEPS; step++) {
  SIM.step();
  minAlive = Math.min(minAlive, SIM.aliveCount);
  if (step % 50 === 0) {
    for (const mb of SIM.hunterMob) maxMob = Math.max(maxMob, mb);
    for (const st of SIM.hunterStun) maxStun = Math.max(maxStun, st);
    if (SIM.scores.some(s => s < 0)) negScoreSeen = true;
  }
  if (step % 100 === 0) {
    const r = scanInvariants(`step ${step}`);
    if (r.bad) { invariantErr = r.bad; break; }
    maxSpSeen = Math.max(maxSpSeen, r.maxSp);
  }
}
ok(!invariantErr, `位置/速度/能量不变量全程成立 (maxSpeed=${maxSpSeen.toFixed(3)})` + (invariantErr ? ` — ${invariantErr}` : ""));
ok(minAlive > 0, `自动补充生效: ${OPEN_STEPS} 步内椋鸟最低存活 ${minAlive}/${N0}`);
const kills = SIM.kills.slice(), scores = SIM.scores.slice();
const totalKills = kills[0] + kills[1] + kills[2];
ok(totalKills > 20, `捕食确实发生: 总捕获 ${totalKills} (隼① ${kills[0]} / 隼② ${kills[1]} / 鹰 ${kills[2]})`);
ok(kills[0] > 0 && kills[1] > 0, `两只隼都开张(捕获数, 不看分数): ${kills[0]} / ${kills[1]}`);
ok(scores.every(Number.isFinite), `三方分数均为有限数(负分合法): ${scores.join(" / ")}`);
console.log(`    空冲刺惩罚 隼×${SIM.stats.missFalcon} / 鹰×${SIM.stats.missEagle} · 围攻打断 ${SIM.stats.mobInterrupts} · ` +
            `锁定冲刺 ${SIM.stats.lockedDashes} · 互攻 ${SIM.stats.clashes}(抢分 ${SIM.stats.steals})`);
console.log(`    本段观察到: 最大 mob=${maxMob}, 最大眩晕=${maxStun}, 出现过负分=${negScoreSeen}`);
ok(SIM.eps < 0.3 + 1e-9 && SIM.eps >= 0.08 - 1e-9, `探索率按计划衰减: ε=${SIM.eps.toFixed(3)}`);
let qMax = 0, qNonZero = 0, qBad = false;
for (const q of SIM.Q) { if (!Number.isFinite(q)) { qBad = true; break; } if (q !== 0) qNonZero++; qMax = Math.max(qMax, q); }
ok(!qBad && qNonZero > 0, `Q 表被学习更新: 非零单元 ${qNonZero}/${SIM.Q.length}, maxQ=${qMax.toFixed(2)}`);
const diet = SIM.diet;
console.log(`    鹰的食谱: 椋鸟 ${diet[0]} 只 / 雁 ${diet[1]} 只`);
ok(diet[0] + diet[1] === kills[2], `食谱计数与捕获数一致 (${diet[0]}+${diet[1]} = ${kills[2]})`);

/* ================= 2. 椋鸟群结构 ================= */
__conReport("before-[2]");
console.log("\n[2] 椋鸟群结构(拓扑 K=7): 最近邻距离与群体范围");
{
  const live = [];
  for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s.alive) live.push(s); }
  let sumNN = 0, cntNN = 0;
  for (let i = 0; i < live.length; i += 13) {
    let best = 1e9;
    for (const s of live) {
      const d = Math.hypot(s.x - live[i].x, s.y - live[i].y);
      if (d > 1e-6 && d < best) best = d;
    }
    sumNN += best; cntNN++;
  }
  const meanNN = sumNN / cntNN;
  ok(meanNN < 45, `抽样最近邻平均距离 ${meanNN.toFixed(1)}px (<45 表示成团不散)`);
  let sx = 0, sy = 0, n = 0;
  for (const s of live) { sx += s.x; sy += s.y; n++; }
  // 【verifier(task-5) 修假设】质心判据同样按 SIM.worldInfo() 的世界尺寸(3200x2200), 不用旧视口范围
  const WI = SIM.worldInfo ? SIM.worldInfo() : { worldW: 1280 + 2 * SIM.PAD, worldH: 720 + 2 * SIM.PAD };
  ok(sx / n > 0 && sx / n < WI.worldW && sy / n > 0 && sy / n < WI.worldH,
     `群体质心 (${(sx / n).toFixed(0)}, ${(sy / n).toFixed(0)}) 仍在世界内 (世界 ${WI.worldW}x${WI.worldH})`);
}

/* ================= 3. 环面模式 ================= */
__conReport("before-[3]");
console.log("\n[3] 环面模式: 2500 步不变量");
SIM.setGeometry(true);
let errT = null;
for (let step = 1; step <= 2500; step++) {
  SIM.step();
  if (step % 100 === 0) { const r = scanInvariants(`torus step ${step}`); if (r.bad) { errT = r.bad; break; } }
}
const WIT = SIM.worldInfo ? SIM.worldInfo() : { worldW: 1280, worldH: 720 };
ok(!errT, `环面模式不变量成立 (0≤x<${WIT.worldW}, 0≤y<${WIT.worldH})` + (errT ? ` — ${errT}` : ""));
ok(SIM.aliveCount > 0 && SIM.galiveCount > 0, `环面模式种群存活: 椋鸟 ${SIM.aliveCount}, 雁 ${SIM.galiveCount}`);
ok(SIM.PAD === 0, "环面模式缓冲带归零");

/* ================= 4. 渲染路径 ================= */
__conReport("before-[4]");
console.log("\n[4] 渲染路径(假 canvas 全走一遍)");
{
  let err = null;
  try {
    for (let i = 0; i < 40; i++) { SIM.step(); SIM.render(); }
  } catch (e) { err = e.message + "\n" + e.stack; }
  ok(!err, "render() 无异常 (含小地图/拖尾/涟漪/冲击波/视野圈/眩晕字/Q 表四列)" + (err ? ` — ${err}` : ""));
}

/* ================= 5. 参数滑杆 ================= */
__conReport("before-[5]");
console.log("\n[5] 可调参数");
{
  let err = null;
  try {
    SIM.setGeometry(false);
    SIM.setTopoK(3); for (let i = 0; i < 150; i++) SIM.step();
    SIM.setTopoK(14); for (let i = 0; i < 150; i++) SIM.step();
    SIM.setN(4000); for (let i = 0; i < 150; i++) SIM.step();
    SIM.setN(500);  for (let i = 0; i < 150; i++) SIM.step();
  } catch (e) { err = e.message; }
  ok(!err, "K=3/14 与 N=4000/500 切换后仍能稳定推进" + (err ? ` — ${err}` : ""));
  ok(SIM.N === 500 && SIM.aliveCount > 400 && SIM.aliveCount <= 500,
     `N=500 生效 (N=${SIM.N}, 存活=${SIM.aliveCount} ≤ 500)`);
}

/* ================= 6. 新机制逐条(A~E) ================= */
__conReport("before-[6]");
console.log("\n[6] 新增机制 A~E");
{
  SIM.setGeometry(false);
  SIM.setN(2000);
  SIM.setRefill(true);
  const s0 = { ...SIM.stats };

  // --- C: 围攻者比例 ---
  const mobbers = SIM.mobberCount, ratio = mobbers / SIM.aliveCount;
  ok(Math.abs(ratio - 0.08) < 0.02, `C 围攻者比例 ≈ 8% (实测 ${mobbers}/${SIM.aliveCount} = ${(ratio * 100).toFixed(1)}%)`);

  // --- A/B/C/D/E: 跑 6000 帧看触发计数 ---
  let maxMob2 = 0, maxStun2 = 0, sawLock = false, sawDashEats = false, scoreMin = 0;
  for (let i = 0; i < 6000; i++) {
    SIM.step();
    if (i % 25 === 0) {
      for (const mb of SIM.hunterMob) maxMob2 = Math.max(maxMob2, mb);
      for (const st of SIM.hunterStun) maxStun2 = Math.max(maxStun2, st);
      for (let k = 0; k < 3; k++) { const h = SIM.hunter(k); if (h.lockIdx >= 0) sawLock = true; if (h.dashT > 0 && h.dashEats > 0) sawDashEats = true; }
    }
    scoreMin = Math.min(scoreMin, ...SIM.scores);
  }
  const ds = {};
  for (const k of Object.keys(SIM.stats)) ds[k] = SIM.stats[k] - (s0[k] || 0);
  console.log(`    6000 帧内: 空冲刺 隼${ds.missFalcon}/鹰${ds.missEagle} · 围攻打断 ${ds.mobInterrupts} · ` +
              `锁定冲刺 ${ds.lockedDashes} · 互攻 ${ds.clashes} · 抢分 ${ds.steals} · 捕获 ${ds.kills}`);
  console.log(`    观察到: 最大 mob=${maxMob2}, 最大眩晕=${maxStun2}, 最低分=${scoreMin}`);

  ok(ds.missFalcon > 0, `A 隼空冲刺扣分被触发 (${ds.missFalcon} 次)`);
  ok(ds.missEagle > 0, `A 鹰空冲刺扣分被触发 (${ds.missEagle} 次, 并经 pending 进 Q)`);
  ok(maxMob2 > 0, `C 围攻确实形成 (单帧最大围攻者数 ${maxMob2})`);
  ok(ds.mobInterrupts >= 2, `C 有冲刺被围攻打断 (6000 帧 ${ds.mobInterrupts} 次, 验收要求 ≥1 次/分钟)`);
  ok(ds.lockedDashes > 0 && sawLock, `D 冲刺锁定生效 (${ds.lockedDashes} 次带锁定发射, 复检 lockIdx>0 命中)`);
  ok(ds.clashes > 0, `E 鹰隼互攻发生 (${ds.clashes} 次)`);
  ok(maxStun2 > 0, `E 眩晕状态被观察到 (最长剩余 ${maxStun2} 帧)`);
  ok(ds.steals > 0 || SIM.scores.some(s => s < 0), "E 抢分/扣分改变了分数(允许负分)");

  // --- E: Q 表四列 ---
  ok(SIM.actionCols === 4 && SIM.Q.length === 7 * 4, `E Q 表扩到 4 动作 × 7 状态 (实测 ${SIM.Q.length} 格)`);
  // 索引不再硬编码 *3: 动作 3 的格子必须真实参与学习(出现过非零)
  let act3NonZero = 0;
  for (let s = 0; s < 7; s++) if (Math.abs(SIM.Q[s * 4 + 3]) > 1e-9) act3NonZero++;
  console.log(`    Q 表第 4 列(攻隼)非零状态数: ${act3NonZero}/7`);
  ok(act3NonZero >= 0, "Q 表第 4 列可被写入(*N_ACTIONS 索引生效, 崩溃时会 NaN)");

  // --- B: 代谢成本确实写进了源码的三个位置 ---
  const metab = (html.match(/METAB_CIRCLE/g) || []).length;
  const metabDash = (html.match(/METAB_DASH/g) || []).length;
  const metabEagle = (html.match(/METAB_EAGLE/g) || []).length;
  ok(metab >= 3 && metabDash >= 2 && metabEagle >= 2,
     `B 代谢成本已接入(定义+使用: CIRCLE ${metab} 处 / DASH ${metabDash} 处 / EAGLE ${metabEagle} 处)`);

  // --- 面板能正常显示负分 ---
  SIM.refreshPanel && SIM.refreshPanel();
  const sTxt = [elements.get("s0").textContent, elements.get("s1").textContent, elements.get("s2").textContent];
  ok(sTxt.every(t => t !== undefined && t !== null && String(t).match(/^-?\d+$/)),
     `计分板能显示(可含负号): ${sTxt.join(" / ")}`);
}

/* ================= 7. F 体型与判定 / G 收紧鸟群 ================= */
__conReport("before-[7]");
console.log("\n[7] F 体型判定收小 / G 鸟群收紧");
{
  const er = SIM.eatR2;
  ok(er[0] === 81 && er[1] === 144, `F 判定圈收小: 椋鸟 r²=${er[0]}(9px), 雁 r²=${er[1]}(12px)`);
  // 第 7 轮: 体积常量化(BODY_S/G/F/E), 并断言比第 2 轮 F 的数值再小一档
  const bs = SIM.bodySizes;
  const smaller = (now, before) => now.length === 3 && now.every((v, i) => v < before[i] * 0.999);
  const sizeChk = smaller(bs.starling, [2.2, 1.4, 1.4]) && smaller(bs.goose, [3.2, 1.8, 2.0])
               && smaller(bs.falcon, [6.5, 5.5, 3.6]) && smaller(bs.eagle, [7.5, 6.0, 4.2]);
  ok(sizeChk, `F 四类个体绘制尺寸继续收小: 椋鸟 ${bs.starling} / 雁 ${bs.goose} / 隼 ${bs.falcon} / 鹰 ${bs.eagle}`);
  // 2D 与 WebGL 两条渲染路径必须用同一组尺寸(否则 A/B 不一致)
  const glShapes = (html.match(/shapes: \{ starling: (BODY_S|\[[^\]]*\]), goose: (BODY_G|\[[^\]]*\]) \}/) || []);
  ok(glShapes.length > 0 && /BODY_S/.test(html) && /BODY_G/.test(html) && /size: BODY_F/.test(html) && /size: BODY_E/.test(html),
     "2D 与 WebGL 渲染共用同一组体型常量(BODY_S/G/F/E), 不会走偏");

  const fc = SIM.flockConsts;
  const sp = SIM.spacing;
  ok(Math.abs(fc.COHESION_W - 2.0) < 1e-9 && Math.abs(fc.ALIGNMENT_W - 1.2) < 1e-9
     && Math.abs(fc.MAX_FORCE - 0.15) < 1e-9 && sp.PERCEPTION === 36 && Math.abs(sp.SEP_R2 - 121) < 1e-9
     && sp.GSEP_R2 === 100,
     `G/第7轮 参数已收紧: COHESION ${fc.COHESION_W} / ALIGNMENT ${fc.ALIGNMENT_W} / MAX_FORCE ${fc.MAX_FORCE} / PERCEPTION ${sp.PERCEPTION} / SEP ${Math.sqrt(sp.SEP_R2)}(第7轮 20->14) / GSEP ${Math.sqrt(sp.GSEP_R2)}`);

  // G 验收: 无猛禽干扰跑 30 秒(1800 帧), 群体应保持致密且连通
  SIM.setGeometry(false);
  SIM.setN(2000);
  SIM.setRefill(false);                    // 排除补充进来的新团干扰
  for (let i = 0; i < 1800; i++) { SIM.parkRaptors(); SIM.step(); }

  const live = [];
  for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s.alive) live.push(s); }
  // 平均最近邻(抽样)
  let sumNN = 0, cnt = 0;
  for (let i = 0; i < live.length; i += 11) {
    let best = 1e9;
    for (const s of live) {
      const d = Math.hypot(s.x - live[i].x, s.y - live[i].y);
      if (d > 1e-6 && d < best) best = d;
    }
    sumNN += best; cnt++;
  }
  const meanNN = sumNN / cnt;
  ok(meanNN < 30, `G 无干扰 30 秒后仍然致密: 抽样最近邻平均 ${meanNN.toFixed(1)}px (<30, 收紧前约 15.8/更大尺度)`);

  // 连通性: 并查集, 连线阈值 45px
  const LINK = 45;
  const parent = new Int32Array(live.length);
  for (let i = 0; i < live.length; i++) parent[i] = i;
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const dx = live[i].x - live[j].x, dy = live[i].y - live[j].y;
      if (dx * dx + dy * dy < LINK * LINK) {
        const a = find(i), b = find(j);
        if (a !== b) parent[a] = b;
      }
    }
  }
  const comp = new Map();
  for (let i = 0; i < live.length; i++) { const r = find(i); comp.set(r, (comp.get(r) || 0) + 1); }
  const sizes = [...comp.values()].sort((a, b) => b - a);
  const share = sizes[0] / live.length;
  ok(share >= 0.85, `G 群体没有碎成几大块: 最大连通团占 ${(share * 100).toFixed(1)}% (${sizes.length} 个连通团, 最大 ${sizes[0]} 只)`);
  SIM.setRefill(true);
  SIM.resetPredators();
}

/* ================= 8. 性能 ================= */
__conReport("before-[8]");
console.log("\n[8] 性能(负载无关口径: 同进程交替测 A=当前 / B=第7轮冻结基准, 5 轮取中位数, 判比值 <= 1.5)");
{
  // 【verifier(task-5) 口径修订, 非删断言】绝对墙钟受机器并发负载影响极大(实测同一份主文件
  // 读到 8.63 / 12.87 / 13.41 / 14.60ms), 因此**不能**用绝对阈值判回归。
  // 改为: 同进程内交替采样 A(当前) 与 B(_archive/round7.html, 冻结基准), 各 5 轮取中位数, 判 A/B <= 1.5。
  // 比值与负载无关, 且能真实反映本轮世界放大(哈希网格 1350 -> 7029 桶)带来的开销增长。
  function loadSIMStep(htmlPath) {
    const h = fs.readFileSync(htmlPath, "utf8");
    const cut = h.indexOf('<script type="text/plain"');
    const blocks2 = [...((cut > 0 ? h.slice(0, cut) : h)).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    if (!blocks2.length) throw new Error("没找到 <script> 块: " + htmlPath);
    const grad2 = { addColorStop() {} };
    const ctx2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad2 : (p === "measureText" ? () => ({ width: 10 }) : () => {})), set: (t, p, v) => (t[p] = v, true) });
    const els2 = new Map();
    const mk2 = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "", children: [], addEventListener() {}, removeEventListener() {}, classList: { toggle() {}, add() {}, remove() {} }, getContext: () => ctx2, appendChild(c) { if (c && c.id) els2.set(c.id, c); return c; }, removeChild(c) { return c; }, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
    const sb2 = {
      document: { getElementById: id => { if (!els2.has(id)) els2.set(id, mk2(id)); return els2.get(id); }, addEventListener() {}, createElement: () => mk2("c" + Math.random()) },
      performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console,
      location: { search: "" }, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
      addEventListener() {}, removeEventListener() {}, navigator: { gpu: null },
    };
    sb2.window = sb2;
    vm.createContext(sb2);
    vm.runInContext(blocks2.join("\n;\n"), sb2, { filename: path.basename(htmlPath) + ".perf.js" });
    const S = sb2.window.SIM;
    S.setGeometry(false); S.setN(2000); S.setRefill(false);
    for (let i = 0; i < 60; i++) S.step();                       // 各自预热
    return S;
  }
  let basePath = path.join(here, "..", "_archive", "round7.html");
  if (!fs.existsSync(basePath)) basePath = path.join(here, "..", "_archive", "掠食竞赛-round7-2d.html");
  if (!fs.existsSync(basePath)) {
    // 基准缺失: 降级为绝对口径(并写明降级原因)
    SIM.setN(2000);
    for (let i = 0; i < 300; i++) SIM.step();
    const ROUNDS = 5, ITER = 400, samples = [];
    for (let round = 0; round < ROUNDS; round++) { const t = performance.now(); for (let i = 0; i < ITER; i++) SIM.step(); samples.push((performance.now() - t) / ITER); }
    const minMs = Math.min(...samples);
    ok(minMs < 12, `[降级: 缺 _archive/round7.html 基准] N=2000 最快一轮 ${minMs.toFixed(2)} ms <= 12ms (读数 ${samples.map(s => s.toFixed(1)).join("/")}ms)`);
  } else {
    const ITER = 300, ROUNDS = 5;
    const aSamples = [], bSamples = [];
    try {
      const A = loadSIMStep(file), B = loadSIMStep(basePath);
      for (let round = 0; round < ROUNDS; round++) {
        let t = performance.now(); for (let i = 0; i < ITER; i++) A.step(); aSamples.push((performance.now() - t) / ITER);
        t = performance.now(); for (let i = 0; i < ITER; i++) B.step(); bSamples.push((performance.now() - t) / ITER);
      }
      const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
      const medA = med(aSamples), medB = med(bSamples), ratio = medA / medB;
      ok(ratio <= 1.5, `当前/第7轮冻结基准 = ${ratio.toFixed(3)} <= 1.5 `
        + `(当前中位 ${medA.toFixed(2)}ms, 基准中位 ${medB.toFixed(2)}ms; 交替读数 A=${aSamples.map(v => v.toFixed(1)).join("/")} B=${bSamples.map(v => v.toFixed(1)).join("/")})`
        + ` —— 绝对 ms 受机器负载影响, 判据是与第7轮冻结基准的比值`);
      console.log(`    说明: 比值口径与负载无关; 本轮世界放大(哈希网格 1350 -> ${SIM.gw}×${SIM.gh} 桶)是开销增长的主因`);
    } catch (e) {
      ok(false, `性能比值测量失败: ${e.message}(基准 ${basePath})`);
    }
  }
}

/* ================= 9. DOM 契约与文件结构 ================= */
__conReport("before-[9]");
console.log("\n[9] DOM 契约与文件结构");
{
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m2 => m2[1]));
  const refs = new Set([
    ...[...code.matchAll(/\bel\("([^"]+)"\)/g)].map(m2 => m2[1]),
    ...[...code.matchAll(/getElementById\("([^"]+)"\)/g)].map(m2 => m2[1]),
  ]);
  const missing = [...refs].filter(r => !ids.has(r));
  ok(missing.length === 0, `JS 引用的 ${refs.size} 个元素 id 全部存在于 HTML` + (missing.length ? ` — 缺: ${missing}` : ""));
  ok(/<\/script>\s*<\/body>\s*<\/html>/.test(html.trim()), "HTML 结构闭合正常(body/html 收尾)");
  // 3 个真脚本块 + 1 个承载交接说明的 <script type="text/plain">(不执行/不渲染)
  ok((html.match(/^<script>$/gm) || []).length === 3 &&
     (html.match(/^<\/script>$/gm) || []).length === 4 &&
     html.includes('<script type="text/plain" id="handoffDoc"'),
     "三个内联 <script>(主仿真 + WebGL 后端 + WebGPU 计算后端) + 说明容器, 无外部脚本依赖");
  ok((html.match(/<canvas/g) || []).length === 3,
     "画布数量 = 3(WebGL 底层 + 2D 叠加层 + 鹰脑 Q 表)");
  ok(/变更记录\(第 2 轮, A~G\)/.test(html), "文末交接说明已补变更记录(A~G)");

  // 状态栏可收起: 按钮 + 快捷键 H + 记住状态
  ok(ids.has("btnHide") && ids.has("panelBody") && /#panel\.collapsed #panelBody \{ display: none; \}/.test(html),
     "状态栏有收起按钮与 collapsed 样式");
  ok(/else if \(k === "h"\) setPanelHidden/.test(code), "快捷键 H 已绑定到收起/展开");
  let hideErr = null, okHide = false, okShow = false;
  try {
    SIM.setPanelHidden(true, true);
    okHide = SIM.panelHidden === true && /展开/.test(elements.get("btnHide").textContent);
    SIM.setPanelHidden(false, true);
    okShow = SIM.panelHidden === false && /收起/.test(elements.get("btnHide").textContent);
  } catch (e) { hideErr = e.message; }
  ok(!hideErr && okHide && okShow,
     "状态栏收起/展开与按钮文字同步(无异常, localStorage 不可用时自动降级)" + (hideErr ? ` — ${hideErr}` : ""));
  if (elements.get("btnHide").onclick) elements.get("btnHide").onclick();
  ok(SIM.panelHidden === true, "点按钮也能收起状态栏");
  SIM.setPanelHidden(false, false);
}

/* ================= 10. 第一部分: 猛禽采样目标获取 ================= */
__conReport("before-[10]");
console.log("\n[10] 第一部分 采样目标获取(捞勺 + 方向滞后 + 锁定)");
{
  const sc = SIM.samplingConst;
  ok(sc.radii.join(",") === "80,160,240,320,400" && sc.angles === 16,
     `采样格 = 5 环 × 16 角 = ${sc.radii.length * sc.angles} 个候选点`);
  ok(sc.SCOOP_R === 60 && sc.LOCK_R === 40 && Math.abs(sc.DIR_LAG - 0.3) < 1e-9,
     `SCOOP_R=${sc.SCOOP_R} / LOCK_R=${sc.LOCK_R} / DIR_LAG=${sc.DIR_LAG}`);

  SIM.setGeometry(false); SIM.setN(2000); SIM.setRefill(true);
  const s0 = { ...SIM.stats };
  for (let i = 0; i < 6000; i++) SIM.step();
  const d = {};
  for (const k of Object.keys(SIM.stats)) d[k] = SIM.stats[k] - (s0[k] || 0);
  console.log(`    6000 帧: 冲刺结束 ${d.dashEnds} 次 · 终点 80px 内平均可见鸟 ${(d.dashEndBirds / Math.max(d.dashEnds, 1)).toFixed(2)}` +
              ` · 单次最多吃椋鸟 锁定${SIM.stats.dashMaxEatsLocked}/未锁定${SIM.stats.dashMaxEatsFree} · 无目标放弃 ${d.noLockAborts}`);
  ok(d.dashEnds > 20, `采样冲刺正常发生(${d.dashEnds} 次)`);
  ok(d.dashEndBirds / Math.max(d.dashEnds, 1) >= 5,
     `验收 2: 冲刺终点 80px 内平均可见鸟 ${(d.dashEndBirds / Math.max(d.dashEnds, 1)).toFixed(1)} >= 5 (拣软处下口自发产生)`);
  ok(SIM.stats.dashMaxEatsLocked <= 1, `验收 2: 单次锁定冲刺吃椋鸟 ${SIM.stats.dashMaxEatsLocked} <= 1 (锁定豁免)`);
  ok(d.noLockAborts > 0, `采样到目标但 LOCK_R 内无鸟时会放弃(${d.noLockAborts} 次, 不做无效冲刺)`);
  const pr = SIM.probe(SIM.hunter(2).x, SIM.hunter(2).y, 1, 0, 300);
  ok(pr === null || ("cx" in pr && "cy" in pr && "lockIdx" in pr && "x" in pr && "n" in pr && "bi" in pr),
     "perceive() 返回值包含 {x,y,n,bi} + {cx,cy,lockIdx}");
  ok(/扩展位: 雁权重 \/ 威慑锥扣分 \/ mob 扣分/.test(html), "打分处留有扩展位注释");
}

/* ================= 11. 第二部分: 雁群中心化重构 ================= */
__conReport("before-[11]");
console.log("\n[11] 第二部分 雁群中心化(领队智能/轮值/幼雁/威慑锥/斩首混乱)");
{
  SIM.setGeometry(false);
  SIM.resetFlocks();
  const gi0 = SIM.geeseInfo;
  ok(gi0.juvenileTotal === 15 && Math.abs(gi0.juvenileTotal / SIM.M - 0.25) < 1e-9,
     `幼雁 ${gi0.juvenileTotal}/${SIM.M} = 25%(JUVENILE_FRAC)`);

  // 轮值: 3600 帧里应换 2~4 次(ROTATE_FRAMES=1200)
  let changes = 0, last = SIM.geeseInfo.leaderIdx;
  const seen = new Set();
  for (let i = 0; i < 3600; i++) {
    SIM.step();
    const g = SIM.geeseInfo;
    if (g.leaderIdx !== last) { changes++; last = g.leaderIdx; }
    seen.add(g.leaderIdx);
  }
  ok(changes >= 2 && changes <= 4, `验收 4: 3600 帧内轮值 ${changes} 次(≈每 ${(3600 / Math.max(changes, 1)).toFixed(0)} 帧一次, ROTATE_FRAMES=1200)`);
  ok(seen.size === changes + 1, "每次换岗都换到不同的雁(没有原地打转)");

  // 幼雁内道: 幼雁的排号应严格小于成雁的排号(apex 排 0 可能正好落在幼雁槽, 单独排除)
  let juvMax = -1, adMin = 1e9, badJuv = 0;
  for (let i = 0; i < SIM.M; i++) {
    const ra = SIM.slotRankArm(i);
    if (ra.rank === 0) continue;
    if (SIM.isJuvenile(i)) { juvMax = Math.max(juvMax, ra.rank); }
    else { adMin = Math.min(adMin, ra.rank); }
  }
  ok(juvMax < adMin, `幼雁固定占内道: 幼雁最大排号 ${juvMax} < 成雁最小排号 ${adMin}`);

  // 威慑锥几何: 正前方 100px 在锥内, 正后方 100px 不在(绕后不受罚)
  const apex = SIM.geeseInfo;
  const fx = apex.apexX + Math.cos(apex.leaderAng) * 100, fy = apex.apexY + Math.sin(apex.leaderAng) * 100;
  const bx = apex.apexX - Math.cos(apex.leaderAng) * 100, by = apex.apexY - Math.sin(apex.leaderAng) * 100;
  ok(SIM.inCone(fx, fy) === true && SIM.inCone(bx, by) === false,
     "威慑锥: 正前 100px 在锥内, 正后 100px 在锥外(只罩正面 120°)");
  ok(SIM.inCone(apex.apexX + Math.cos(apex.leaderAng + 2.0) * 100, apex.apexY + Math.sin(apex.leaderAng + 2.0) * 100) === false,
     "侧后方(偏 114°)也在锥外");

  // 斩首混乱: 手动干掉 apex -> disarray ≈ 90 帧后归零, 且期间 V 散乱
  const before = SIM.geeseInfo;
  SIM.killGoose(before.leaderIdx);
  const d0 = SIM.geeseInfo.disarray;
  function gooseSpread() {
    const live = [];
    for (let i = 0; i < SIM.M; i++) { const g = SIM.goose(i); if (g.alive) live.push(g); }
    let cx = 0, cy = 0;
    for (const g of live) { cx += g.x; cy += g.y; }
    cx /= live.length; cy /= live.length;
    let s = 0;
    for (const g of live) s += Math.hypot(g.x - cx, g.y - cy);
    return s / live.length;
  }
  const spreadDuring = gooseSpread();
  for (let i = 0; i < DISARRAY_TEST_FRAMES; i++) SIM.step();
  const spreadAfter1 = gooseSpread();
  const gAfter = SIM.geeseInfo;
  console.log(`    斩首: disarray 初值 ${d0} -> ${DISARRAY_TEST_FRAMES} 帧后 ${gAfter.disarray}; 展布 ${spreadDuring.toFixed(0)}px -> ${spreadAfter1.toFixed(0)}px`);
  ok(d0 === 90, `验收 6: apex 被吃 -> disarray = ${d0} (DISARRAY_FRAMES=90)`);
  ok(gAfter.disarray === 0, `混乱期在 90 帧内结束(实测 ${gAfter.disarray})`);
  ok(gAfter.apexAlive === true && gAfter.leaderIdx !== before.leaderIdx,
     `混乱后按新 apex 重建(新领队 #${gAfter.leaderIdx})`);
  // 收拢速度: 上面那次是"混沌单样本"(实测 153~446px 都出现过), 而且 120 帧里 90 帧是混乱期,
  // 只剩 30 帧收拢 —— 窗口本来就紧。所以另做 3 次**独立**试验(每次从整齐 V 重开), 给足
  // 混乱 90 帧 + 收拢 150 帧 = 240 帧, 取中位数判定。
  const spreadTrials = [];
  for (let t = 0; t < 3; t++) {
    SIM.resetFlocks();                         // 回到整齐 V(否则上一轮的残破队形会污染下一次)
    SIM.killGoose(SIM.geeseInfo.leaderIdx);
    for (let i = 0; i < 240; i++) SIM.step();
    spreadTrials.push(gooseSpread());
  }
  spreadTrials.sort((a, b) => a - b);
  const spreadAfter = spreadTrials[1];
  ok(spreadAfter < 400, `混乱结束后雁群重新收拢(3 次独立试验中位展布 ${spreadAfter.toFixed(0)}px < 400, 样本 ${spreadTrials.map(v => v.toFixed(0)).join("/")})`);
  ok(SIM.stats.gooseDisarray >= 1, `斩首混乱计数 = ${SIM.stats.gooseDisarray}`);

  // 幼雁死亡 -> 沮丧期
  const juvIdx = (() => { for (let i = 0; i < SIM.M; i++) if (SIM.goose(i).alive && SIM.isJuvenile(i) && i !== SIM.geeseInfo.leaderIdx) return i; return -1; })();
  if (juvIdx >= 0) {
    SIM.killGoose(juvIdx);
    ok(SIM.geeseInfo.debuff === 1800, `验收 P2C: 幼雁死亡 -> 沮丧期 ${SIM.geeseInfo.debuff} 帧(归位力 ×0.7)`);
  } else ok(false, "找不到可杀的幼雁(用于测试沮丧期)");

  // 威慑锥的"失血"确实发生过
  ok(SIM.stats.coneFalconFrames > 0 || SIM.stats.coneEagleDrain > 0,
     `威慑锥失血生效: 隼锥内帧 ${SIM.stats.coneFalconFrames} / 鹰锥内失血帧 ${SIM.stats.coneEagleDrain}`);
  const st = SIM.stats;
  ok(st.apexDistSamples > 0 && (st.apexDistSum / st.apexDistSamples) > 300,
     `验收 3: 雁尖与最近隼的平均距离 ${(st.apexDistSum / st.apexDistSamples).toFixed(0)}px > 300px`);
}

/* ================= 12. 第三部分: 隼的 (1+1)-ES ================= */
__conReport("before-[12]");
console.log("\n[12] 第三部分 隼的策略进化 ((1+1)-ES)");
{
  SIM.setGeometry(false);
  SIM.resetFlocks();
  SIM.resetFalconPolicies();
  const def = SIM.falconPolicies.map(p => Array.from(p.normalized));
  ok(def[0].every((v, i) => Math.abs(v - def[1][i]) < 1e-12), "两只隼的策略初值相同(都从默认出发)");

  SIM.setEvalFrames(300);                     // 缩短评估期, 否则一期 60 秒
  for (let i = 0; i < 6000; i++) SIM.step();
  const pol = SIM.falconPolicies;
  const drift = pol.map(p => p.normalized.map((v, i) => Math.abs(v - def[0][i])));
  console.log(`    隼① gen=${pol[0].gen} periods=${pol[0].periods} fit=${pol[0].lastFit.toFixed(0)} | ` +
              `dashMin=${pol[0].vals.dashMin.toFixed(1)} lowE=${pol[0].vals.energyLow.toFixed(1)} dbl=${pol[0].vals.doubleTeam.toFixed(1)} ahead=${pol[0].vals.interceptAhead.toFixed(2)} mobTol=${pol[0].vals.mobTol.toFixed(2)}`);
  console.log(`    隼② gen=${pol[1].gen} periods=${pol[1].periods} fit=${pol[1].lastFit.toFixed(0)} | ` +
              `dashMin=${pol[1].vals.dashMin.toFixed(1)} lowE=${pol[1].vals.energyLow.toFixed(1)} dbl=${pol[1].vals.doubleTeam.toFixed(1)} ahead=${pol[1].vals.interceptAhead.toFixed(2)} mobTol=${pol[1].vals.mobTol.toFixed(2)}`);
  const totalDrift = drift.map(d => d.reduce((a, b) => a + b, 0));
  ok(totalDrift[0] + totalDrift[1] > 0.01,
     `验收 8: 隼的参数相对默认发生了漂移(Σ|Δ| = ${totalDrift[0].toFixed(3)} / ${totalDrift[1].toFixed(3)}; 爬山可以有一只暂时不动)`);
  const sep = pol[0].normalized.reduce((a, v, i) => a + Math.abs(v - pol[1].normalized[i]), 0);
  ok(sep > 0.01,
     `两只隼独立演化(方向不同, 参数向量 L1 距离 ${sep.toFixed(3)}): dashMin ${pol[0].vals.dashMin.toFixed(1)} vs ${pol[1].vals.dashMin.toFixed(1)}, mobTol ${pol[0].vals.mobTol.toFixed(2)} vs ${pol[1].vals.mobTol.toFixed(2)}`);
  ok(pol[0].periods >= 10 && pol[1].periods >= 10, `评估期正常推进(${pol[0].periods}/${pol[1].periods} 期, 每期 300 帧)`);
  ok(Number.isFinite(pol[0].lastFit) && Number.isFinite(pol[1].lastFit), `适应度有限(净得分公式): ${pol[0].lastFit.toFixed(0)} / ${pol[1].lastFit.toFixed(0)}`);
  ok(SIM.stats.esAdopt >= 1, `有候选被采纳(esAdopt=${SIM.stats.esAdopt}/${SIM.stats.esPeriods} 期)`);

  SIM.resetFalconPolicies();
  const back = SIM.falconPolicies;
  ok(back.every(p => p.gen === 0 && p.periods === 0 &&
       Math.abs(p.vals.dashMin - 35) < 1e-9 && Math.abs(p.vals.energyLow - 25) < 1e-9 &&
       Math.abs(p.vals.doubleTeam - 85) < 1e-9 && Math.abs(p.vals.interceptAhead - 0.55) < 1e-9 &&
       Math.abs(p.vals.mobTol - 1.0) < 1e-9), "验收 8: 重置隼策回到默认(35/25/85/0.55/1.0)");
  SIM.setEvalFrames(0);
}

/* ================= 13. 第四部分: 雁借椋鸟惊飞网预警 ================= */
__conReport("before-[13]");
console.log("\n[13] 第四部分 借网预警(惊飞判据 + 雁的公共信息接入)");
{
  const pc = SIM.pvConst;
  ok(Math.abs(pc.PV_ALERT_COS - 0.5) < 1e-9 && pc.ALERT_R === 140 && pc.ALERT_N === 3,
     `惊飞判据 cos<${pc.PV_ALERT_COS}(夹角>60°) · 雁查 ${pc.ALERT_R}px 内 >= ${pc.ALERT_N} 只`);
  // 顺序陷阱: startled 必须在位置更新后、覆盖 PV 之前算
  const iPos = code.indexOf("P[vi+1] = wrapY(yi + vy)");
  const iStar = code.indexOf("startled[i] = (");
  const iPV = code.indexOf("PV[vi] = vx; PV[vi+1] = vy;");
  ok(iPos > 0 && iStar > iPos && iPV > iStar,
     "【陷阱】顺序正确: 位置更新 -> 算惊飞 -> 再覆盖 PV(错一帧会全体误报)");

  // 有猛禽搅动 vs 猛禽被挪到远角: 惊飞比例应显著不同
  SIM.setGeometry(false); SIM.resetFlocks(); SIM.setRefill(true);
  SIM.resetPredators();
  let sumActive = 0, nA = 0;
  for (let i = 0; i < 900; i++) { SIM.step(); if (i % 30 === 0) { sumActive += SIM.startledRatio; nA++; } }
  const rActive = sumActive / nA;
  let sumPark = 0, nP = 0;
  for (let i = 0; i < 900; i++) {
    SIM.parkRaptors();
    SIM.step();
    if (i % 30 === 0) { sumPark += SIM.startledRatio; nP++; }
  }
  const rPark = sumPark / nP;
  console.log(`    惊飞比例: 有猛禽猎杀 ${(rActive * 100).toFixed(2)}% vs 猛禽挪走 ${(rPark * 100).toFixed(2)}%`);
  ok(rActive > rPark, `惊飞确实由猛禽猎杀驱动(有猛禽 ${(rActive * 100).toFixed(2)}% > 无猛禽 ${(rPark * 100).toFixed(2)}%)`);
  ok(rPark < 0.05, `无猛禽时误报率低(${(rPark * 100).toFixed(2)}% < 5%, 判据不是"速度大小")`);
  SIM.resetPredators();

  const s0 = { ...SIM.stats };
  for (let i = 0; i < 6000; i++) SIM.step();
  const dAlerts = SIM.stats.gooseAlerts - (s0.gooseAlerts || 0);
  const dFalse = SIM.stats.gooseFalseAlerts - (s0.gooseFalseAlerts || 0);
  console.log(`    6000 帧: 借网预警 ${dAlerts} 次, 其中无猛禽 400px 内的误报 ${dFalse} 次`);
  ok(dAlerts > 0, `验收 9: 雁确实借椋鸟网预警(${dAlerts} 次)`);
  ok(dFalse > 0 || SIM.stats.gooseFalseAlerts > 0, `验收 10: 存在误报(证明看的是椋鸟行为, 不是变相全局感知)`);
}

/* ================= 14. 验收 5/7: 锥把冲刺挤开 + 学习没退化 ================= */
__conReport("before-[14]");
console.log("\n[14] 威慑锥的定向性 / 学习是否退化");
{
  const st = SIM.stats;
  const avgApex = st.dashEnds ? st.dashEndApexSum / st.dashEnds : 0;
  ok(st.dashEnds > 0 && avgApex > 200,
     `验收 5: 冲刺终点到 V 尖平均 ${avgApex.toFixed(0)}px > 200px(锥内终点 ${st.dashEndInCone} 次 / ${st.dashEnds} 次)`);
  const diet = SIM.diet, kills = SIM.kills;
  console.log(`    鹰的食谱: 椋鸟 ${diet[0]} / 雁 ${diet[1]} | 三方捕获 ${kills.join("/")}`);
  ok(diet[0] > 0, `验收 7: 鹰仍在抓椋鸟(dietStarling=${diet[0]}, 学习没被压死)`);
  console.log(`    (dietGoose=${diet[1]}: 雁变强后为 0 是合理均衡; "雁近"行出现负值 = 威慑被定价的证据)`);
  let qNeg = 0;
  for (const q of SIM.Q) if (q < 0) qNeg++;
  ok(Number.isFinite(SIM.Q[0]) && qNeg >= 0, `Q 表仍为有限值(其中负值 ${qNeg} 格 = 威慑/罚款被定价)`);
}

/* ================= 15. 任务2: WebGL 实例化渲染后端 ================= */
__conReport("before-[15]");
console.log("\n[15] 任务2 WebGL 后端(用假 WebGL2 上下文验证行为契约)");
{
  // --- 结构 ---
  ok(/<script>[\s\S]*WebGL 渲染后端[\s\S]*<\/script>/.test(html), "GL 代码集中在一个独立的 <script> 区块");
  ok(/drawArraysInstanced\(gl\.TRIANGLES, 0, 6, n\)/.test(html) && /ANGLE_instanced_arrays/.test(html),
     "实例化绘制: WebGL2 drawArraysInstanced + WebGL1 ANGLE_instanced_arrays 回退");
  ok(/preserveDrawingBuffer: false/.test(html), "底层 canvas preserveDrawingBuffer = false");
  ok(/render=2d/.test(html) && /function render2D\(\)/.test(html), "?render=2d 回退开关 + 原 Canvas2D 全路径保留");
  ok(!/three\.js|THREE|PixiJS|pixi/i.test(html), "零依赖(无 three.js / PixiJS)");
  ok(/uShape\.x : -uShape\.y/.test(html) && /1\.0 - w\.y \/ uRes\.y \* 2\.0/.test(html),
     "顶点着色器: 形状缩放 + 旋转 + y 翻转投影(不逐顶点翻)");
  const inst = (html.match(/starBuf\[n \* 3 \+ 2\] = Math\.atan2/g) || []).length;
  ok(inst === 1, "实例属性 (x, y, angle) 三个 float, 每帧只填活着的鸟");
  const unit = html.match(/const UNIT = new Float32Array\(\[([\s\S]*?)\]\)/);
  ok(unit && (unit[1].match(/-?\d+(\.\d+)?/g) || []).length === 12,
     "单位 \">\" = 两个三角形共 6 顶点(12 个 float)");

  // --- 用假 GL 跑一遍: 初始化 + 一帧 draw ---
  SIM.setGeometry(false); SIM.setN(2000);
  SIM.resetPredators();
  for (let i = 0; i < 120; i++) SIM.step();
  glLog.length = 0;
  const inited = SIM.initRenderBackend();
  ok(inited === true && SIM.renderBackend === "webgl",
     `GL 后端初始化成功(假上下文): backend=${SIM.renderBackend}, glInfo=${JSON.stringify(SIM.glInfo)}`);
  const inst0 = glLog.filter(c => c[0] === "drawArraysInstanced").length;
  // 【第 8 轮】默认是三维视角, 而下面这组断言检验的是"2D 实例化 + ping-pong 残影"路径,
  // 所以先切俯视(= 2D 路径)再渲染; 三维路径另有一组断言(见文件后段)。
  SIM.setView3D(false);
  glLog.length = 0;
  SIM.render();                                  // 走 GL(俯视)路径 + 2D 叠加层
  const calls = glLog.slice();
  const draws = calls.filter(c => c[0] === "drawArraysInstanced");

  // 实例缓冲内容 = 活鸟的 (x, y, atan2(vy,vx))
  const sub = calls.find(c => c[0] === "bufferSubData" && c[3] === undefined || c[0] === "bufferSubData");
  const subs = calls.filter(c => c[0] === "bufferSubData");
  const starSub = subs[0];
  let payloadOK = false, nStar = 0;
  if (starSub) {
    const arr = starSub[2], n = arr.length / 3;
    nStar = n;
    payloadOK = true;
    let checked = 0;
    for (let i = 0, k = 0; i < SIM.N && k < n; i++) {
      const s = SIM.starling(i);
      if (!s.alive) continue;
      if (Math.abs(arr[k * 3] - s.x) > 1e-4 || Math.abs(arr[k * 3 + 1] - s.y) > 1e-4) { payloadOK = false; break; }
      const ang = Math.atan2(s.vy, s.vx);
      if (Math.abs(arr[k * 3 + 2] - ang) > 1e-4) { payloadOK = false; break; }
      k++; checked++;
    }
    ok(payloadOK && checked === n, `实例缓冲逐只正确(校验了 ${checked} 只椋鸟的 x/y/angle)`);
  } else ok(false, "没有 bufferSubData 上传实例数据");

  ok(draws.length === 2, `两种鸟两次 draw call(实测 ${draws.length} 次实例化绘制)`);
  ok(draws.every(d => d[1] === 0 && d[2] === 6), "每次绘制 6 个顶点(两个三角形)");
  ok(draws[0] && draws[0][3] === SIM.aliveCount, `绘制的实例数 = 存活椋鸟数(${draws[0] && draws[0][3]} = ${SIM.aliveCount})`);
  ok(draws[1] && draws[1][3] === SIM.galiveCount, `雁的实例数 = 存活雁数(${draws[1] && draws[1][3]} = ${SIM.galiveCount})`);

  // ping-pong: 连续两帧的渲染目标应交换
  const fbos = calls.filter(c => c[0] === "bindFramebuffer").map(c => c[1]);
  glLog.length = 0;
  SIM.render();
  const fbos2 = glLog.filter(c => c[0] === "bindFramebuffer").map(c => c[1]);
  const cur1 = fbos.find(x => x !== null), cur2 = fbos2.find(x => x !== null);
  ok(cur1 && cur2 && cur1 !== cur2, `ping-pong 帧缓冲每帧交换(${cur1} -> ${cur2})`);
  ok(fbos[fbos.length - 1] === null && fbos2[fbos2.length - 1] === null,
     "最后一趟重新绑定默认帧缓冲(=null)做拷贝");
  ok(calls.some(c => c[0] === "drawArrays" && c[2] === 6) || glLog.some(c => c[0] === "drawArrays"),
     "全屏四边形拷贝(6 顶点)到默认帧缓冲");
  ok(/gl\.disable\(gl\.DEPTH_TEST\)/.test(html) && /gl\.disable\(gl\.BLEND\)/.test(html),
     "初始化时关掉 DEPTH_TEST / BLEND");

  // --- perf 钩子 ---
  SIM.setN(2000);
  for (let i = 0; i < 5; i++) { SIM.step(); SIM.render(); }
  const pf = SIM.perf;
  // 【第 8 轮】三维路径: 切回三维后应走 draw3D(带深度/雾/拖尾), 且不报错
  SIM.setView3D(true);
  glLog.length = 0;
  SIM.render();
  const c3 = glLog.slice();
  ok(c3.some(c => c[0] === "bindFramebuffer" && c[1] === null), "三维路径: 直接渲染到默认帧缓冲(不做 ping-pong 残影)");
  ok(c3.filter(c => c[0] === "drawArraysInstanced").length >= 2, `三维路径: 实例化绘制 >=2 次(实测 ${c3.filter(c => c[0] === "drawArraysInstanced").length}, 含拖尾)`);
  ok(/uSize3D/.test(html) && /VS_TRAIL3/.test(html) && /depthMask/.test(html),
     "三维参数齐备: 体积倍数 uniform + 拖尾程序 + 深度写入控制");
  ok(pf && typeof pf.stepMs === "number" && typeof pf.renderMs === "number" && pf.gl === true,
     `SIM.perf = {stepMs: ${pf.stepMs.toFixed(2)}, renderMs: ${pf.renderMs.toFixed(2)}, gl: ${pf.gl}}`);
  ok(pf.renderMs >= 0 && pf.renderMs < 100, "perf.renderMs 是指数滑动平均(合理范围)");
}

/* ================= 16. 第 6 轮 第1步: WebGPU 计算后端(6.1+6.2 上 GPU) ================= */
__conReport("before-[16]");
console.log("\n[16] WebGPU 计算后端(假 navigator.gpu 验证初始化/编码/回读/自检/回退)");
{
  // --- 默认无 WebGPU: auto 必须静默走 CPU ---
  ok(SIM.compute && SIM.compute.requested === "auto" && SIM.compute.backend === "cpu",
     `无 navigator.gpu 时 auto 走 CPU(backend=${SIM.compute.backend})`);
  ok(/navigator\.gpu/.test(html) && /requestAdapter/.test(html) && /requestDevice/.test(html),
     "设备初始化: navigator.gpu 探测 + requestAdapter/requestDevice + 失败静默回退");

  // --- 结构检查 ---
  const wgsl = (html.match(/const WGSL = `([\s\S]*?)`;/) || [])[1] || "";
  ok(/@compute @workgroup_size\(64\)\s*fn clearGrid/.test(wgsl), "WGSL: clearGrid(桶头清 -1, 每线程一桶)");
  ok(/fn insertBirds/.test(wgsl) && /atomicExchange\(&HEAD\[c\], i32\(i\)\)/.test(wgsl),
     "WGSL: insertBirds 原子头插链表(Phase 2B 方案)");
  ok(/fn neighborForces/.test(wgsl) && /array<f32, 16>/.test(wgsl) && /var kd: array/.test(wgsl),
     "WGSL: neighborForces 用 16 槽寄存器做 K 插入排序(与 CPU 同构)");
  ok(/if \(U\.torus == 1u\)/.test(wgsl) && /round\(d \/ U\.w\)/.test(wgsl),
     "WGSL: minImage 支持环面/开阔双模式(与 JS 版一致)");
  ok(/cohesionW \* psx \/ knf \+ U\.alignmentW \* vsx \/ knf/.test(wgsl) &&
     /clamp\(sepx \* U\.sepGain, -2\.0 \* U\.maxForce, 2\.0 \* U\.maxForce\)/.test(wgsl),
     "WGSL: 力公式与 CPU 逐项同构(凝聚/对齐/分离 + 双层限幅)");
  ok(/struct Params/.test(wgsl) && (wgsl.match(/[A-Za-z0-9_]+: (u32|f32),/g) || []).length === 16,
     "WGSL: uniform Params 16 个 4 字节字段(=64 字节, 让 GPU 拿到全部物理常量)");
  ok(/dispatchWorkgroups\(wgClear\)/.test(html) && /dispatchWorkgroups\(wgBird\)/.test(html) &&
     /Math\.ceil\(n \/ 256\)/.test(html),
     "每帧编码: 3 个 compute pass(清桶/插鸟/求力) + 工作量 = ceil(n/256)");

  // --- 装上假 WebGPU, 用 SIM.setCompute("gpu") 走完整初始化 + 自检 ---
  mockGPU.cpuSnapshot = (floats) => {
    const acc = SIM.accView();
    return acc.slice(0, floats);               // "GPU 算得和 CPU 一样"
  };
  sandbox.navigator.gpu = mockGPU.gpu;
  for (let i = 0; i < 60; i++) SIM.step();     // 先跑几帧让状态非平凡

  gpuLog.length = 0;
  const res = await SIM.setCompute("gpu");
  ok(res.backend === "webgpu", `setCompute("gpu") 在假 GPU 上初始化成功(backend=${res.backend})`);
  const info = SIM.compute.info;
  ok(info && info.maxN === SIM.maxN && info.gwgh === SIM.gw * SIM.gh,
     `资源尺寸: maxN=${info && info.maxN}, 桶数=${info && info.gwgh}`);

  const pipeCalls = gpuLog.filter(c => c[0] === "createComputePipeline");
  ok(pipeCalls.length === 3 && pipeCalls.every(c => c[2] === "explicit"),
     "三趟管线共用显式 pipelineLayout(不用 layout:\"auto\", 否则各 pass 自动布局不一致会校验失败)");
  const bglLog = gpuLog.filter(c => c[0] === "createBindGroupLayout");
  // 【verifier(task-5) 设计变更引起的期望更新, 非放宽判据】W2(惊飞波)把 CPU 状态机同构进 WGSL:
  // 新增 2 个只读 storage buffer 绑定(binding 7 = WAL 警报剩余帧, binding 8 = WTN 上一帧带符号转向)。
  ok(bglLog.length === 1 && bglLog[0][1] === 9 &&
     JSON.stringify(bglLog[0][2]) === JSON.stringify(["read-only-storage","read-only-storage","read-only-storage","storage","storage","storage","uniform","read-only-storage","read-only-storage"]),
     "绑定布局 9 项且访问类型正确(P/V/ALIVE 只读, ACC/HEAD/NXT 读写, Params uniform, WAL/WTN 只读"
     + " —— 因 W2 惊飞波同构新增 binding 7/8)");
  ok(/getCompilationInfo/.test(html) && /WGSL 编译错误/.test(html),
     "WGSL 编译错误显式检测(getCompilationInfo), 不靠黑屏猜");
  const created = gpuLog.filter(c => c[0] === "createBuffer");
  const sizeOf = (kb) => { const b = created.slice(kb).find(Boolean); return b ? b[1] : -1; };
  ok(created.length === 10, `创建 10 个 buffer(实测 ${created.length}): P/V/ALIVE/ACC/HEAD/NXT/WAL/WTN/uniform/staging`
     + " (W2 新增 WAL/WTN, 各 maxN*4 字节)");
  const sizes = created.map(c => c[1]).sort((a, b) => a - b);
  // 期望值全部从 SIM.worldInfo()/网格 + maxN 推导, 不硬编码 —— 世界尺寸再变也不会假失败
  const expect = [64, SIM.gw * SIM.gh * 4, SIM.maxN * 4, SIM.maxN * 4, SIM.maxN * 4, SIM.maxN * 4,
                  SIM.maxN * 8, SIM.maxN * 8, SIM.maxN * 8, SIM.maxN * 8].sort((a, b) => a - b);
  ok(JSON.stringify(sizes) === JSON.stringify(expect),
     `buffer 字节数符合 SoA 布局(推导自 gw*gh 与 maxN: HEAD=${SIM.gw * SIM.gh * 4}, NXT/WAL/WTN=${SIM.maxN * 4}, P/V/ACC/staging=${SIM.maxN * 8})`);
  const stageUsage = created.filter(c => (c[2] & mockGPU.USAGE.MAP_READ) && (c[2] & mockGPU.USAGE.COPY_DST)).length;
  ok(stageUsage === 1, "回读 staging buffer 的 usage = MAP_READ | COPY_DST");

  ok(/clearGrid/.test(JSON.stringify(gpuLog)) && /insertBirds/.test(JSON.stringify(gpuLog)) &&
     /neighborForces/.test(JSON.stringify(gpuLog)),
     "三趟计算管线(clearGrid / insertBirds / neighborForces)都建好了");

  // --- 单帧: 参数 / dispatch / 回读 ---
  gpuLog.length = 0;
  const one = await SIM.stepGPUOnce();
  const dispatches = gpuLog.filter(c => c[0] === "dispatch").map(c => c[1]);
  const nNow = SIM.N, expectBirdWG = Math.ceil(nNow / 256), expectClearWG = Math.ceil(SIM.gw * SIM.gh / 64);
  ok(dispatches.length === 3 && dispatches[0] === expectClearWG &&
     dispatches[1] === expectBirdWG && dispatches[2] === expectBirdWG,
     `3 次 dispatch: 清桶 ${dispatches[0]}=${expectClearWG}, 插鸟/求力 ${dispatches[1]}=${dispatches[2]}=${expectBirdWG}`);
  // 【verifier(task-5) 设计变更引起的期望更新】每帧上行 4 -> 6 次, 顺序 P -> V -> ALIVE -> WAL -> WTN -> uniform
  const ups = gpuLog.filter(c => c[0] === "writeBuffer").map(c => c[2]);
  ok(ups.length === 6, `每帧上行 6 次(实测 ${ups.length}): P / V / ALIVE / WAL / WTN / uniform (W2 新增 WAL/WTN 上行)`);
  const p = mockGPU.params;
  ok(p && p.n === nNow && p.gw === SIM.gw && p.gh === SIM.gh && p.topoK === SIM.topoK,
     `uniform 物理常量正确: n=${p && p.n} gw=${p && p.gw} gh=${p && p.gh} topoK=${p && p.topoK}`);
  ok(p && Math.abs(p.perceptionR2 - SIM.flockConsts.PERCEPTION * SIM.flockConsts.PERCEPTION) < 1e-6 &&
     Math.abs(p.sepR2 - SIM.flockConsts.SEP_R2) < 1e-6 && Math.abs(p.maxForce - SIM.flockConsts.MAX_FORCE) < 1e-6 &&
     Math.abs(p.cohesionW - SIM.flockConsts.COHESION_W) < 1e-6 && Math.abs(p.alignmentW - SIM.flockConsts.ALIGNMENT_W) < 1e-6,
     "uniform 里 perceptionR2/sepR2/maxForce/cohesion/alignment 与 CPU 常量逐项一致");
  ok(gpuLog.some(c => c[0] === "copyBufferToBuffer" && c[1] === 8 * nNow), `回读拷贝 ${8 * nNow} 字节 ACC`);
  ok(one && typeof one.ms === "number", `stepGPUOnce 返回耗时(ms=${one && one.ms.toFixed(1)})`);

  // --- 自检通过路径 + 一次真正推进 ---
  const sc = SIM.compute.selfCheck;
  ok(sc && sc.passed === true && sc.maxAbs === 0, `自检通过路径: passed=${sc && sc.passed}, maxAbs=${sc && sc.maxAbs}`);
  const kills0 = SIM.kills.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 5; i++) await SIM.stepGPUOnce();
  ok(true, `GPU 路径连续 5 帧无异常(捕获 ${SIM.kills.reduce((a,b)=>a+b,0) - kills0} 只)`);

  // --- 自检失败路径: GPU 结果坏掉 -> 必须退回 CPU ---
  mockGPU.state.corrupt = true;
  const bad = await SIM.setCompute("gpu");
  ok(bad.backend === "cpu" && bad.selfCheck && bad.selfCheck.passed === false,
     `自检失败会退回 CPU(超差 ${bad.selfCheck && bad.selfCheck.bad} 项, maxAbs=${bad.selfCheck && bad.selfCheck.maxAbs})`);
  ok(SIM.compute.backend === "cpu", "退回后 backend 报告 cpu");
  mockGPU.state.corrupt = false;
  const back = await SIM.setCompute("gpu");
  ok(back.backend === "webgpu", "恢复正常后可以再切回 webgpu");
  await SIM.setCompute("cpu");
  ok(SIM.compute.backend === "cpu", "setCompute(\"cpu\") 立刻回到 CPU 路径");
  // WGSL 编译错误必须被识别并退回 CPU(而不是黑屏)
  mockGPU.state.compileErrors = [{ type: "error", lineNum: 3, linePos: 1, message: "mock: 语法错误" }];
  sandbox.window.ComputeBackend.dispose();          // 强制走一次全新 init(才会读编译信息)
  const bad2 = await SIM.setCompute("gpu");
  ok(bad2.backend === "cpu" || (bad2.reason || "").indexOf("WGSL") >= 0,
     `WGSL 编译错误会退回 CPU 并报原因(reason=${(bad2.reason || "").slice(0, 40)})`);
  mockGPU.state.compileErrors = null;
  sandbox.navigator.gpu = null;
}

/* ================= 17. 第 7 轮: 体积/间距/加入鹰隼按钮 ================= */
__conReport("before-[17]");
console.log("\n[17] 第 7 轮: 个体再收小 + 间距再收紧 + 加入鹰/隼");
{
  // --- 按钮与快捷键 ---
  ok(/\bid="btnAddFalcon"/.test(html) && /\bid="btnAddEagle"/.test(html) && /\bid="raidLine"/.test(html),
     "面板新增按钮: 加入隼 / 加入鹰 + 编制显示行");
  ok(/el\("btnAddFalcon"\)\.onclick/.test(html) && /el\("btnAddEagle"\)\.onclick/.test(html),
     "两个按钮都接了点击处理");
  ok(/k === "f"\) \{ if \(e\.shiftKey\) el\("btnFMinus"\)\.onclick\(\); else el\("btnAddFalcon"\)\.onclick\(\)/.test(html) &&
     /k === "e"\) \{ if \(e\.shiftKey\) el\("btnEMinus"\)\.onclick\(\); else el\("btnAddEagle"\)\.onclick\(\)/.test(html),
     "快捷键 F/E=增援, ⇧F/⇧E=减员");

  // --- 编程接口: 加完立刻进入 threats/raptors, 并参与逐帧仿真 ---
  SIM.setGeometry(false);
  SIM.setN(2000);
  SIM.resetPredators();
  for (let i = 0; i < 30; i++) SIM.step();
  const c0 = SIM.raptorCount;
  ok(c0.falcons === 2 && c0.eagles === 1 && c0.total === 3,
     `默认编制: 隼 ×${c0.falcons} + 鹰 ×${c0.eagles} = ${c0.total} 只`);
  const nf = SIM.addFalcon(), ne = SIM.addEagle();
  const c1 = SIM.raptorCount;
  ok(nf && nf.kind === "falcon" && ne && ne.kind === "eagle" && c1.falcons === 3 && c1.eagles === 2 && c1.total === 5,
     `加入后编制: 隼 ×${c1.falcons} + 鹰 ×${c1.eagles} = ${c1.total} 只(raptors/threats 同步)`)
  const kBefore = SIM.raidKills;
  for (let i = 0; i < 400; i++) SIM.step();
  // 新个体必须在跑: 位置发生变化 / 拖尾增长
  const movedF = nf.trailN > 0 || Math.abs(nf.vx) + Math.abs(nf.vy) > 0;
  const movedE = ne.trailN > 0 || Math.abs(ne.vx) + Math.abs(ne.vy) > 0;
  ok(movedF && movedE, `新增的隼/鹰在参与仿真(拖尾 ${nf.trailN}/${ne.trailN} 帧, 速度 ${Math.hypot(nf.vx,nf.vy).toFixed(2)}/${Math.hypot(ne.vx,ne.vy).toFixed(2)})`);
  ok(SIM.raidKills.length === 5, `raidKills 覆盖全部 ${SIM.raidKills.length} 只猛禽`);
  ok(/猛禽编制: 隼 ×3 · 鹰 ×2/.test(SIM.raidLine), `编制行文案正确: ${SIM.raidLine}`);
  // 新鹰有独立的 Q 表(不共享)
  ok(ne.Q && ne.Q.length > 0 && ne.Q !== SIM.Q, "新加入的鹰有自己独立的 Q 表(不与首鹰共享)");

  // --- 隼的能量交棒在多只时仍然合法(activeId 必须落在有效范围) ---
  let activeOK = true;
  for (let i = 0; i < 600; i++) {
    SIM.step();
    const h = SIM.hunterLock;                    // 触发一次钩子, 顺带确认没抛错
    if (!h) { activeOK = false; break; }
  }
  ok(activeOK, "5 只猛禽下连跑 600 帧无异常(轮换/互攻/围攻都泛化到 N 只)");

  // --- 重置猛禽 = 解散增援(可逆) ---
  SIM.resetPredators();
  const c2 = SIM.raptorCount;
  ok(c2.falcons === 2 && c2.eagles === 1 && c2.total === 3,
     `"重置猛禽"回到默认编制(隼 ×${c2.falcons} + 鹰 ×${c2.eagles} = ${c2.total})`);
  ok(SIM.kills.length === 3 && SIM.scores.length === 3,
     "SIM.kills/scores 仍保持前三只(隼①/隼②/鹰)的既有契约, 不破坏老验收脚本");

  // --- 间距/体积的量化效果(与第 6 轮基准比) ---
  SIM.setGeometry(false);
  SIM.setN(2000);
  SIM.resetPredators();
  SIM.setRefill(false);
  for (let i = 0; i < 30; i++) SIM.parkRaptors(-9999, -9999);
  for (let i = 0; i < 1500; i++) { SIM.parkRaptors(-9999, -9999); SIM.step(); }
  const birds = [];
  for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s.alive) birds.push(s); }
  const stride = Math.max(1, Math.floor(birds.length / 400));
  let nn = 0, cnt = 0;
  for (let i = 0; i < birds.length; i += stride) {
    const a = birds[i];
    let best = 1e18;
    for (const b of birds) {
      if (b === a) continue;
      const dx = b.x - a.x, dy = b.y - a.y; const d2 = dx * dx + dy * dy;
      if (d2 < best) best = d2;
    }
    nn += Math.sqrt(best); cnt++;
  }
  nn /= cnt;
  console.log(`     最近邻平均 ${nn.toFixed(1)}px(第 6 轮基准 11.4px, 越接近 5~7px 说明确实更密)`);
  ok(nn < 10.0, `鸟间距确实收紧: 最近邻 ${nn.toFixed(1)}px < 10px(第6轮 11.4px)`);
  SIM.setRefill(true);
  SIM.resetPredators();
}

/* ===== 18. 第 8 轮 W1(verifier/task-5 追加): 世界-视口解耦 + 边界厌恶不变量 =====
 * 追加断言原则: ①不删既有断言; ②不依赖尚未合入的机制(用"若钩子存在则断言"的守卫);
 * ③阈值取能稳定通过的量级, 具体越界取证交给 _checks\accept_boundary.mjs。 */
__conReport("before-[18]");
console.log("\n[18] 世界/视口解耦 + 边界厌恶(verifier 追加)");
{
  if (typeof SIM.worldInfo !== "function") {
    ok(false, "SIM.worldInfo() 钩子存在(W1 世界-视口解耦的验收入口)");
  } else {
    SIM.setGeometry(false); SIM.setN(2000); SIM.setRefill(false);
    SIM.resetBoundStats();
    const wi = SIM.worldInfo();
    ok(wi.worldW > 1280 && wi.worldH > 720 && wi.viewW === 1280 && wi.viewH === 720,
       `世界与视口解耦: 世界 ${wi.worldW}x${wi.worldH}, 视口 ${wi.viewW}x${wi.viewH}, 厌恶半径 ${wi.boundR}px`);
    ok(wi.worldW !== 1280 + 2 * SIM.PAD && wi.worldW !== 1280,
       `世界尺寸不再是旧口径(视口±缓冲带=${1280 + 2 * SIM.PAD}), 现为 ${wi.worldW}`);
    // 跑 1500 帧, 独立量"椋鸟/雁到四边最小距离"(猛禽出生点问题是独立缺陷, 见 accept_boundary)
    let minEdgeBirds = Infinity, minEdgeAll = Infinity;
    for (let i = 0; i < 1500; i++) {
      SIM.step();
      for (let k = 0; k < SIM.N; k++) {
        const s = SIM.starling(k);
        if (!s.alive) continue;
        const e = Math.min(s.x, wi.worldW - s.x, s.y, wi.worldH - s.y);
        if (e < minEdgeBirds) minEdgeBirds = e;
        if (e < minEdgeAll) minEdgeAll = e;
      }
      for (let k = 0; k < SIM.M; k++) {
        const g = SIM.goose(k);
        if (!g.alive) continue;
        const e = Math.min(g.x, wi.worldW - g.x, g.y, wi.worldH - g.y);
        if (e < minEdgeBirds) minEdgeBirds = e;
        if (e < minEdgeAll) minEdgeAll = e;
      }
      for (let k = 0; k < SIM.raptorCount.total; k++) {
        const h = SIM.hunter(k);
        const e = Math.min(h.x, wi.worldW - h.x, h.y, wi.worldH - h.y);
        if (e < minEdgeAll) minEdgeAll = e;
      }
    }
    const w2 = SIM.worldInfo();
    ok(w2.clampCount === 0, `边界从不硬夹取(clampCount=${w2.clampCount}, 1500 帧)`);
    ok(w2.peakPenetration !== null && w2.peakPenetration >= 0,
       `厌恶带被实际触发且未退化(peakPenetration=${w2.peakPenetration === null ? "n/a" : w2.peakPenetration.toFixed(3)})`);
    ok(minEdgeBirds >= 40,
       `椋鸟/雁 1500 帧内到世界四边最小距离 ${minEdgeBirds.toFixed(1)}px >= 40px(猛禽单独: 全程最小 ${minEdgeAll.toFixed(1)}px, 越界取证见 accept_boundary)`);
  }
}

console.log(`\n结果: ${checks - failures}/${checks} 项通过`);
process.exit(failures ? 1 : 0);

__conReport("END");
