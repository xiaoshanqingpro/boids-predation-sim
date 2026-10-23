import fs from "node:fs";
const s = fs.readFileSync("掠食竞赛(4).html", "utf8");
const kind = s.match(/const DEC_KIND = \[[^\]]*\]/)[0];
console.log(kind);
const probes = ["链式再锁定", "能量账单越线", "追猎冲刺: 采样中心", "双隼夹击冲刺", "驱逐竞争者冲刺", "大餐收尾"];
for (const k of probes) {
  const i = s.indexOf('"' + k);
  if (i < 0) { console.log("未找到  <- " + k); continue; }
  const lineStart = s.lastIndexOf("\n", i) + 1;
  const line = s.slice(lineStart, s.indexOf("\n", i));
  console.log(line.trim().slice(0, 120) + "   <- " + k);
}
console.log("SIM.log/logTail:", /logTail/.test(s) ? "存在" : "不存在");
console.log("dashStartsFalcon:", s.includes("dashStartsFalcon") ? "存在" : "不存在");
console.log("dashEndsFalcon0/1:", s.includes("dashEndsFalcon0") ? "存在" : "不存在");
