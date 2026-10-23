import { loadSim } from "./jsdom_drive.mjs";
const { SIM, win } = await loadSim("掠食竞赛(4).html", "");
console.log("load 后 frame =", SIM.frame, "aliveCount =", SIM.aliveCount, "paused?");
await new Promise(r => setTimeout(r, 300));
console.log("等 300ms 后 frame =", SIM.frame, "(rAF 是否在自动推进)");
SIM.setPaused(true);
await new Promise(r => setTimeout(r, 200));
console.log("暂停后再等 200ms frame =", SIM.frame);
console.log("hook 检查: setPaused", typeof SIM.setPaused, "setHarrier", typeof SIM.setHarrier, "harrierCount", SIM.harrierCount);
