/* ============================================================================
 * verifier(task-5) 验收公共库 —— 只被 _checks/accept_*.mjs 使用, 不碰主文件。
 * 提供: 沙箱加载(与 diag_*.mjs 同款打桩) / 世界边界口径 / 统计工具 / 判定输出
 * 约定: 每个 accept 脚本都支持 `node _checks\accept_x.mjs [html] [frames]`,
 *       也支持环境变量 SIM_HTML / SIM_FRAMES; 默认 掠食竞赛.html / 5000 帧。
 * ==========================================================================*/
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import crypto from "node:crypto";

/* ---------------- 被测文件版本钉扎 ----------------
 * 多轮测量期间主文件可能被其他智能体写入(实测发生过)。这里一次性读入内容并算短哈希,
 * 所有轮次都用同一份内容 -> 报告里能证明"这一轮的所有子测量是同一次修订"。 */
export function readHtml(p) {
  const html = fs.readFileSync(p, "utf8");
  const hash = crypto.createHash("sha256").update(html, "utf8").digest("hex").slice(0, 16);
  return { html, hash, bytes: Buffer.byteLength(html, "utf8") };
}

/* ---------------- 命令行 / 环境变量 ---------------- */
export function cliHtml(def = "掠食竞赛.html") {
  return process.argv[2] || process.env.SIM_HTML || def;
}
export function cliFrames(def = 5000) {
  const v = process.argv[3] || process.env.SIM_FRAMES;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}
export function cliFloat(idx, def) {
  const v = process.argv[idx] || process.env.SIM_TRIALS;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

/* ---------------- 沙箱加载 ---------------- */
export function loadSim(htmlPath, contentOverride) {
  const html = contentOverride !== undefined ? contentOverride : fs.readFileSync(htmlPath, "utf8");
  // 先按说明容器切开: 容器正文里的 `<script` 已转义成 `&lt;script`, 但保险起见仍只取前面
  const cut = html.indexOf('<script type="text/plain"');
  const code = [...(cut > 0 ? html.slice(0, cut) : html).matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).join("\n;\n");
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (t, p) => (p in t ? t[p]
      : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad
      : (p === "measureText" ? () => ({ width: 10 }) : () => {})),
    set: (t, p, v) => (t[p] = v, true),
  });
  const els = new Map();
  const mk = id => ({
    id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "",
    children: [], addEventListener() {}, removeEventListener() {},
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    getContext: () => ctx,
    appendChild(c) { if (c && c.id) els.set(c.id, c); return c; },
    removeChild(c) { return c; },
    getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }),
  });
  const doc = {
    getElementById: id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); },
    addEventListener() {}, removeEventListener() {},
    createElement: () => mk("c" + Math.random()),
  };
  // window 也要能当 globalThis 用: window.X = ... 后裸写 X 必须能解析
  const sb = {
    document: doc,
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    console,
    navigator: { gpu: null },
    location: { search: "" },
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener() {}, removeEventListener() {},
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(code, sb, { filename: path.basename(htmlPath) + ".js" });
  const SIM = sb.window.SIM;
  if (!SIM) throw new Error("window.SIM 钩子缺失: 主文件结构变了或第一个 <script> 求值失败");
  return { SIM, sb, html, code };
}

/* ---------------- 世界口径 ---------------- */
export function worldOf(SIM) {
  if (typeof SIM.worldInfo === "function") {
    const w = SIM.worldInfo();
    return { worldW: w.worldW, worldH: w.worldH, viewW: w.viewW, viewH: w.viewH,
             boundR: w.boundR, torus: w.torus, clampCount: w.clampCount,
             peakPenetration: w.peakPenetration, minEdgeDist: w.minEdgeDist, hasHook: true };
  }
  // 回退: 只能拿到网格桶数(V1 口径), 报告里要说明缺 worldInfo 钩子
  return { worldW: SIM.gw * 36, worldH: SIM.gh * 36, viewW: 1280, viewH: 720,
           boundR: 60 + SIM.PAD, torus: SIM.TORUS, clampCount: null,
           peakPenetration: null, minEdgeDist: null, hasHook: false };
}

// 到四边的最小距离(px)。世界外为负值 —— 正是"越界"的直接度量。
export function edgeDist(x, y, ww, wh) {
  return Math.min(x, ww - x, y, wh - y);
}

/* ---------------- 确定性随机种子 ---------------- */
// 仿真内部用 Math.random(); 在沙箱里把它换成 mulberry32(seed), 就能得到可复现的"固定种子"轮次。
export function setSeed(sb, seed) {
  const s = (seed | 0) || 1;
  vm.runInContext(`(function(){ let a = ${s} >>> 0; Math.random = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }; })();`, sb);
  return s;
}

/* ---------------- 统计 ---------------- */
export const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
export function variance(a) {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length;
}
export const stdev = a => Math.sqrt(variance(a));
export function quantile(a, q) {
  if (!a.length) return NaN;
  const s = Array.from(a).sort((x, y) => x - y);
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export const cv = a => { const m = mean(a); return m ? stdev(a) / m : NaN; };
export const f1 = v => (Number.isFinite(v) ? v.toFixed(1) : "n/a");
export const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : "n/a");
export const f3 = v => (Number.isFinite(v) ? v.toFixed(3) : "n/a");
export const pct = v => (Number.isFinite(v) ? (100 * v).toFixed(1) + "%" : "n/a");

/* ---------------- 判定输出 ---------------- */
export function makeReporter(title) {
  const rows = [];
  let fails = 0, skips = 0;
  const out = [];
  const say = s => { out.push(s); console.log(s); };
  say(`================ ${title} ================`);
  function check(name, value, op, thr, note = "") {
    let pass;
    if (value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))) pass = null;
    else if (op === ">=") pass = value >= thr;
    else if (op === "<=") pass = value <= thr;
    else if (op === ">") pass = value > thr;
    else if (op === "<") pass = value < thr;
    else if (op === "==") pass = value === thr;
    else pass = null;
    const tag = pass === null ? "N/A " : pass ? "PASS" : "FAIL";
    rows.push({ name, value, op, thr, pass, note });
    if (pass === false) fails++;
    if (pass === null) skips++;
    const shown = typeof value === "number" ? (Math.abs(value) >= 100 ? f1(value) : f3(value)) : String(value);
    say(`  [${tag}] ${name} = ${shown} (阈值 ${op} ${thr})${note ? "  · " + note : ""}`);
    return pass;
  }
  function info(name, value, note = "") {
    rows.push({ name, value, op: "info", thr: null, pass: null, note });
    const shown = typeof value === "number" ? (Math.abs(value) >= 100 ? f1(value) : f3(value)) : String(value);
    say(`  [INFO] ${name} = ${shown}${note ? "  · " + note : ""}`);
  }
  function skip(name, why) {
    rows.push({ name, value: null, op: "skip", thr: null, pass: null, note: why });
    skips++;
    say(`  [NOT IMPLEMENTED] ${name} —— ${why}`);
  }
  function finish() {
    say(`  小结: ${rows.length - skips} 项判定, ${fails} 项 FAIL${skips ? `, ${skips} 项 N/A/NOT IMPLEMENTED` : ""}`);
    say(`  总判决: ${fails === 0 ? (skips ? "PASS(有缺口)" : "PASS") : "FAIL"}`);
    return { fails, skips, rows, text: out.join("\n") };
  }
  return { check, info, skip, finish, say, rows };
}

/* ---------------- 场景初始化 ---------------- */
// 所有 probe 的统一初态: 开阔世界 + N 只椋鸟 + 重力 + 可关自动补充
export function setup(SIM, opt = {}) {
  const { n = 2000, gravity = true, refill = false, torus = false } = opt;
  SIM.setGeometry(torus);
  SIM.setN(n);
  if (typeof SIM.setGravity === "function") SIM.setGravity(gravity);
  SIM.setRefill(refill);
  if (typeof SIM.resetBoundStats === "function") SIM.resetBoundStats();
  return SIM;
}
