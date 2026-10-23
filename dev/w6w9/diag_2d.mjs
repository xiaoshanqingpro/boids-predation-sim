/* 诊断 2D 变体: 雁隼能否加入 / 驱逐鸟控件 / 边界机制与效果 */
import { loadSim, physicsHash } from "./jsdom_drive.mjs";

import path from "node:path";
import { fileURLToPath } from "node:url";
// 脚本在 dev/w6w9/ 下，上溯两级即仓库根（原来写死本机桌面副本目录）。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const name of ["掠食竞赛(4).html", "掠食竞赛_2D.html"]) { const file = path.join(ROOT, name);
  console.log("=".repeat(74));
  console.log("=== " + file + " ===");
  const { SIM, win, sha256 } = await loadSim(file, "", { fresh: true });
  console.log("sha:", sha256.slice(0, 16));
  // 边界机制与常量（读源码文本更可靠）
  const html = (await import("node:fs")).readFileSync(file, "utf8");
  const pick = (re) => (html.match(re) || [null])[0];
  console.log("  世界尺寸:", pick(/const W = \d+, H = \d+;/) || "(未找到)");
  console.log("  视口:", pick(/const VIEW_W = \d+, VIEW_H = \d+;/) || "(未找到)");
  console.log("  边界半径/力:", pick(/const BOUND_R = [\d.]+;/) || "?", pick(/const BOUND_F_MAX = [\d.]+;/) || "?");
  console.log("  worldInfo:", SIM.worldInfo ? JSON.stringify(SIM.worldInfo()) : "(无钩子)");
  // 雁隼加入
  try {
    const before = JSON.stringify(SIM.raptorCount);
    if (typeof SIM.addGhunter !== "function") throw new Error("SIM.addGhunter 不是函数: " + typeof SIM.addGhunter);
    SIM.addGhunter();
    for (let i = 0; i < 60; i++) SIM.step();
    console.log("  雁隼加入: ✓ before=" + before + " after=" + JSON.stringify(SIM.raptorCount));
  } catch (e) {
    console.log("  雁隼加入: ✗ " + e.constructor.name + ": " + e.message);
    console.log("     stack: " + String(e.stack).split("\n").slice(1, 4).map(s => s.trim()).join(" | ").slice(0, 240));
  }
  // 驱逐鸟控件
  try {
    const cnt0 = SIM.harrierCount !== undefined ? SIM.harrierCount : (SIM.harrierInfo ? SIM.harrierInfo.length : "?");
    let off = null, on = null;
    if (typeof SIM.setHarrier === "function") {
      SIM.setHarrier(false); off = SIM.harrierCount !== undefined ? SIM.harrierCount : (SIM.harrierInfo ? SIM.harrierInfo.length : "?");
      SIM.setHarrier(true); on = SIM.harrierCount !== undefined ? SIM.harrierCount : (SIM.harrierInfo ? SIM.harrierInfo.length : "?");
    }
    console.log("  驱逐鸟: 初始=" + cnt0 + " setHarrier(false)→" + off + " setHarrier(true)→" + on + "  (harrierInfo=" + (SIM.harrierInfo ? "有" : "无") + ")");
    const cb = win.document.getElementById("cbHarrier");
    console.log("  面板 cbHarrier: " + (cb ? ("存在 checked=" + cb.checked) : "缺失 ✗"));
  } catch (e) {
    console.log("  驱逐鸟: ✗ " + e.message);
  }
  // 面板控件清点
  const ids = ["btnGPlus", "btnGMinus", "cbHarrier", "btnView", "cbGravity", "cbTrail", "cbEat3D", "bcv", "qcv", "aliveS", "viewLine", "fpsLine", "btnFPlus", "btnEPlus", "btnAddFalcon", "btnAddEagle"];
  const missing = ids.filter(i => !win.document.getElementById(i));
  console.log("  面板缺失 id:", missing.length ? missing.join(", ") : "无");
  // 边界实际效果: 10000 帧内到边界最近距离 + clamp 计数
  if (SIM.resetBoundStats) SIM.resetBoundStats();
  let minE = 1e9;
  for (let i = 0; i < 3000; i++) {
    SIM.step();
    if (i % 3 === 0) for (let k = 0; k < SIM.N; k += 7) {
      const s = SIM.starling(k); if (!s || !s.alive) continue;
      const wi = SIM.worldInfo ? SIM.worldInfo() : { worldW: 3200, worldH: 2200 };
      const e = Math.min(s.x, wi.worldW - s.x, s.y, wi.worldH - s.y);
      if (e < minE) minE = e;
    }
  }
  const w2 = SIM.worldInfo ? SIM.worldInfo() : {};
  console.log("  边界实测(3000帧抽样): 椋鸟到边最近 " + minE.toFixed(1) + "px; clampCount=" + (w2.clampCount ?? "?") + "; peak=" + (w2.peakPenetration !== undefined ? w2.peakPenetration.toFixed(3) : "?") + "; minEdgeDist=" + (w2.minEdgeDist !== undefined && w2.minEdgeDist !== null ? w2.minEdgeDist.toFixed(1) : "?"));
  console.log("  物理哈希:", physicsHash(SIM));
}

