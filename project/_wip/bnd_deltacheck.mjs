/* 校验: 当前主文件 = 我接手时的快照(_wip/bnd_pre.html) + 仅 task-6 的 18 处替换。
 * 做法: 对 bnd_pre.html 施加与两个补丁脚本完全相同的替换, 与当前文件逐字节比较。
 * 若字节相同 -> 期间没有其他写者动过主文件, 我的 A/B 与哈希链是干净的。 */
import fs from "node:fs";
const A = fs.readFileSync("_wip/bnd_pre.html", "utf8");
const B = fs.readFileSync("掠食竞赛.html", "utf8");
// 只做"反向"检查: 当前文件里必须含全部新串, 快照里必须不含; 且把快照的旧串换成新串后应与当前文件一致。
const v2 = fs.readFileSync("_patches/w1b_boundary_v2.mjs", "utf8");
const v3 = fs.readFileSync("_patches/w1b_boundary_v3.mjs", "utf8");
// 从脚本里提取 must(a, b) 的字符串字面量: 直接用 import 执行太危险, 改为正则收集 "..." 拼接串
// 简化: 直接比较行集合差异, 并统计差异块。
const la = A.split("\n"), lb = B.split("\n");
const setB = new Set(lb);
const removed = la.filter(l => !setB.has(l));
const setA = new Set(la);
const added = lb.filter(l => !setA.has(l));
console.log(`快照 ${la.length} 行 -> 当前 ${lb.length} 行 (${lb.length - la.length >= 0 ? "+" : ""}${lb.length - la.length})`);
console.log(`仅快照有的行 ${removed.length}, 仅当前有的行 ${added.length}`);
console.log("--- 仅快照有的行 ---");
removed.forEach(l => console.log("  - " + l.slice(0, 110)));
console.log("--- 仅当前有的行 ---");
added.forEach(l => console.log("  + " + l.slice(0, 110)));
