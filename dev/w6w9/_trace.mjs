import fs from "node:fs";
import { loadSim, runFrames } from "./jsdom_drive.mjs";

const BASE = fs.readFileSync("_w6w9/sandbox_T1.html", "utf8");
const ANCHOR = "          f.chainLeft -= Math.min(64, Math.pow(1.5, f.chainEats));   // W6: 预算扣费 = 1.5^已吃数";
if (BASE.split(ANCHOR).length - 1 !== 1) throw new Error("anchor missing");
const D = "          f.chainLeft -= 1 + 2 * f.chainEats;";
const inst = D + `
          globalThis.__TR = globalThis.__TR || [];
          if (globalThis.__TR.length < 400) globalThis.__TR.push({ f: frame, left: +f.chainLeft.toFixed(1), eats: f.chainEats, dT: f.dashT, lock: f.lockIdx });`;
const file = "_w6w9/_tr.html";
fs.writeFileSync(file, BASE.replace(ANCHOR, inst));

const { SIM, win } = await loadSim(file, "?grav=0");
let s = 2654435761 >>> 0;
win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
SIM.resetFlocks(); SIM.resetPredators();
for (const k in SIM.stats) if (typeof SIM.stats[k] === "number") SIM.stats[k] = 0;
runFrames(SIM, 1500);
const t0 = SIM.stats.steps;
runFrames(SIM, 900);
const tr = (win.__TR || []).filter(r => r.f >= t0);
console.log("样本数", tr.length);
console.log(tr.slice(0, 60).map(r => `${r.f} left=${r.left} eats=${r.eats} dT=${r.dT} lock=${r.lock}`).join("\n"));
console.log("chainMax", SIM.stats.chainMaxEats, "trig", SIM.stats.chainTriggers, "relock", SIM.stats.chainRelock, "energyEnds", SIM.stats.chainEnergyEnds);
