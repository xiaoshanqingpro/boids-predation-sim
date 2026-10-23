/* 收尾: 把 active 暴露到 harrierInfo.list(验收要看"在编"而不是只看存活) */
import fs from "node:fs";
const P = "掠食竞赛_2D.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const A = '             list: harriers.map(h => ({ id: h.slot, x: h.x, y: h.y, z: 0, dead: h.dead,\n' +
          '                                        recover: h.recover, dives: h.dives })) };';
const B = '             list: harriers.map(h => ({ id: h.slot, x: h.x, y: h.y, z: 0, dead: h.dead,\n' +
          '                                        active: h.active, recover: h.recover, dives: h.dives })) };';
const n = t.split(A).length - 1;
console.log(`${n === 1 ? "✓" : "✗"} 命中 ${n} 次`);
if (!APPLY) { process.exit(n === 1 ? 0 : 1); }
if (n !== 1) { process.exit(1); }
fs.writeFileSync(P, t.split(A).join(B));
console.log("harrierInfo.list 已加 active");
