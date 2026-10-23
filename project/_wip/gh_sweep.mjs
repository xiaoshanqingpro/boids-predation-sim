/* 快速扫参: 只跑 [A] 场景的核心数字, 便于调参 */
import fs from "node:fs"; import path from "node:path"; import vm from "node:vm";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
function mk(seed) {
  const raw = fs.readFileSync(path.join(here, "掠食竞赛-goosehunter.html"), "utf8");
  const cut = raw.indexOf('<script type="text/plain"');
  const code = [...(cut > 0 ? raw.slice(0, cut) : raw).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])[0];
  const noop = () => {}; const grad = { addColorStop: noop };
  const ctxStub = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : noop)), set: (t, p, v) => (t[p] = v, true) });
  const els = new Map();
  const mkEl = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, children: [], style: {}, classList: { toggle: noop }, getContext: () => ctxStub, addEventListener: noop, appendChild(c) { this.children.push(c); return c; }, removeChild() {}, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
  const document = { getElementById: id => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); }, createElement: mkEl, addEventListener: noop };
  let s = seed >>> 0; const M = Object.create(Math); M.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const sandbox = { document, window: { addEventListener: noop, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 }, Math: M, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console, localStorage: { getItem: () => null, setItem: noop } };
  vm.createContext(sandbox); vm.runInContext(code, sandbox, { filename: "sim.js" });
  return sandbox.window.SIM;
}
const seeds = [20261015, 777, 4242, 31337];
for (const seed of seeds) {
  const SIM = mk(seed);
  SIM.setGeometry(false); SIM.setGravity(true); SIM.setN(2000); SIM.setRefill(true);
  SIM.resetPredators(); SIM.addGooseHunter();
  const launches = []; let prev = 0; let maxSp = 0;
  for (let f = 0; f < 3600; f++) {
    SIM.step();
    const g = SIM.ghunterInfo[0];
    if (g.attacks > prev) { for (let k = prev; k < g.attacks; k++) launches.push(f); prev = g.attacks; }
    const h = SIM.hunter(3);
    if (h.dashT > 0) { const sp = Math.hypot(h.vx, h.vy); if (sp > maxSp) maxSp = sp; }
  }
  const st = SIM.stats;
  let wmax = 0;
  for (let f = 599; f < 3600; f++) wmax = Math.max(wmax, launches.filter(x => x > f - 600 && x <= f).length);
  console.log(`seed ${seed}: 攻击 ${st.ghunterAttacks} 帧[${launches.join(",")}] 雁${st.ghunterGoose}/鸟${st.ghunterStarling}/落空${st.ghunterMiss} 峰值${maxSp.toFixed(2)} 600帧窗口max=${wmax} 冷却忽略${st.ghunterCooldownContacts} 雁隼得分${SIM.ghunterScores}`);
}
