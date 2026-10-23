import { loadSim, runFrames } from "./jsdom_drive.mjs";
const path = process.argv[2] || "_w6w9/dbg6.html";
const { SIM, win } = await loadSim(path, "?grav=0");
console.log("__D2:", JSON.stringify(win.__D2));
runFrames(SIM, 5);
console.log("after 5 frames __D2:", JSON.stringify(win.__D2));
console.log("PVV via falconPolicies p6:", SIM.falconPolicies.map(f => f.normalized[5]));
