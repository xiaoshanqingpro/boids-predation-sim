/* 诊断②: 2D 加雁隼后 render 是否崩 + 计分板分数为何是长小数 */
import fs from "node:fs";
import { loadSim } from "./jsdom_drive.mjs";
const ROOT = "C:/Users/LIHAOYANG/Desktop/资料库/鸟群掠食模拟/";

for (const name of ["掠食竞赛(4).html", "掠食竞赛_2D.html"]) {
  console.log("=".repeat(72));
  console.log("=== " + name + " ===");
  const { SIM, win } = await loadSim(ROOT + name, "", { fresh: true });
  // 计数用的假 ctx, 让 render 真正走完(jsdom 默认 getContext 返回 null)
  const calls = { n: 0 };
  const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "canvas" ? { width: 1280, height: 720 } : () => { calls.n++; })), set: (t, p, v) => (t[p] = v, true) });
  try { win.HTMLCanvasElement.prototype.getContext = () => ctx; } catch (e) {}
  try {
    SIM.addGhunter();
    console.log("  雁隼加入: ✓ " + JSON.stringify(SIM.raptorCount));
  } catch (e) { console.log("  雁隼加入: ✗ " + e.constructor.name + ": " + e.message); }
  // 加完立刻渲染
  try {
    SIM.render();
    console.log("  render(): ✓ 无异常, 绘制调用 " + calls.n);
  } catch (e) {
    console.log("  render(): ✗ " + e.constructor.name + ": " + e.message);
    console.log("     " + String(e.stack).split("\n").slice(0, 5).map(s => s.trim()).join("\n     ").slice(0, 400));
  }
  // 跑 60 帧(含 render)
  let stepped = 0, renderFail = null;
  try { for (let i = 0; i < 60; i++) { SIM.step(); SIM.render(); stepped++; } } catch (e) { renderFail = e.constructor.name + ": " + e.message; }
  console.log("  60 帧 step+render: " + (renderFail ? "✗ 第 " + stepped + " 帧 " + renderFail : "✓ 全部通过"));
  // 计分板小数来源
  const sc = SIM.scores, kk = SIM.kills;
  console.log("  SIM.scores =", JSON.stringify(Array.from(sc)));
  console.log("  SIM.kills  =", JSON.stringify(Array.from(kk)));
  const f = SIM.hunterDetail ? SIM.hunterDetail(0) : null;
  console.log("  hunterDetail(0).score =", f ? f.score : "(无)");
  console.log("  ghunterInfo[0].score =", SIM.ghunterInfo && SIM.ghunterInfo[0] ? SIM.ghunterInfo[0].score : "(无)");
  console.log("  harrierInfo[0] =", SIM.harrierInfo && SIM.harrierInfo[0] ? JSON.stringify(SIM.harrierInfo[0]) : "(无)");
}
