import fs from "node:fs";
const t = fs.readFileSync("掠食竞赛(4).html", "utf8");
const i = t.indexOf('id="handoffDoc"');
console.log("handoffDoc at char", i, "total", t.length);
console.log("---- tail 1500 ----");
console.log(t.slice(t.length - 1500));
