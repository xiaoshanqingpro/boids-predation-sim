import fs from "node:fs"; import path from "node:path"; import vm from "node:vm";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const raw = fs.readFileSync(path.join(here, "掠食竞赛-goosehunter.html"), "utf8");
const cut = raw.indexOf('<script type="text/plain"');
const code = [...(cut > 0 ? raw.slice(0, cut) : raw).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])[0];
const noop = () => {}; const grad = { addColorStop: noop };
const ctxStub = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : noop)), set: (t, p, v) => (t[p] = v, true) });
const els = new Map();
const mkEl = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, children: [], style: {}, classList: { toggle: noop }, getContext: () => ctxStub, addEventListener: noop, appendChild(c) { this.children.push(c); return c; }, removeChild() {}, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
const document = { getElementById: id => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); }, createElement: mkEl, addEventListener: noop };
let s = 20261015 >>> 0; const M = Object.create(Math); M.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const sandbox = { document, window: { addEventListener: noop, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 }, Math: M, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console, localStorage: { getItem: () => null, setItem: noop } };
vm.createContext(sandbox); vm.runInContext(code, sandbox, { filename: "sim.js" });
const SIM = sandbox.window.SIM;
SIM.setGeometry(false); SIM.setGravity(true); SIM.setN(2000); SIM.setRefill(true); SIM.resetPredators();
SIM.addGooseHunter();
console.log("addGooseHunter ->", JSON.stringify(SIM.raptorCount));
const rc = SIM.raptorCount;
console.log("hunter(3) =", JSON.stringify(SIM.hunter(rc.total - 1)));
for (let f = 0; f < 400; f++) {
  SIM.step();
  if (f % 50 === 0 || f < 5) {
    const g = SIM.ghunterInfo[0];
    console.log(`f${f} x=${g.x.toFixed(1)} y=${g.y.toFixed(1)} z=${g.z.toFixed(1)} atkSeq=${g.atkSeq} attack=${g.attack} cool=${g.cool} dashT=${g.dashT} tgtGoose=${g.tgtGoose} energy=${g.energy.toFixed(0)} sp=${Math.hypot(SIM.hunter(3).vx, SIM.hunter(3).vy).toFixed(2)}`);
  }
}
const g = SIM.ghunterInfo[0];
console.log("Apex/lead:", JSON.stringify(SIM.leader));
console.log("goose0:", JSON.stringify(SIM.goose(0)));
console.log("stats:", JSON.stringify(SIM.stats));
console.log("sample log:", JSON.stringify(SIM.logTail(5)));
