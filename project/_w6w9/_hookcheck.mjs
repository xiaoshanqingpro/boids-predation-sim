import { loadSim } from "./jsdom_drive.mjs";
const { SIM } = await loadSim("掠食竞赛(4).html", "?grav=0");
console.log("t1bConst =", JSON.stringify(SIM.t1bConst));
console.log("esConst  =", JSON.stringify(SIM.esConst));
console.log("t1bInfo  =", JSON.stringify(SIM.t1bInfo));
console.log("契约 =", JSON.stringify(SIM.scores), JSON.stringify(SIM.kills), JSON.stringify(SIM.raptorCount));
console.log("stats 新计数 =", JSON.stringify({ shepherdFrames: SIM.stats.shepherdFrames, sharedPcUses: SIM.stats.sharedPcUses, eventDoubles: SIM.stats.eventDoubles, evtBiasDashes: SIM.stats.evtBiasDashes, falconClashes: SIM.stats.falconClashes, falconSteals: SIM.stats.falconSteals, falconAvoided: SIM.stats.falconAvoided }));

