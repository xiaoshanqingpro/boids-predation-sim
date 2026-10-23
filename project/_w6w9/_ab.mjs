import fs from "node:fs";
import { loadSim, runFrames } from "./jsdom_drive.mjs";

const BASE = fs.readFileSync("_w6w9/sandbox_T1.html", "utf8");
const CA = "          f.chainLeft -= Math.min(64, Math.pow(1.5, f.chainEats));   // W6: 预算扣费 = 1.5^已吃数";
const MA = "const F_CHAIN_MISS = 12;";
const XA = "const F_CHAIN_MAX = 150;";
if (BASE.split(CA).length - 1 !== 1) throw new Error("cost");
if (BASE.split(MA).length - 1 !== 1) throw new Error("miss");
if (BASE.split(XA).length - 1 !== 1) throw new Error("max");

const CONFIGS = [
  { name: "baseline-sandbox", cost: CA, miss: 12, max: 150 },
  { name: "miss=999", cost: CA, miss: 999, max: 150 },
  { name: "miss=25", cost: CA, miss: 25, max: 150 },
  { name: "miss=999,max=60", cost: CA, miss: 999, max: 60 },
  { name: "cost=1,miss=999,max=150", cost: "          f.chainLeft -= 1;", miss: 999, max: 150 },
];
const WARM = 1500, FRAMES = 4000;
for (const cfg of CONFIGS) {
  const file = "_w6w9/_ab.html";
  fs.writeFileSync(file, BASE.replace(CA, cfg.cost).replace(MA, "const F_CHAIN_MISS = " + cfg.miss + ";").replace(XA, "const F_CHAIN_MAX = " + cfg.max + ";"));
  const rows = [];
  for (const seed of [1, 2, 3, 4]) {
    const { SIM, win } = await loadSim(file, "?grav=0");
    let s = (seed * 2654435761) >>> 0;
    win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    SIM.resetFlocks(); SIM.resetPredators();
    for (const k in SIM.stats) if (typeof SIM.stats[k] === "number") SIM.stats[k] = 0;
    runFrames(SIM, WARM);
    const st = SIM.stats, s0 = SIM.scores[0], m0 = st.missFalcon, d0 = st.dashEnds;
    runFrames(SIM, FRAMES);
    const dEnds = st.dashEnds - d0;
    rows.push({ cmax: st.chainMaxEats, dEnds, mean0: +(st.dashEatsFalcon0 / Math.max(1, dEnds)).toFixed(2), me: st.chainMissEnds, ee: st.chainEnergyEnds, be: st.chainBudgetEnds, goos: st.chainGooseEnds });
  }
  console.log(cfg.name, JSON.stringify(rows));
}
