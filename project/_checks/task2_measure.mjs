/* ============================================================================
 * 任务2 验收测量: ①各 N 档的 step / render(CPU 侧) 耗时 ②topoK 与密度的交互
 * (浏览器里 GPU 时间无法在 headless 里测; 这里测的是 GL 路径的 CPU 组装 +
 *  2D 叠加层, 真正的 GL 绘制只是 2 次 drawArraysInstanced)
 * 用法: node _checks/task2_measure.mjs
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "..", "掠食竞赛.html"), "utf8");
const allCode = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");

let glLog = [];
function makeMockGL() {
  const C = {}; ["VERTEX_SHADER","FRAGMENT_SHADER","COMPILE_STATUS","LINK_STATUS","ARRAY_BUFFER","STATIC_DRAW",
   "DYNAMIC_DRAW","FLOAT","TRIANGLES","TEXTURE_2D","RGBA","UNSIGNED_BYTE","TEXTURE_MIN_FILTER","LINEAR",
   "TEXTURE_MAG_FILTER","TEXTURE_WRAP_S","CLAMP_TO_EDGE","TEXTURE_WRAP_T","FRAMEBUFFER","COLOR_ATTACHMENT0",
   "FRAMEBUFFER_COMPLETE","DEPTH_TEST","BLEND","COLOR_BUFFER_BIT","TEXTURE0","VENDOR","RENDERER"].forEach((k, i) => { C[k] = 0x1000 + i; });
  const gl = Object.assign({}, C, {
    createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}), createTexture: () => ({}), createFramebuffer: () => ({}),
    shaderSource() {}, compileShader() {}, attachShader() {}, linkProgram() {}, deleteShader() {},
    getShaderParameter: () => true, getProgramParameter: () => true, getShaderInfoLog: () => "", getProgramInfoLog: () => "",
    getUniformLocation: () => ({}), getAttribLocation: (p, n) => (n === "aUnit" ? 0 : n === "aInst" ? 1 : 2),
    bindBuffer() {}, bufferData() {}, bufferSubData() {}, bindTexture() {}, texImage2D() {}, texParameteri() {},
    bindFramebuffer() {}, framebufferTexture2D() {}, checkFramebufferStatus: () => C.FRAMEBUFFER_COMPLETE,
    viewport() {}, clearColor() {}, clear() {}, disable() {}, enable() {}, useProgram() {}, activeTexture() {},
    uniform1i() {}, uniform1f() {}, uniform2f() {}, uniform3f() {}, enableVertexAttribArray() {}, vertexAttribPointer() {},
    vertexAttribDivisor() {}, drawArrays() {}, drawArraysInstanced() {}, getParameter: () => "mock",
    getExtension: () => ({ vertexAttribDivisorANGLE() {}, drawArraysInstancedANGLE() {} }),
  });
  return gl;
}
const grad = { addColorStop() {} };
const ctx2d = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : () => {})), set: (t, p, v) => (t[p] = v, true) });
const els = new Map();
const mockGL = makeMockGL();
const el = (id) => {
  if (!els.has(id)) els.set(id, { id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, classList: { toggle() {} },
    getContext: (n) => (id === "glcv" && n === "webgl2" ? mockGL : ctx2d), width: 1280, height: 720, addEventListener() {},
    getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
  return els.get(id);
};
const sandbox = { document: { getElementById: el, addEventListener() {}, createElement: () => el("created") },
                  window: {}, performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
                  requestAnimationFrame: () => 0, console };
vm.createContext(sandbox);
vm.runInContext(allCode, sandbox, { filename: "sim.js" });
const SIM = sandbox.window.SIM;
SIM.setGeometry(false);
SIM.initRenderBackend();
console.log(`渲染后端 = ${SIM.renderBackend}  ${JSON.stringify(SIM.glInfo)}\n`);

console.log("== 各 N 档: 单步 / 单帧渲染(CPU 侧) ==");
console.log("     N    step中位  stepP99   render中位  FPS上限(取大者)");
function median(a) { a = Array.from(a).sort((x, y) => x - y); return a[a.length >> 1]; }
for (const n of [2000, 5000, 10000, 20000]) {
  SIM.setN(n);
  for (let i = 0; i < 20; i++) { SIM.step(); SIM.render(); }
  const st = [], rd = [];
  for (let i = 0; i < 60; i++) {
    let t0 = performance.now(); SIM.step(); st.push(performance.now() - t0);
    t0 = performance.now(); SIM.render(); rd.push(performance.now() - t0);
  }
  const s = median(st), r = median(rd);
  const stSorted = Array.from(st).sort((x, y) => x - y);
  const frame = Math.max(s, r) + Math.min(s, r);     // 一步 + 一帧
  console.log(`${String(n).padStart(6)}  ${s.toFixed(2).padStart(8)} ${stSorted[Math.floor(st.length * 0.99)].toFixed(2).padStart(7)}  ${r.toFixed(2).padStart(9)}  ${(1000 / frame).toFixed(1).padStart(6)} FPS`);
}

console.log("\n== topoK 与密度的交互(理论预言: 邻居数恒定 -> 归一化形态与 N 无关) ==");
function flockStats(n) {
  SIM.setN(n);
  for (let i = 0; i < 1800; i++) { SIM.parkRaptors(); SIM.step(); }   // 无猛禽干扰 30 秒
  const birds = [];
  for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s.alive) birds.push(s); }
  // 抽样统计最近邻与第 7 近邻距离
  let nn = 0, k7 = 0, cnt = 0, vx = 0, vy = 0;
  const stride = Math.max(1, Math.floor(birds.length / 400));
  for (let i = 0; i < birds.length; i += stride) {
    const a = birds[i];
    const d = [];
    for (const b of birds) {
      if (b === a) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      d.push(dx * dx + dy * dy);
    }
    d.sort((x, y) => x - y);
    nn += Math.sqrt(d[0]); k7 += Math.sqrt(d[6]);
    cnt++;
  }
  nn /= cnt; k7 /= cnt;
  for (const b of birds) { vx += b.vx; vy += b.vy; }
  const pol = Math.hypot(vx, vy) / (birds.length * 3.6);      // 极化度 |Σv| / (N·v_max)
  let cx = 0, cy = 0;
  for (const b of birds) { cx += b.x; cy += b.y; }
  cx /= birds.length; cy /= birds.length;
  let sp = 0;
  for (const b of birds) sp += Math.hypot(b.x - cx, b.y - cy);
  sp /= birds.length;                                          // 群体展布(px)
  return { n, alive: birds.length, nn, k7, pol, spread: sp, spreadPerK7: sp / k7 };
}
for (const n of [2000, 20000]) {
  const r = flockStats(n);
  console.log(`N=${String(n).padStart(5)}: 最近邻 ${r.nn.toFixed(1)}px · 第7近邻 ${r.k7.toFixed(1)}px · 极化度 ${r.pol.toFixed(3)} · 展布 ${r.spread.toFixed(0)}px · **展布/第7近邻 = ${r.spreadPerK7.toFixed(2)}**`);
}
