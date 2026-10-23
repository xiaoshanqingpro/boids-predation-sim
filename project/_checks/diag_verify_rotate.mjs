/* verifier(task-5) 诊断: 雁群轮值领队次数超期望(3600 帧内 5 次 > 断言上限 4)
 * 用法: node _checks\diag_verify_rotate.mjs [html] [frames]
 * 输出: 每次 leaderIdx 变化的帧号 + 变化原因(周期到期 / 前任 apex 已死 / 其他) */
import { cliHtml, cliFrames, loadSim, readHtml, setup } from "./accept_lib.mjs";

const HTML = cliHtml(), FRAMES = cliFrames(3600);
const { html, hash } = readHtml(HTML);
const { SIM } = loadSim(HTML, html);
setup(SIM, { n: 2000, gravity: true, refill: true });     // 与 headless [11] 同口径(开启自动补充)
for (let i = 0; i < 60; i++) SIM.step();                  // 预热
const gi = SIM.geeseInfo;
console.log(`main sha256:${hash}…; ROTATE 期望每 1200 帧一次; 起始 leaderIdx=${gi.leaderIdx} galive=${gi.galiveCount}`);

let prevIdx = gi.leaderIdx, prevGalive = gi.galiveCount, changes = 0;
const events = [];
for (let f = 1; f <= FRAMES; f++) {
  SIM.step();
  const g = SIM.geeseInfo;
  if (g.leaderIdx !== prevIdx) {
    changes++;
    const frameNo = SIM.frame;
    const periodic = frameNo % 1200 === 0;
    const apexDied = g.galiveCount < prevGalive;
    events.push({ f, frameNo, from: prevIdx, to: g.leaderIdx, periodic, apexDied, galive: g.galiveCount, disarray: g.disarray, alerts: g.alerts });
  }
  prevIdx = g.leaderIdx; prevGalive = g.galiveCount;
}
console.log(`3600 帧内 leaderIdx 变化 ${changes} 次 (headless 断言窗口 2~4)`);
for (const e of events) {
  console.log(`  f${e.f} (SIM.frame=${e.frameNo}): ${e.from} -> ${e.to} | ${e.periodic ? "周期到期(frame%1200==0)" : "非周期"} | `
    + `雁存活 ${e.galive} | 前帧存活更低=${e.apexDied} | disarray=${e.disarray} | alerts=${e.alerts}`);
}
const gEnd = SIM.geeseInfo;
console.log(`末态: leaderIdx=${gEnd.leaderIdx} galive=${gEnd.galiveCount} 斩首次数=${gEnd.disarrayCount} 误报=${gEnd.falseAlerts}`);
