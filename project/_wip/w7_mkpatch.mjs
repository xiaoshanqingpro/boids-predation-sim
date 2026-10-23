/* W7: 由 git 的 0 上下文 diff 自动生成"可复现补丁脚本" _patches/w7_falcon_goose_apply.mjs。
 * 用法: node _wip/w7_mkpatch.mjs <base.html> <final.html> <out.mjs>
 * 生成物只做精确字符串替换, 且要求每个锚点在目标文件里**恰好命中 1 次**才写回(全部命中才落盘)。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const [base, final, out] = process.argv.slice(2);
if (!base || !final || !out) { console.error("用法: node _wip/w7_mkpatch.mjs <base> <final> <out.mjs>"); process.exit(2); }
let diff = "";
try {
  diff = execFileSync("git", ["diff", "--no-index", "--text", "--unified=3", base, final], { encoding: "utf8", stdio: "pipe" });
} catch (e) {
  diff = (e.stdout || "").toString();     // git diff --no-index 有差异时退出码 1
}
const lines = diff.split(/\r?\n/);
const pairs = [];
let oldSide = null, newSide = null;
const flush = () => { if (oldSide && newSide && oldSide.join("\n") !== newSide.join("\n")) pairs.push([oldSide.join("\n"), newSide.join("\n")]); oldSide = null; newSide = null; };
for (const ln of lines) {
  if (ln.startsWith("@@")) { flush(); oldSide = []; newSide = []; continue; }
  if (oldSide === null) continue;
  if (ln.startsWith("---") || ln.startsWith("+++") || ln.startsWith("diff ") || ln.startsWith("index ")) continue;
  if (ln.startsWith("-")) oldSide.push(ln.slice(1));
  else if (ln.startsWith("+")) newSide.push(ln.slice(1));
  else if (ln.startsWith(" ")) { oldSide.push(ln.slice(1)); newSide.push(ln.slice(1)); }
}
flush();
const body = `/* ============================================================================
 * W7 补丁(自动生成, 不要手改): 隼猎雁(方案A) + 更长冲刺 + 冲刺中横向/垂向微调 + 相关账目。
 * 生成命令: node _wip/w7_mkpatch.mjs <base.html> <final.html> _patches/w7_falcon_goose_apply.mjs
 * 用法: node _patches/w7_falcon_goose_apply.mjs [目标html=掠食竞赛.html] [--dry]
 * 规则: ${pairs.length} 个锚点**全部恰好命中 1 次**才写回; 任一锚点命中数 != 1 就整体中止(不写文件)。
 * ========================================================================== */
import fs from "node:fs";
const TARGET = process.argv[2] && process.argv[2].endsWith(".html") ? process.argv[2] : "掠食竞赛.html";
const DRY = process.argv.includes("--dry");
const EDITS = ${JSON.stringify(pairs, null, 1)};
let t = fs.readFileSync(TARGET, "utf8");
const before = t;
let applied = 0, skipped = 0;
for (let i = 0; i < EDITS.length; i++) {
  const [find, repl] = EDITS[i];
  if (repl && t.includes(repl) && !t.includes(find)) { skipped++; continue; }   // 已经应用过
  const n = find === "" ? (t.startsWith("\\n") ? 1 : 0) : t.split(find).length - 1;
  if (n !== 1) { console.error(\`锚点 #\${i + 1} 命中 \${n} 次(要求 1) -> 中止, 未写回\n--- find ---\n\` + find.slice(0, 200)); process.exit(3); }
  t = t.replace(find, repl);
  applied++;
}
if (t === before) { console.log("无需改动(补丁已应用) " + TARGET); process.exit(0); }
if (DRY) { console.log(\`[dry] \${applied} 处替换, \${skipped} 处已应用, 未写回\`); process.exit(0); }
fs.writeFileSync(TARGET, t, "utf8");
console.log(\`补丁已应用: \${TARGET} 替换 \${applied} 处(跳过已应用 \${skipped} 处)\`);
`;
fs.writeFileSync(out, body, "utf8");
console.log(`生成 ${out}: ${pairs.length} 个锚点, ${body.length} 字节`);
