/* T5 盘点: (4) 里所有 3D/z 相关锚点出现次数 */
import fs from "node:fs";
const t = fs.readFileSync(process.argv[2] || "掠食竞赛(4).html", "utf8");
const lines = t.split("\n");
const pats = ["GRAV_ON", "VIEW3D", "Z\\[", "VZ\\[", "Z2\\[", "VZ2\\[", "ZT\\[", "Z_INIT", "trail3", "TRAIL3",
  "renderSoft3D", "draw3D", "toggleView", "updateCamera", "inCone3", "EAT_3D", "spawnCorpse", "stepCorpses",
  "CORPSE", "stoopT", "targetZ", "\\.vz", "vz:", "gl3d", "btnView", "cam\\.", "Z_CEIL", "Z_SPREAD",
  "GOOSE_LAYER", "GROUND_MARGIN", "DIVE_BOOST", "CLIMB_RATE", "DIVE_RATE", "FLOOR_Z", "ALT_", "Z2", "SIZE3D", "toggleView"];
const seen = new Set();
const rows = [];
for (const p of pats) {
  if (seen.has(p)) continue; seen.add(p);
  const re = new RegExp(p, "g");
  let c = 0, nl = 0;
  for (const l of lines) { const m = l.match(re); if (m) { c += m.length; nl++; } }
  rows.push([p, c, nl]);
}
rows.sort((a, b) => b[1] - a[1]);
console.log("总行数", lines.length, "总字符", t.length);
for (const [p, c, nl] of rows) console.log(String(c).padStart(5), String(nl).padStart(4), p);
