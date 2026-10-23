import fs from "node:fs";
function fn(file, name) {
  const t = fs.readFileSync(file, "utf8");
  const i = t.indexOf("function " + name + "(");
  if (i < 0) return "(找不到)";
  // 取到下一个顶层 function/结束
  const rest = t.slice(i);
  const end = rest.search(/\n(function |\/\* -{5,})/);
  return rest.slice(0, end < 0 ? 1200 : end);
}
for (const nm of ["initStarlings"]) {
  const a = fn("_archive/round7.html", nm).split("\n").map(l=>l.trim());
  const b = fn("_archive/v3d.html", nm).split("\n").map(l=>l.trim());
  const sb = new Set(b);
  console.log(`=== ${nm}: 只在第7轮 ===`);
  a.filter(l=>l && !sb.has(l)).forEach(l=>console.log("  - " + l.slice(0,120)));
  const sa = new Set(a);
  console.log(`=== ${nm}: 只在三维版 ===`);
  b.filter(l=>l && !sa.has(l)).forEach(l=>console.log("  + " + l.slice(0,120)));
}
