/* ============================================================================
 * 任务0 物理基准 / 任务1 复测: 通过 SIM.bench() 打四档 step 耗时
 * 用法: node _checks/bench_physics.mjs [每档帧数]
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { PerformanceObserver } from "node:perf_hooks";

const here = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(here, "..", "掠食竞赛.html"), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const STEPS = Number(process.argv[2] || 300);

const noop = () => {};
const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => ({ addColorStop: noop }) : noop), set: (t, p, v) => (t[p] = v, true) });
const documentStub = {
  getElementById: () => ({ textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, classList: { toggle: noop }, getContext: () => ctx, width: 1280, height: 720, addEventListener: noop, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) }),
  addEventListener: noop, createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }),
};
const sandbox = { document: documentStub, window: {}, performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
                  requestAnimationFrame: () => 0, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "sim.js" });
const SIM = sandbox.window.SIM;
SIM.setGeometry(false);

console.log(`SIM.bench(${STEPS}, [2000, 5000, 10000, 20000])  单位 ms/frame, 只跑 step()\n`);
const rows = SIM.bench(STEPS, [2000, 5000, 10000, 20000]);
console.log("   N     median    p90     p99     mean");
for (const r of rows) {
  console.log(`${String(r.n).padStart(6)}  ${String(r.median).padStart(7)} ${String(r.p90).padStart(7)} ${String(r.p99).padStart(7)} ${String(r.mean).padStart(8)}`);
}
const tenK = rows.find(r => r.n === 10000);
console.log(`\n判定: N=10000 step 中位数 ${tenK.median} ms -> ${tenK.median <= 8 ? "<= 8ms, 物理不是瓶颈" : "> 8ms, 物理是瓶颈"}`);
const budget60 = 16.7, budget30 = 33.3;
// 以 N 与 step 近似线性外推物理上限(用于交接说明的结论行)
const perBird = tenK.median / 10000;
console.log(`线性外推: 每只鸟约 ${(perBird * 1000).toFixed(2)} µs/帧 -> 60FPS(16.7ms) 上限约 ${Math.floor(budget60 / perBird / 100) * 100} 只, 30FPS(33.3ms) 上限约 ${Math.floor(budget30 / perBird / 100) * 100} 只`);

/* ---- GC 观测(任务1 的目标: Major GC ~ 0) ---- */
let major = 0, minor = 0, incr = 0;
const obs = new PerformanceObserver(list => {
  for (const e of list.getEntries()) {
    if (e.detail && e.detail.kind === 2) major++;
    else if (e.detail && e.detail.kind === 1) minor++;
    else incr++;
  }
});
try { obs.observe({ entryTypes: ["gc"] }); } catch (e) { console.log("(GC observer 不可用: " + e.message + ")"); }
const gcFrames = Number(process.argv[3] || 20000);
SIM.setN(2000);
for (let i = 0; i < gcFrames; i++) SIM.step();
obs.disconnect();
console.log(`\nGC 观测: N=2000 跑 ${gcFrames} 帧 -> Major ${major} 次, Minor ${minor} 次, 其它 ${incr} 次`);
