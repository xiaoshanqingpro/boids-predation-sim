import { oneRun } from "./t1_probe.mjs";
const htmlPath = process.argv[2] || "掠食竞赛(4).html";
const warm = +(process.argv[3] || 1500);
const frames = +(process.argv[4] || 4000);
let seeds = process.argv.slice(5).map(Number);
if (!seeds.length) seeds = [1, 2, 3, 4];
const rows = [];
for (const s of seeds) {
  const r = await oneRun(s, warm, frames, htmlPath);
  rows.push(r);
  console.log(JSON.stringify(r));
}
const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
const has = k => rows.every(r => r[k] !== null && r[k] !== undefined);
console.log("--- 汇总(" + htmlPath + " warm=" + warm + " frames=" + frames + ") ---");
console.log("dashMaxEats 全局:", Math.max(...rows.map(r => r.dashMaxEats)));
console.log("dashEnds 增量:", rows.map(r => r.dDashEnds).join(","), " 合计", sum("dDashEnds"));
if (has("dashEats0")) {
  console.log("单次冲刺 eats 均值(隼①吃数/隼①冲刺数):", rows.map(r => r.eatMeanPerDash).join(","));
  console.log("隼①冲刺收尾数:", rows.map(r => r.dashEndsF0).join(","), " 隼②:", rows.map(r => r.dashEndsF1).join(","));
  console.log("单链 eats 上界:", rows.map(r => r.chainMaxEats).join(","), " 验收 dashMaxEats:", rows.map(r => r.dashMaxEats).join(","));
}
console.log("链终止分布 能量:", rows.map(r => r.endEnergy).join(","),
  " 预算:", rows.map(r => r.endBudget).join(","),
  " 账单:", rows.map(r => r.endBill).join(","),
  " 大餐:", rows.map(r => r.endGoose).join(","),
  " 打断:", rows.map(r => r.endInterrupt).join(","));
console.log("Δscore0:", rows.map(r => r.dScore0).join(","), " 隼①净得分>0 的种子数:", rows.filter(r => r.dScore0 > 0).length);
console.log("EV/次冲刺:", rows.map(r => r.evPerDash).join(","));
if (has("chainGooseEnds")) console.log("chainGooseEnds:", rows.map(r => r.chainGooseEnds).join(","), " 增量:", rows.map(r => r.dChainGooseEnds).join(","));
if (has("chainRelock")) console.log("再锁定次数:", rows.map(r => r.chainRelock).join(","), " 链触发:", rows.map(r => r.chainTriggers).join(","));
console.log("总捕获:", rows.map(r => r.killsTotal).join(","));
console.log("物理哈希:", rows.map(r => r.hash).join(","));
