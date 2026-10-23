import fs from "node:fs";
import { loadSim, runFrames } from "./jsdom_drive.mjs";

let src = fs.readFileSync("_w6w9/sandbox_T1.html", "utf8");
// 1) 每次隼①在冲刺中吃到椋鸟时记账
const eatA = `        if (f.dashT > 0) { f.dashEats++; f.dashS++; }   // A: 吃到东西 / P1 验收只数椋鸟`;
if (src.split(eatA).length - 1 !== 1) throw new Error("eat anchor");
src = src.replace(eatA, eatA + `\n        if (f.kind === "falcon") { globalThis.__EATN = (globalThis.__EATN|0) + 1; globalThis.__EATINFO = { frame, i, dashEats: f.dashEats, chainEats: f.chainEats, dT: f.dashT }; }`);
// 2) 逐帧记录隼①的完整状态
const fA = `    f.x = wrapX(f.x + f.vx);
    f.y = wrapY(f.y + f.vy);`;
if (src.split(fA).length - 1 !== 1) throw new Error("falcon end anchor");
// 续期扣费行加计数
const extA = "          f.dashT += 1;\n          f.chainLeft -= Math.min(64, Math.pow(1.5, f.chainEats));   // W6: 预算扣费 = 1.5^已吃数";
if (src.split(extA).length - 1 !== 1) throw new Error("ext anchor");
src = src.replace(extA, "          globalThis.__PRE = f.chainLeft;\n          f.dashT += 1;\n          globalThis.__EXT = (globalThis.__EXT|0) + 1; globalThis.__EXTFIRST = globalThis.__EXTFIRST || { frame, eats: f.chainEats, left: f.chainLeft, pre: globalThis.__PRE };\n          f.chainLeft -= Math.min(64, Math.pow(1.5, f.chainEats));   // W6: 预算扣费 = 1.5^已吃数\n          globalThis.__POST = f.chainLeft;");
src = src.replace(fA, `    if (fi === 0) { const _t = globalThis.__T0 = globalThis.__T0 || []; if (_t.length < 2000) _t.push([frame, f.dashT, f.dashEats, f.chainEats, +f.chainLeft.toFixed(1), +f.energy.toFixed(1), f.lockIdx, f.chainS]); }
` + fA);
fs.writeFileSync("_w6w9/_tr2.html", src);

const { SIM, win } = await loadSim("_w6w9/_tr2.html", "?grav=0");
let s = 2654435761 >>> 0;
win.Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
SIM.resetFlocks(); SIM.resetPredators();
for (const k in SIM.stats) if (typeof SIM.stats[k] === "number") SIM.stats[k] = 0;
runFrames(SIM, 1500);
runFrames(SIM, 900);
const T = (win.__T0 || []);
// 只打印"吃到事件"前后 6 帧
const idx = [];
for (let i = 0; i < T.length; i++) if (T[i][2] !== (T[i - 1] ? T[i - 1][2] : 0)) idx.push(i);
const show = new Set();
for (const i of idx.slice(0, 5)) for (let k = Math.max(0, i - 3); k <= i + 6; k++) show.add(k);
console.log("冲刺帧样本", T.length, " 吃到事件", win.__EATN, " 事件帧号", idx.slice(0, 8).map(i => T[i][0]).join(","));
console.log("frame dT dashEats chainEats left energy lock chainS");
console.log([...show].sort((a, b) => a - b).map(i => T[i].join(" ")).join("\n"));
console.log("最后一个吃到事件之后 20 帧:");
const last = idx[idx.length - 1];
console.log(T.slice(Math.max(0, last - 4), last + 20).map(r => r.join(" ")).join("\n"));
console.log("chainMax", SIM.stats.chainMaxEats, "trig", SIM.stats.chainTriggers, "enEnds", SIM.stats.chainEnergyEnds, "goos", SIM.stats.chainGooseEnds);
console.log("__EXT 续期次数", win.__EXT, " __EXTFIRST", JSON.stringify(win.__EXTFIRST));
