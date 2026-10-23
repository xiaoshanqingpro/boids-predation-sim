/* 用户要求: 删掉标签里的英文名(太碍事) —— 隼① FALCON / 鹰① EAGLE / 雁隼① GHUNTER / 雁 GEESE ×60 */
import fs from "node:fs";
const P = "掠食竞赛.html";
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const reps = [];
const add = (a, b) => reps.push([a, b]);

// 1) 重新编号(relabel): 去掉英文
add('  falcons.forEach((f, i) => f.label = "隼" + (CN_NUM[i] || ("#" + (i + 1))) + " FALCON" + (i > 0 ? "-" + (i + 1) : ""));',
    '  falcons.forEach((f, i) => f.label = "隼" + (CN_NUM[i] || ("#" + (i + 1))));   // 用户要求: 标签只留中文');
add('  eagles.forEach((E, i) => E.label = "鹰" + (CN_NUM[i] || ("#" + (i + 1))) + " EAGLE" + (i > 0 ? "-" + (i + 1) : ""));',
    '  eagles.forEach((E, i) => E.label = "鹰" + (CN_NUM[i] || ("#" + (i + 1))));');
add('  ghunters.forEach((g, i) => g.label = "雁隼" + (CN_NUM[i] || ("#" + (i + 1))) + " GHUNTER" + (i > 0 ? "-" + (i + 1) : ""));   // W4',
    '  ghunters.forEach((g, i) => g.label = "雁隼" + (CN_NUM[i] || ("#" + (i + 1))));   // W4');
// 2) 工厂默认名
add('color: "255,190,60", label: label || "鹰 EAGLE",', 'color: "255,190,60", label: label || "鹰",');
add('color: GH_COLOR, label: label || "雁隼 GHUNTER",', 'color: GH_COLOR, label: label || "雁隼",');
// 3) 增援/重置路径里的名字
add('r2 = makeEagle(x, y, "鹰" + (CN_NUM[k] || ("#" + (k + 1))) + " EAGLE");',
    'r2 = makeEagle(x, y, "鹰" + (CN_NUM[k] || ("#" + (k + 1))));');
add('r2 = makeGooseHunter(x, y, "雁隼" + (CN_NUM[k] || ("#" + (k + 1))) + " GHUNTER");',
    'r2 = makeGooseHunter(x, y, "雁隼" + (CN_NUM[k] || ("#" + (k + 1))));');
add('"隼" + (CN_NUM[k] || ("#" + (k + 1))) + " FALCON",', '"隼" + (CN_NUM[k] || ("#" + (k + 1))),');
add('"隼" + (CN_NUM[k] || ("#" + (k + 1))) + " FALCON" + (k > 0 ? "-" + (k + 1) : ""),',
    '"隼" + (CN_NUM[k] || ("#" + (k + 1))),');
// 4) 画面上的"雁 GEESE ×60" -> "雁群 ×60"
add('ctx.fillText("雁 GEESE ×" + galiveCount, PR_A.x + 12, PR_A.y - 10);',
    'ctx.fillText("雁群 ×" + galiveCount, PR_A.x + 12, PR_A.y - 10);');

let ok = 0;
for (const [a, b] of reps) { if (t.includes(a)) { t = t.split(a).join(b); ok++; } else console.log("✗ 未命中: " + a.slice(0, 70)); }
if (ok !== reps.length) { console.log(`只命中 ${ok}/${reps.length}, 不写回`); process.exit(1); }
fs.writeFileSync(P, t);
console.log(`标签去英文: ${ok}/${reps.length} 处已改`);
