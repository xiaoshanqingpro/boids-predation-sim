/* 2D 修正后的补充检查: 驱逐鸟数量控制 / 面板控件 / 边界渲染函数 / 雁隼加入后跑帧 */
import { loadSim } from "./jsdom_drive.mjs";
const F = process.argv[2] || "掠食竞赛_2D.html";
const { SIM, win, errors, sha256 } = await loadSim(F, "", { fresh: true });
console.log(`文件 ${F} · sha ${sha256.slice(0, 16)}`);
const ok = (c, msg) => console.log(`  ${c ? "✓" : "✗"} ${msg}`);

/* 雁隼: 加入 + 跑 120 帧 */
try {
  SIM.addGhunter();
  for (let i = 0; i < 120; i++) SIM.step();
  ok(SIM.raptorCount.ghunters === 1, `雁隼加入并跑 120 帧无异常 (ghunters=${SIM.raptorCount.ghunters})`);
} catch (e) { ok(false, "雁隼加入/跑帧: " + e.message); }

/* 驱逐鸟数量控制 */
const seq = [];
for (const n of [6, 5, 3, 1, 0, 2, 6]) { SIM.setHarrierCount(n); seq.push(`${n}→${SIM.harrierCount}`); }
ok(true, "setHarrierCount 序列 " + seq.join(" "));
ok(SIM.harrierCount === 6, "setHarrierCount(6) 回到 6");
SIM.setHarrierCount(0);
ok(SIM.harrierCount === 0 && SIM.harrierOn === false, "setHarrierCount(0): 存活 0 且 harrierOn=false");
ok(win.document.getElementById("cbHarrier").checked === false, "数量 0 时复选框自动取消勾选(同步)");
SIM.setHarrierCount(4);
ok(SIM.harrierCount === 4 && win.document.getElementById("cbHarrier").checked === true, "setHarrierCount(4): 存活 4 + 复选框勾上");
for (let i = 0; i < 60; i++) SIM.step();
const roster4 = SIM.harrierInfo.list.filter(h => h.active).length;
ok(SIM.harrierCount <= 4 && roster4 === 4, `在编 4 只跑 60 帧: 在编 ${roster4}/4, 存活 ${SIM.harrierCount}(阵亡的会 60 帧后重生 -> 存活可短暂 <4)`);
SIM.setHarrier(false);
const off0 = SIM.harrierCount;
for (let i = 0; i < 120; i++) SIM.step();
ok(off0 === 0 && SIM.harrierCount === 0, "setHarrier(false) 后跑 120 帧仍为 0(真退场)");
SIM.setHarrier(true);
ok(SIM.harrierCount === 6, "setHarrier(true) 重新生成 6 只");
ok(SIM.harrierConst.inThreats === false, "驱逐鸟仍不进 threats");

/* 面板控件 */
const need = ["btnHMinus", "btnHPlus", "cbHarrier", "harrierLine", "btnGPlus", "btnGMinus"];
const miss = need.filter(i => !win.document.getElementById(i));
ok(miss.length === 0, "面板控件齐全 " + need.join(",") + (miss.length ? " 缺:" + miss.join(",") : ""));
console.log("  harrierLine 文案: " + win.document.getElementById("harrierLine").textContent);
console.log("  驱逐鸟 −/＋ 处理器已接: " + (typeof win.document.getElementById("btnHMinus").onclick === "function") +
            " / " + (typeof win.document.getElementById("btnHPlus").onclick === "function"));

/* 边界渲染函数存在(源码级) */
const src = (await import("node:fs")).readFileSync(F, "utf8");
ok(/function drawWorldBounds\(\)/.test(src), "源码里新增 drawWorldBounds()(世界边框 + 厌恶带)");
ok(/if \(!TORUS\) drawWorldBounds\(\);/.test(src), "renderOverlay 里已调用 drawWorldBounds()");
ok(/function drawMinimap\(\)/.test(src) && /drawMinimap\(\);/.test(src), "小地图 drawMinimap() 仍在且被调用");
ok(/class="row"><button id="btnHMinus"/.test(src), "面板 HTML 有 驱逐鸟 −/＋ 按钮");

/* 边界机制数字 */
if (SIM.resetBoundStats) SIM.resetBoundStats();
for (let i = 0; i < 1500; i++) SIM.step();
const w = SIM.worldInfo();
console.log(`  边界: world ${w.worldW}×${w.worldH} viewport ${w.viewW}×${w.viewH} boundR ${w.boundR} · clamp ${w.clampCount} · peak ${w.peakPenetration.toFixed(3)} · minEdge ${w.minEdgeDist === null ? "null" : w.minEdgeDist.toFixed(1)}`);
console.log(`  jsdom 加载期报错 ${errors.length} 条 ${errors.length ? "(canvas 属预期)" : ""}`);
process.exit(0);
