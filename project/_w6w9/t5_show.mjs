import fs from "node:fs";
const lines = fs.readFileSync(process.argv[2] || "掠食竞赛(4).html", "utf8").split("\n");
const re = new RegExp(process.argv[3] || "GRAV_ON");
const before = Number(process.argv[4] || 0), after = Number(process.argv[5] || 0);
const hits = [];
lines.forEach((l, i) => { if (re.test(l)) hits.push(i); });
hits.forEach(i => {
  for (let k = Math.max(0, i - before); k <= Math.min(lines.length - 1, i + after); k++) {
    console.log(String(k + 1).padStart(5) + (k === i ? " |" : "  ") + lines[k]);
  }
  console.log("   ---");
});
console.log("命中行数 " + hits.length);
