import { loadSim, physicsHash, runFrames } from "./jsdom_drive.mjs";
const { SIM, sha256 } = await loadSim("掠食竞赛(4).html", "?grav=0");
console.log("sha256:", sha256.slice(0,16), " N=", SIM.N, " M=", SIM.M);
runFrames(SIM, 600);
console.log("600 帧后: 存活", SIM.aliveCount, "总捕获", SIM.kills.reduce((a,b)=>a+b,0), "物理哈希", physicsHash(SIM));
console.log("已有钩子: dashMaxEats=", SIM.stats.dashMaxEats, " lockedDashes=", SIM.stats.lockedDashes, " ghunterStallFrames=", SIM.stats.ghunterStallFrames);

