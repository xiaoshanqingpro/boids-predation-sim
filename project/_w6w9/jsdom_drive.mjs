/* ============================================================================
 * W6–W9 共享无头驱动(施工文档 §2 协议): node + jsdom
 *   runScripts:"dangerously", pretendToBeVisual:true, VirtualConsole 吞 canvas 报错,
 *   直接驱动 window.SIM.step(), 不依赖 rAF(render 层在无头环境会抛异常, 属预期)。
 *
 * 用法:  import { loadSim } from "./jsdom_drive.mjs";
 *        const { SIM, win, dom } = await loadSim("掠食竞赛(4).html", "?grav=0");
 *        for (let i=0;i<1000;i++) SIM.step();
 *        console.log(SIM.stats.dashMaxEats, SIM.kills);
 *
 * 说明:
 *  - 每个进程独立加载一次 HTML; 需要"同一份内容跑多轮"时用 readHtmlCached() 的返回值
 *    自己 new JSDOM(内容), 保证多轮测的是同一修订(内容哈希钉扎)。
 *  - 输出哈希: fnv1a(位置/速度数组) 可用于"物理哈希如可复现(固定种子)一并报告"(§5)。
 *  - 固定种子: 若页面暴露 SIM.setSeed 就用; 否则用 setRandomSeedOverride()。
 * ========================================================================== */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { JSDOM, VirtualConsole } from "jsdom";

const cache = new Map();
/* 【坑·已修】按**路径**缓存内容。做 A/B 参数扫描时若把不同参数写进**同一个文件名**反复跑,
 * 会命中旧缓存 → "多组参数结果完全相同"的假结论(已发生一次)。
 * 因此: ① 参数扫描请给每组参数用**独立文件名**; ② 或显式 loadSim(path, q, { fresh: true }) 跳过缓存。 */
export function readHtmlCached(path, fresh = false) {
  if (fresh) cache.delete(path);
  if (!cache.has(path)) {
    const raw = fs.readFileSync(path, "utf8");
    cache.set(path, { raw, sha256: createHash("sha256").update(raw).digest("hex") });
  }
  return cache.get(path);
}

export async function loadSim(path, query = "", opts = {}) {
  const { raw, sha256 } = readHtmlCached(path, !!opts.fresh);
  const vc = new VirtualConsole();
  const errors = [];
  vc.on("jsdomError", e => errors.push(String(e && e.message)));
  vc.on("error", e => errors.push(String(e)));
  const dom = new JSDOM(raw, {
    runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    url: "https://local.test/" + (query || ""), resources: undefined,
  });
  const win = dom.window;
  const SIM = win.SIM;
  if (!SIM) throw new Error("页面未暴露 window.SIM");
  // canvas: jsdom 无 WebGL/2D 实现, 这里给 getContext 打桩, 避免渲染层把 init 打断
  try {
    win.HTMLCanvasElement.prototype.getContext = function () { return null; };
  } catch (e) { /* 忽略 */ }
  if (opts.seed !== undefined && typeof SIM.setSeed === "function") SIM.setSeed(opts.seed);
  return { SIM, win, dom, sha256, errors, htmlPath: path, query };
}

/* 固定随机数(若页面未提供 setSeed): 用线性同余替换 Math.random, 保证多轮可复现 */
export function setRandomSeedOverride(win, seed = 12345) {
  let s = seed >>> 0;
  win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* 物理哈希: 位置/速度(与主验收脚本同风格, 便于跨修订比对) */
export function physicsHash(SIM) {
  let h = 0x811c9dc5;
  const mix = v => { const x = Math.round(v * 1000) | 0; h ^= x; h = Math.imul(h, 0x01000193) >>> 0; };
  for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s && s.alive) { mix(s.x); mix(s.y); mix(s.vx); mix(s.vy); } }
  for (let i = 0; i < SIM.M; i++) { const g = SIM.goose(i); if (g && g.alive) { mix(g.x); mix(g.y); } }
  return ("00000000" + h.toString(16)).slice(-8);
}

/* 常用验收小工具 */
export async function runFrames(SIM, n, every) {
  for (let i = 0; i < n; i++) { SIM.step(); if (every && i % every === 0) every(i, SIM); }
}
export function median(a) { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; }
export function mean(a) { return a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); }
