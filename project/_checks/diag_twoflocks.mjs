/* 量化椋鸟群与雁群的空间关系: 质心距离 / 高度差 / 借网预警是否还有效 */
import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[3] || "掠食竞赛.html", "utf8");
const cut = html.indexOf('<script type="text/plain"');
const code = [...(cut > 0 ? html.slice(0, cut) : html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");
const grad = { addColorStop() {} };
const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : () => {})), set: (t, p, v) => (t[p] = v, true) });
const els = new Map();
const mk = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "", children: [], addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} }, getContext: () => ctx, appendChild(c) { if (c && c.id) els.set(c.id, c); return c; }, removeChild(c) { return c; }, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
const d = { getElementById: id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); }, addEventListener() {}, createElement: () => mk("c" + Math.random()) };
const sb = { document: d, window: { addEventListener() {}, removeEventListener() {}, location: { search: "" } }, location: { search: "" }, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
vm.createContext(sb); vm.runInContext(code, sb, { filename: "sim.js" });
const SIM = sb.window.SIM;
SIM.setGeometry(false); SIM.setN(2000); SIM.setGravity(true); SIM.setRefill(false);
const FRAMES = Number(process.argv[2] || 5000);
let sumD = 0, minD = 1e9, maxD = 0, n = 0, sumZ = 0, closeFrames = 0, nearAlert = 0;
const trace = [];
for (let f = 0; f < FRAMES; f++) {
  SIM.step();
  // 椋鸟质心
  let sx = 0, sy = 0, sz = 0, c = 0;
  for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s.alive) { sx += s.x; sy += s.y; sz += s.z; c++; } }
  sx /= c; sy /= c; sz /= c;
  const L = SIM.leader;
  let gx = 0, gy = 0, gz = 0, gc = 0;
  for (let i = 0; i < SIM.M; i++) { const g = SIM.goose(i); if (g.alive) { gx += g.x; gy += g.y; gz += g.z; gc++; } }
  gx /= gc; gy /= gc; gz /= gc;
  const dx = gx - sx, dy = gy - sy;
  const dist = Math.hypot(dx, dy);
  sumD += dist; if (dist < minD) minD = dist; if (dist > maxD) maxD = dist; n++;
  sumZ += (gz - sz);
  if (dist < 300) closeFrames++;
  // 借网预警条件: 雁周围 140px 内有 >=3 只惊飞椋鸟
  let alerted = 0;
  for (let i = 0; i < SIM.M; i++) {
    if (!SIM.goose(i).alive) continue;
    let cnt = 0;
    for (let j = 0; j < SIM.N; j++) {
      const s = SIM.starling(j);
      if (!s.alive || !s.startled) continue;
      if (Math.hypot(s.x - SIM.goose(i).x, s.y - SIM.goose(i).y) < 140) cnt++;
    }
    if (cnt >= 3) alerted++;
  }
  if (alerted > 0) nearAlert++;
  if (f % 1000 === 0) trace.push("f" + f + ": 距离" + dist.toFixed(0) + " z差" + (gz - sz).toFixed(0));
}
console.log(`5000 帧(实际 ${n}): 两群水平距离 平均 ${(sumD / n).toFixed(0)}px, 最近 ${minD.toFixed(0)}, 最远 ${maxD.toFixed(0)}`);
console.log(`  距离 <300px 的帧占比 ${(100 * closeFrames / n).toFixed(0)}%;  雁群处于"借网预警"状态的帧占比 ${(100 * nearAlert / n).toFixed(0)}%`);
console.log(`  高度差 平均 ${(sumZ / n).toFixed(0)}px (雁 - 鸟)`);
console.log(`  轨迹: ${trace.join("  ")}`);
