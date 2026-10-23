/* 临时检查: WGSL 模板串是否插值成功 / 新绑定与上行是否就位 */
import fs from "node:fs";
const t = fs.readFileSync("掠食竞赛.html", "utf8");
const i = t.indexOf("const WGSL = `"), j = t.indexOf("`;", i);
const w = t.slice(i, j);
const dollar = w.split("${").length - 1;
console.log("WGSL 里残留的 ${ : " + dollar);
const k = w.indexOf("W2 惊飞波传染");
console.log(w.slice(k - 80, k + 850));
console.log("--- 出现次数 ---");
for (const b of ["binding(7)", "binding(8)", "bufWAL", "bufWTN", "s.WAL", "s.WTN", "W2_RELAY"]) console.log(b + ": " + (t.split(b).length - 1));
