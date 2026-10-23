/* 用户要求: 加强所有猛禽冲刺时的拖尾(2D 版) —— 速度 streak, 按行插入(自动沿用缩进) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// 脚本在 dev/w6w9/ 下，上溯两级即仓库根（原来写死本机桌面副本目录）。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const P = path.join(ROOT, "掠食竞赛_2D.html");
const lines = fs.readFileSync(P, "utf8").split("\n");

// ① 找 drawHunter 里那行"三维拖尾折线已删除"注释
const target = lines.findIndex(l => l.includes("三维拖尾折线已删除"));
if (target < 0) { console.error("✗ 未找到拖尾注释行"); process.exit(1); }
const ind = (lines[target].match(/^\s*/) || [""])[0];
const body = [
  "/* 【用户要求: 加强猛禽冲刺拖尾】速度 streak —— 平面版自算, 不依赖已删的 trailBuf。",
  " * 沿速度反方向拉一条\"由粗到细、由亮到暗\"的三段带; 冲刺中(dash)长度×2.5、宽度×2.1、透明度×3.9,",
  " * 并额外叠一层辉光, 所有猛禽(隼/鹰/雁隼)共用同一套。参数见 RAPTOR_TRAIL_* 常量。 */",
  "{",
  "  const vx = h.vx || 0, vy = h.vy || 0;",
  "  const sp = Math.hypot(vx, vy);",
  "  if (sp > 0.05) {",
  "    const len = Math.min(RAPTOR_TRAIL_MAX * ss, sp * (dash ? RAPTOR_TRAIL_LEN_DASH : RAPTOR_TRAIL_LEN) * ss);",
  "    const wid = (dash ? RAPTOR_TRAIL_W_DASH : RAPTOR_TRAIL_W) * ss;",
  "    const nx = vx / sp, ny = vy / sp;",
  "    const a0 = (dash ? RAPTOR_TRAIL_A_DASH : RAPTOR_TRAIL_A) * ff;",
  "    ctx.save(); ctx.lineCap = \"round\";",
  "    for (let seg = 0; seg < 3; seg++) {",
  "      const f0 = seg / 3, f1 = (seg + 1) / 3;",
  "      ctx.strokeStyle = \"rgba(\" + C + \",\" + (a0 * (1 - f0 * 0.8)).toFixed(3) + \")\";",
  "      ctx.lineWidth = Math.max(0.6, wid * (1 - f0 * 0.65));",
  "      ctx.beginPath();",
  "      ctx.moveTo(sx - nx * len * f0, sy - ny * len * f0);",
  "      ctx.lineTo(sx - nx * len * f1, sy - ny * len * f1);",
  "      ctx.stroke();",
  "    }",
  "    if (dash) {                                  // 冲刺中: 额外一层辉光",
  "      ctx.shadowColor = \"rgb(\" + C + \")\"; ctx.shadowBlur = 18;",
  "      ctx.strokeStyle = \"rgba(\" + C + \",\" + (a0 * 0.5).toFixed(3) + \")\";",
  "      ctx.lineWidth = wid * 0.8;",
  "      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - nx * len, sy - ny * len); ctx.stroke();",
  "      ctx.shadowBlur = 0;",
  "    }",
  "    ctx.restore();",
  "  }",
  "}",
].map(s => ind + s);
lines.splice(target + 1, 0, ...body);

// ② 常量插到 `const GH_VIEW = ` 之前
const ci = lines.findIndex(l => l.includes("const GH_VIEW = "));
if (ci < 0) { console.error("✗ 未找到 GH_VIEW 常量行"); process.exit(1); }
const cInd = (lines[ci].match(/^\s*/) || [""])[0];
const consts = [
  "/* 【用户要求: 猛禽冲刺拖尾】速度 streak 参数(平面版; 冲刺/巡航两档) */",
  "const RAPTOR_TRAIL_LEN = 6;        // 巡航: 长度 = 速度 × 该系数",
  "const RAPTOR_TRAIL_LEN_DASH = 15;  // 冲刺: 比巡航长 2.5 倍",
  "const RAPTOR_TRAIL_W = 2.0;        // 巡航线宽(px, 乘屏幕缩放)",
  "const RAPTOR_TRAIL_W_DASH = 4.2;   // 冲刺线宽",
  "const RAPTOR_TRAIL_A = 0.16;       // 巡航头部透明度",
  "const RAPTOR_TRAIL_A_DASH = 0.62;  // 冲刺头部透明度(≈巡航 3.9 倍)",
  "const RAPTOR_TRAIL_MAX = 240;      // 屏幕长度上限(px)",
].map(s => cInd + s);
lines.splice(ci, 0, ...consts);

fs.writeFileSync(P, lines.join("\n"));
console.log("已插入: 拖尾代码 " + body.length + " 行(在 L" + (target + 2) + " 起) + 常量 " + consts.length + " 行(在 L" + (ci + 1) + " 起)");
console.log("文件大小 " + fs.statSync(P).size + " 字节");
