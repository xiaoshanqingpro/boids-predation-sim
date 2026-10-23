/* T5 修复: 清掉 gl3dReady 残留引用(真机默认路径 ReferenceError 的根因)
 * 只改 掠食竞赛_2D.html。用法: node _w6w9/t5_fix_gl3dref.mjs [--apply] */
import fs from "node:fs";
const P = "掠食竞赛_2D.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const A = '  gl3dReady = glReady && !!(B.has3D && B.has3D());   // 第 8 轮: 3D 管线随 2D 一起初始化\n';
const B2 = '  /* 【W9 2D】原来这里还要置 gl3dReady(3D 就绪); 三维管线已整体删除 —— 这行若留着,\n' +
           '   * 默认(GL 2D)路径会在严格模式下抛 ReferenceError: gl3dReady is not defined。 */\n';
const n = t.split(A).length - 1;
console.log(`${n === 1 ? "✓" : "✗"} 命中 ${n} 次`);
if (!APPLY) { process.exit(n === 1 ? 0 : 1); }
if (n !== 1) { console.log("不写回"); process.exit(1); }
fs.writeFileSync(P, t.split(A).join(B2));
console.log("gl3dReady 残留已清除");
