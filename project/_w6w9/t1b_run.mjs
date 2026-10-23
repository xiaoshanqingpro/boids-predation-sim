/* T1b 验收矩阵运行器: 4 种子 × {驱逐鸟开/关} × {隼×2 / 隼×1}
 * 用法: node _w6w9/t1b_run.mjs <html> [warm] [frames] [seeds...]
 * 输出: 每行 JSON + 汇总(判据按隔离臂=驱逐鸟关 判定, 集成臂并列)。 */
import { oneRun } from "./t1b_probe.mjs";
import { readHtmlCached } from "./jsdom_drive.mjs";

const htmlPath = process.argv[2] || "掠食竞赛(4).html";
const warm = +(process.argv[3] || 1500);
const frames = +(process.argv[4] || 4000);
let seeds = process.argv.slice(5).map(Number);
if (!seeds.length) seeds = [1, 2, 3, 4];
const { sha256 } = readHtmlCached(htmlPath, true);
console.log("html=" + htmlPath + "  sha256=" + sha256 + "  warm=" + warm + " frames=" + frames + " seeds=" + seeds.join(","));

const rows = [];
for (const harrier of [true, false]) {
  for (const nf of [2, 1]) {
    for (const s of seeds) {
      const r = await oneRun(s, warm, frames, htmlPath, { harrier, falcons: nf });
      r.sha = sha256.slice(0, 16);
      rows.push(r);
      console.log(JSON.stringify(r));
    }
  }
}

const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const grp = (arm, nf) => rows.filter(r => r.harrier === arm && r.nFalcon === nf);

console.log("\n=== 汇总 ===");
for (const arm of [true, false]) {
  const tag = arm ? "集成(驱逐鸟开)" : "隔离(驱逐鸟关)";
  for (const nf of [2, 1]) {
    const rs = grp(arm, nf);
    if (!rs.length) continue;
    console.log(`[${tag}] 隼×${nf}  n=${rs.length}`);
    console.log(`   dashEndBirds/冲刺 = ${rs.map(r => r.dashEndBirdsPerDash).join("/")}  均值 ${mean(rs.map(r => r.dashEndBirdsPerDash).filter(v => v !== null)).toFixed(2)}  中位 ${med(rs.map(r => r.dashEndBirdsPerDash).filter(v => v !== null)).toFixed(2)}`);
    console.log(`   Δ捕获(4000帧) = ${rs.map(r => r.dKills).join("/")}  均值 ${mean(rs.map(r => r.dKills)).toFixed(1)}`);
    console.log(`   冲刺数 = ${rs.map(r => r.dashEnds).join("/")}   单冲刺吃数(隼①) = ${rs.map(r => r.eatMeanF0).join("/")}`);
    console.log(`   速度方差(全隼合并) = ${rs.map(r => r.spdVar).join("/")}  中位 ${med(rs.map(r => r.spdVar).filter(v => v !== null)).toFixed(4)}`);
    console.log(`   同盟豁免: 隼-隼互攻 ${rs.map(r => r.falconClashes).join("/")} · 隼-隼抢分 ${rs.map(r => r.falconSteals).join("/")} · 总抢分 ${rs.map(r => r.steals).join("/")}`);
    console.log(`   四件套计数: 共享感知 ${rs.map(r => r.sharedPcUses).join("/")} · 事件双打 ${rs.map(r => r.eventDoubles).join("/")} · 牧羊帧 ${rs.map(r => r.shepherdFrames).join("/")} · 偏向冲刺 ${rs.map(r => r.evtBiasDashes).join("/")}`);
    console.log(`   角色帧(猎/伏/牧) = ${rs.map(r => r.roleHunter + "/" + r.roleAmbush + "/" + r.roleShepherd).join("  ")}`);
  }
  const a2 = grp(arm, 2), a1 = grp(arm, 1);
  if (a2.length && a1.length) {
    const per = a2.map((r, i) => r.dKills / Math.max(1e-9, a1[i].dKills));
    console.log(`[${tag}] 隼×2 / 隼×1 总捕获比: 逐种子 ${per.map(v => v.toFixed(2)).join("/")}  中位 ${med(per).toFixed(2)}  均值 ${mean(per).toFixed(2)}`);
  }
}
const iso2 = grp(false, 2);
console.log("\n隔离臂 隼×2 物理哈希: " + iso2.map(r => r.hash).join(","));
console.log("隔离臂 隼×2 dashMaxEats: " + iso2.map(r => r.dashMaxEats).join(",") + "  链触发: " + iso2.map(r => r.chainTriggers).join(","));
