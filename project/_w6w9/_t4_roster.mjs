import { loadSim } from "./jsdom_drive.mjs";
const { SIM } = await loadSim("掠食竞赛(4).html", "");
console.log("raptorCount=", JSON.stringify(SIM.raptorCount));
console.log("ghunterInfo=", JSON.stringify(SIM.ghunterInfo));
const n = SIM.raptorCount ? SIM.raptorCount.total : 3;
for (let k = 0; k < n; k++) {
  const h = SIM.hunter(k), d = SIM.hunterDetail ? SIM.hunterDetail(k) : null;
  console.log(`k=${k} hunter.kind=${h && h.kind} detail.kind=${d && d.kind} detail.stall=${d && d.stall} detail.attack=${d && d.attack}`);
}
console.log("hooks: addGhunter=", typeof SIM.addGhunter, "setBandit=", typeof SIM.setBandit);
console.log("stats ghunter:", Object.keys(SIM.stats||{}).filter(k=>/ghunter/i.test(k)).join(","));
process.exit(0);

