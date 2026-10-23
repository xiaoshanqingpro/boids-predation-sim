import fs from "node:fs";
import { loadSim, runFrames } from "./jsdom_drive.mjs";

const BASE = fs.readFileSync("_w6w9/sandbox_T1.html", "utf8");
const ANCHOR = "          f.chainLeft -= Math.min(64, Math.pow(1.5, f.chainEats));   // W6: 预算扣费 = 1.5^已吃数";
if (BASE.split(ANCHOR).length - 1 !== 1) throw new Error("cost anchor missing");
const MISA = "const F_CHAIN_MISS = 12;";
if (BASE.split(MISA).length - 1 !== 1) throw new Error("miss anchor missing");

const COSTS = {
  "1": "          f.chainLeft -= 1;",
  "1+0.25n": "          f.chainLeft -= 1 + 0.25 * f.chainEats;",
  "1+0.5n": "          f.chainLeft -= 1 + 0.5 * f.chainEats;",
  "1+1n": "          f.chainLeft -= 1 + f.chainEats;",
  "1.25^n": "          f.chainLeft -= Math.min(64, Math.pow(1.25, f.chainEats));",
};
const MIS = [8, 12, 20];
const WARM = 1500, FRAMES = 4000;
const results = [];
for (const [cname, rep] of Object.entries(COSTS)) {
  for (const mis of MIS) {
    const file = "_w6w9/_sw.html";
    fs.writeFileSync(file, BASE.replace(ANCHOR, rep).replace(MISA, "const F_CHAIN_MISS = " + mis + ";"));
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
      rows.push({
        cmax: st.chainMaxEats, dmax: st.dashMaxEats, dEnds,
        mean0: +(st.dashEatsFalcon0 / Math.max(1, dEnds)).toFixed(2),
        ev: +(((SIM.scores[0] - s0) + (st.missFalcon - m0) * 4) / Math.max(1, dEnds)).toFixed(2),
        goos: st.chainGooseEnds, ds0: SIM.scores[0] - s0,
        ee: st.chainEnergyEnds, me: st.chainMissEnds, be: st.chainBudgetEnds,
      });
    }
    const o = {
      cost: cname, miss: mis,
      cmax: Math.max(...rows.map(r => r.cmax)),
      dmax: Math.max(...rows.map(r => r.dmax)),
      mean0: +(rows.reduce((a, r) => a + r.mean0, 0) / 4).toFixed(2),
      ev: +(rows.reduce((a, r) => a + r.ev, 0) / 4).toFixed(2),
      goos: rows.map(r => r.goos).join("/"),
      pos: rows.filter(r => r.ds0 > 0).length,
      dEnds: rows.map(r => r.dEnds).join("/"),
      endKind: "E" + rows.map(r => r.ee).join("/") + " M" + rows.map(r => r.me).join("/") + " B" + rows.map(r => r.be).join("/"),
    };
    o.pass = (o.cmax >= 2 && o.cmax <= 8) && o.mean0 >= 2 && o.ev >= 1.5 && o.pos >= 3 ? "PASS" : "fail";
    results.push(o);
    console.log(JSON.stringify(o));
  }
}
console.log("\n=== PASS 组合 ===");
for (const r of results.filter(r => r.pass === "PASS")) console.log(JSON.stringify(r));
