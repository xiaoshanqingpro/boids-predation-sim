/* 直接验证: 新链表遍历顺序 == 旧 Map+数组 遍历顺序(逐位比较质心求和) */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "..", "掠食竞赛.html"), "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = () => {};
const gctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => ({ addColorStop: noop }) : noop), set: (t, p, v) => (t[p] = v, true) });
const documentStub = {
  getElementById: () => ({ textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, classList: { toggle: noop }, getContext: () => gctx, width: 1280, height: 720, addEventListener: noop, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) }),
  addEventListener: noop, createElement: () => ({ width: 0, height: 0, getContext: () => gctx, style: {} }),
};
function seededMath(seed) { let s = seed >>> 0; const M = Object.create(Math); M.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; return M; }
const sandbox = { document: documentStub, window: {}, Math: seededMath(20261015), performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "sim.js" });
const SIM = sandbox.window.SIM;
SIM.setGeometry(false); SIM.setN(2000);

// 从源码里取常量(不打洞进闭包, 直接解析)
const W = 1280, H = 720, PAD = 170;
const PERCEPTION = Number(html.match(/const PERCEPTION = ([\d.]+);/)[1]);
const CELL = PERCEPTION;
const GW = Math.ceil((W + 2 * PAD) / CELL), GH = Math.ceil((H + 2 * PAD) / CELL);
const clamp = (x, lo, hi) => x < lo ? lo : (x > hi ? hi : x);

function refCentroid(px, py, viewR2, birds) {
  // 旧实现: Map<key, index[]> (插入顺序), 桶内 push 升序
  const map = new Map();
  for (let bi = 0; bi < birds.length; bi++) {
    const b = birds[bi];
    const cx = clamp(Math.floor((b.x + PAD) / CELL), 0, GW - 1);
    const cy = clamp(Math.floor((b.y + PAD) / CELL), 0, GH - 1);
    const key = cx * 4096 + cy;
    let a = map.get(key);
    if (!a) { a = []; map.set(key, a); }
    a.push(bi);
  }
  const cellR = Math.sqrt(viewR2) + CELL * 0.75, cellR2 = cellR * cellR;
  let cnt = 0, sumX = 0, sumY = 0;
  map.forEach((arr, key) => {
    const cx = (key / 4096) | 0, cy = key % 4096;
    const bx = -PAD + (cx + 0.5) * CELL, by = -PAD + (cy + 0.5) * CELL;
    const dx = bx - px, dy = by - py;
    if (dx * dx + dy * dy > cellR2) return;
    for (let n = 0; n < arr.length; n++) {
      const j = arr[n];
      const ex = birds[j].x - px, ey = birds[j].y - py;
      if (ex * ex + ey * ey > viewR2) continue;
      cnt++; sumX += birds[j].x; sumY += birds[j].y;
    }
  });
  return { n: cnt, x: cnt ? sumX / cnt : 0, y: cnt ? sumY / cnt : 0, sumX, sumY };
}

let mismatch = 0, checked = 0, firstBad = -1;
for (let frame = 0; frame < 400; frame++) {
  SIM.step();
  if (frame % 20 !== 0) continue;
  const birds = [];
  for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s.alive) birds.push({ i, x: s.x, y: s.y }); }
  // 鸟索引 -> 在 birds 中的位置
  const pos = new Int32Array(SIM.N).fill(-1);
  for (let k = 0; k < birds.length; k++) pos[birds[k].i] = k;
  // 任取一个猛禽位置当观察点, 视图半径用鹰的 520
  const h = SIM.hunter(2);
  const viewR2 = 520 * 520;
  const ref = refCentroid(h.x, h.y, viewR2, birds);
  const got = SIM.probe(h.x, h.y, h.vx, h.vy, 520);
  checked++;
  const same = got && got.n === ref.n && got.x === ref.x && got.y === ref.y;
  if (!same) { mismatch++; if (firstBad < 0) firstBad = frame; }
}
console.log(`比较 ${checked} 次: 不一致 ${mismatch} 次` + (firstBad >= 0 ? ` (首次 frame ${firstBad})` : ""));
