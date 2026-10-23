/* 量化: 俯冲相 / 冲刺效率 / 捕食是否恢复 / 鸟云厚度 / 别名 */
import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("掠食竞赛.html", "utf8");
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
let maxStoop = 0, stoopFrames = 0, cruiseAbove = 0, cruiseCnt = 0, dashVzMin = 0, dashStarts = 0;
const prevDash = [];
const samples = [];
for (let f = 0; f < FRAMES; f++) {
  SIM.step();
  const st = SIM.stoop;
  if (st.length) { const m = Math.max(...st); if (m > maxStoop) maxStoop = m; if (m > 0) stoopFrames++; }
  const zr = SIM.zRange;
  const flockMean = zr.starling ? zr.starling.mean : 170;
  for (let k = 0; k < SIM.raptorCount.total; k++) {
    const h = SIM.hunter(k);
    if (h.dashT > 0) {
      if ((h.vz || 0) < dashVzMin) dashVzMin = h.vz || 0;
      if (!prevDash[k]) dashStarts++;
      prevDash[k] = 1;
    } else {
      prevDash[k] = 0;
      cruiseCnt++;
      if (h.z > flockMean + 40) cruiseAbove++;
    }
  }
  if (f % 1000 === 0) { const z = SIM.zRange; samples.push("f" + f + ": 跨度" + (z.starling ? (z.starling.hi - z.starling.lo).toFixed(0) : "-") + "/均" + (z.starling ? z.starling.mean.toFixed(0) : "-")); }
}
const kills = SIM.kills.reduce((a, b) => a + b, 0);
console.log(FRAMES + " 帧: 总捕获 " + kills + " (第 7 轮同规模基准约 77/5000帧), 冲刺 " + dashStarts + " 次, 每次吃到 " + (kills / Math.max(1, dashStarts)).toFixed(2) + " 只");
console.log("俯冲相: " + stoopFrames + " 帧, 最长 " + maxStoop + "; 冲刺最低 vz=" + dashVzMin.toFixed(2) + "; 巡航在鸟群上方 40px 比例 " + (100 * cruiseAbove / Math.max(1, cruiseCnt)).toFixed(0) + "%");
console.log("鸟云: " + samples.join("  "));
console.log("别名: " + JSON.stringify(SIM.raptorRefs()));
console.log("食谱: 椋鸟 " + SIM.diet[0] + " / 雁 " + SIM.diet[1] + "  分数 " + SIM.scores.join("/"));
