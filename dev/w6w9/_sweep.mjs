import fs from "node:fs";
import { loadSim, runFrames } from "./jsdom_drive.mjs";

const BASE = fs.readFileSync("_w6w9/sandbox_T1.html", "utf8");
const ANCHOR = "          f.chainLeft -= Math.min(64, Math.pow(1.5, f.chainEats));   // W6: 预算扣费 = 1.5^已吃数";
if (BASE.split(ANCHOR).length - 1 !== 1) throw new Error("anchor missing");
const MODES = {
  "A:1/帧": "          f.chainLeft -= 1;",
  "B:1+0.5n": "          f.chainLeft -= 1 + 0.5 * f.chainEats;",
  "C:1+n": "          f.chainLeft -= 1 + f.chainEats;",
  "D:1+2n": "          f.chainLeft -= 1 + 2 * f.chainEats;",
  "E:2^n": "          f.chainLeft -= Math.min(64, Math.pow(2, f.chainEats));",
  "F:1.3^n": "          f.chainLeft -= Math.min(64, Math.pow(1.3, f.chainEats));",
  "G:1+0.25n": "          f.chainLeft -= 1 + 0.25 * f.chainEats;",
};
const WARM = 1500, FRAMES = 4000;
const out = [];
for (const [name, rep] of Object.entries(MODES)) {
  const file = "_w6w9/_sweep_" + name.replace(/[^A-Za-z0-9]/g, "") + ".html";
  fs.writeFileSync(file, BASE.replace(ANCHOR, rep));
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
    const dEnds = st.dashEnds - d0, de0 = st.dashEatsFalcon0, miss = st.missFalcon - m0;
    const ds0 = SIM.scores[0] - s0;
    rows.push({
      max: st.dashMaxEats, cmax: st.chainMaxEats, trig: st.chainTriggers, relock: st.chainRelock,
      dEnds, mean0: +(de0 / Math.max(1, dEnds)).toFixed(2), meanAll: +(st.dashEatsFalcon0 + st.dashEatsFalcon1) / Math.max(1, dEnds),
      ev: +((ds0 + miss * 4) / Math.max(1, dEnds)).toFixed(2), goos: st.chainGooseEnds, ds0,
    });
  }
  const mx = Math.max(...rows.map(r => r.cmax));
  const mean0 = rows.reduce((a, r) => a + r.mean0, 0) / rows.length;
  const meanAll = rows.reduce((a, r) => a + r.meanAll, 0) / rows.length;
  const ev = rows.reduce((a, r) => a + r.ev, 0) / rows.length;
  const pos = rows.filter(r => r.ds0 > 0).length;
  out.push({ name, max: mx, trig: rows.map(r => r.trig).join("/"), relock: rows.map(r => r.relock).join("/"),
    dEnds: rows.map(r => r.dEnds).join("/"), mean0: +mean0.toFixed(2), meanAll: +meanAll.toFixed(2),
    ev: +ev.toFixed(2), goos: rows.map(r => r.goos).join("/"), pos });
  console.log(JSON.stringify(out[out.length - 1]));
}
