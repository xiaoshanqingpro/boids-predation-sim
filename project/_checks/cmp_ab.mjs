/* 对比: A 版(拓扑椋鸟+双隼, 原文件)与本整合版同 N 下的 step 耗时 */
import fs from "node:fs";
import vm from "node:vm";

function load(file, patch) {
  let code = fs.readFileSync(file, "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
  if (patch) code = patch(code);
  const noop = () => {};
  const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => ({ addColorStop: noop }) : noop), set: (t, p, v) => (t[p] = v, true) });
  const documentStub = { getElementById: () => ({ textContent: "", value: "0", checked: false, style: {}, classList: { toggle: noop }, getContext: () => ctx, width: 250, height: 100, addEventListener: noop }), addEventListener: noop };
  const sandbox = { document: documentStub, window: {}, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });
  return sandbox.window.SIM;
}

const A = process.argv[2], B = process.argv[3];
const N = Number(process.argv[4] || 2000);
const STEPS = Number(process.argv[5] || 1200);

function bench(label, SIM) {
  SIM.setGeometry(false); SIM.setN(N);
  for (let i = 0; i < 200; i++) SIM.step();
  const t = performance.now();
  for (let i = 0; i < STEPS; i++) SIM.step();
  console.log(`${label.padEnd(22)} N=${N}: ${((performance.now() - t) / STEPS).toFixed(2)} ms/step`);
}

if (A) {
  const simA = load(A, c => c
    .replace(/const W = 1280, H = 720, N = \d+;/, `const W = 1280, H = 720, N = ${N};`)
    + `\nwindow.SIM = { step: () => step(), setN(){}, setGeometry(){} };`);
  bench("A版 拓扑椋鸟+双隼", simA);
}
if (B) bench("整合版 4 种群", load(B));
