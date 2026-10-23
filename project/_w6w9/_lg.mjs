import fs from "node:fs";
import { loadSim, runFrames } from "./jsdom_drive.mjs";
let src = fs.readFileSync("_w6w9/sandbox_T1.html", "utf8");
const extA = "          f.dashT += 1;\n          f.chainLeft -= Math.min(64, Math.pow(1.5, f.chainEats));   // W6: 预算扣费 = 1.5^已吃数";
if (src.split(extA).length - 1 !== 1) throw new Error("ext anchor");
src = src.replace(extA,
  "          globalThis.__LOG = globalThis.__LOG || [];\n" +
  "          if (globalThis.__LOG.length < 12) globalThis.__LOG.push({ fr: frame, fi, pre: f.chainLeft, eats: f.chainEats, dT: f.dashT, cost: Math.min(64, Math.pow(1.5, f.chainEats)) });\n" +
  "          f.dashT += 1;\n" +
  "          f.chainLeft -= Math.min(64, Math.pow(1.5, f.chainEats));   // W6: 预算扣费 = 1.5^已吃数\n" +
  "          if (globalThis.__LOG.length && globalThis.__LOG[globalThis.__LOG.length-1].post === undefined) globalThis.__LOG[globalThis.__LOG.length-1].post = f.chainLeft;");
fs.writeFileSync("_w6w9/_lg.html", src);
const { SIM, win } = await loadSim("_w6w9/_lg.html", "?grav=0");
let s = 2654435761 >>> 0;
win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
SIM.resetFlocks(); SIM.resetPredators();
for (const k in SIM.stats) if (typeof SIM.stats[k] === "number") SIM.stats[k] = 0;
runFrames(SIM, 1500);
console.log("LOG:", JSON.stringify(win.__LOG, null, 0));
console.log("stats left/chainLeft 隼0:", SIM.chainInfo[0]);
