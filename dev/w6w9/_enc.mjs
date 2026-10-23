import fs from "node:fs";
function report(p) {
  const b = fs.readFileSync(p);
  const s = b.toString("utf8");
  const bad = (s.match(/\uFFFD/g) || []).length;
  // 检测非法 UTF-8: 重新编码回来和原字节比较
  const round = Buffer.from(s, "utf8");
  const same = round.length === b.length && round.equals(b);
  let bom = b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF;
  // GBK 特征: 中文字符区的典型双字节序列
  console.log(p, "bytes=" + b.length, "utf8-roundtrip=" + (same ? "OK" : "BROKEN"), "replacementChars=" + bad, "BOM=" + bom);
  console.log("  head bytes:", b.slice(0, 12).toString("hex"));
  const i = b.indexOf(Buffer.from("掠食竞赛", "utf8"));
  console.log("  '掠食竞赛' as utf8 at:", i);
  const j = b.indexOf(Buffer.from([0xC2, 0xD3, 0xCA, 0xB3]));  // GBK 掠食
  console.log("  GBK-ish 掠食 at:", j);
}
report(process.argv[2]);
