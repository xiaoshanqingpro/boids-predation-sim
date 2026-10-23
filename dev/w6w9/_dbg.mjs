import fs from "node:fs";
const src = fs.readFileSync("_w6w9/sandbox_T1.html", "utf8");
const targets = [
  `    for (const f of falcons) { f.score = 0; f.kills = 0; f.dashEats = 0; }`,
  `  for (const f of falcons) { f.score = 0; f.kills = 0; f.dashEats = 0; }`,
  `for (const f of falcons) { f.score = 0; f.kills = 0; f.dashEats = 0; }`,
  `f.score = 0; f.kills = 0; f.dashEats = 0;`,
];
for (const t of targets) console.log(JSON.stringify(t.slice(0, 30)), src.split(t).length - 1);
const i = src.indexOf("f.score = 0; f.kills = 0; f.dashEats = 0;");
console.log("context:", JSON.stringify(src.slice(i - 60, i + 120)));
