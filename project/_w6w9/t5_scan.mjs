import fs from "node:fs";
const lines = fs.readFileSync(process.argv[2] || "掠食竞赛_2D.html", "utf8").split("\n");
const pat = new RegExp(process.argv[3]);
const skip = process.argv[4] ? new RegExp(process.argv[4]) : null;
let n = 0;
lines.forEach((l, i) => {
  if (pat.test(l) && !(skip && skip.test(l))) { console.log(String(i + 1).padStart(5) + " " + l); n++; }
});
console.log("命中 " + n + " 行");
