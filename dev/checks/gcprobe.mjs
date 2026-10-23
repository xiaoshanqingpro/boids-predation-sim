/* GC 计数用的小驱动: 跑固定帧数, 配合 node --trace-gc 统计 Scavenge / Mark-Compact 次数 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(here, "..", "掠食竞赛.html"), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = () => {};
const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => ({ addColorStop: noop }) : noop), set: (t, p, v) => (t[p] = v, true) });
const documentStub = {
  getElementById: () => ({ textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, classList: { toggle: noop }, getContext: () => ctx, width: 1280, height: 720, addEventListener: noop, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) }),
  addEventListener: noop, createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }),
};
const sandbox = { document: documentStub, window: {}, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "sim.js" });
const SIM = sandbox.window.SIM;
SIM.setGeometry(false);
const N = Number(process.argv[2] || 2000), FRAMES = Number(process.argv[3] || 15000);
SIM.setN(N);
for (let i = 0; i < 2000; i++) SIM.step();          // 预热, 不计入
process.stderr.write(`---- GC-MARK N=${N} frames=${FRAMES} ----\n`);
for (let i = 0; i < FRAMES; i++) SIM.step();
process.stderr.write(`---- GC-END ----\n`);
