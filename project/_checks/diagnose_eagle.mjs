/* 长程诊断: 三方猛禽的捕获构成、鹰的食谱与 Q 表演化(不参与断言) */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(here, "..", "掠食竞赛.html"), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = () => {};
const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => ({ addColorStop: noop }) : noop), set: (t, p, v) => (t[p] = v, true) });
const documentStub = { getElementById: () => ({ textContent: "", value: "0", checked: false, style: {}, classList: { toggle: noop }, getContext: () => ctx, width: 250, height: 100, addEventListener: noop }), addEventListener: noop };
const sandbox = { document: documentStub, window: {}, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "sim.js" });
const SIM = sandbox.window.SIM;
SIM.setGeometry(false);

const STEPS = Number(process.argv[2] || 15000);
const ROWS = ["椋近", "椋中", "椋远", "雁近", "雁中", "雁远", "全空"];
const act = ["追椋", "追雁", "伏击", "攻隼"];
const NA = 4, NS = 7;
for (let s = 1; s <= STEPS; s++) {
  SIM.step();
  if (s % 3000 === 0) {
    const k = SIM.kills, d = SIM.diet;
    console.log(`--- ${s} 步 (${(s / 60).toFixed(0)}s) --- 隼①${k[0]} 隼②${k[1]} 鹰${k[2]} | 鹰食谱 椋${d[0]}/雁${d[1]} | ε=${SIM.eps.toFixed(3)} | 椋鸟存活 ${SIM.aliveCount} | 分数 ${SIM.scores.join("/")}`);
    const q = SIM.Q;
    const best = [];
    for (let st = 0; st < NS; st++) {
      let ba = 0;
      for (let a = 1; a < NA; a++) if (q[st * NA + a] > q[st * NA + ba]) ba = a;
      best.push(`${ROWS[st]}:${act[ba]}(${q[st * NA].toFixed(1)},${q[st * NA + 1].toFixed(1)},${q[st * NA + 2].toFixed(1)},${q[st * NA + 3].toFixed(1)})`);
    }
    console.log("    贪心策略 " + best.join("  "));
  }
}
/* 验收判据 3: "雁近"行的贪心动作应逐渐偏向"追雁" */
const q = SIM.Q, st = 3, chaseGoose = q[st * NA + 1], chaseStar = q[st * NA + 0];
console.log(`\n验收判据 3: 雁近行 Q(追雁)=${chaseGoose.toFixed(2)} vs Q(追椋)=${chaseStar.toFixed(2)} -> ` +
            (chaseGoose > chaseStar ? "偏向追雁 ✓" : "未偏向追雁 ✗"));
const killed = SIM.kills, diet = SIM.diet;
console.log(`总计: 隼${killed[0]}+${killed[1]} 鹰${killed[2]}; 鹰食谱 椋${diet[0]}/雁${diet[1]}; 空冲刺 隼${SIM.stats.missFalcon}/鹰${SIM.stats.missEagle}; 围攻打断 ${SIM.stats.mobInterrupts}; 互攻 ${SIM.stats.clashes}`);

