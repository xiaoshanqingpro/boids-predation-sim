/* 验收 §5.1: 三个 <script> 块逐个 node --check。
 * 注意: 交接说明正文里也会出现 "<script>" 字样, 所以先切掉承载说明的 text/plain 容器再扫描。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
let t = fs.readFileSync("掠食竞赛.html", "utf8");
const cut = t.indexOf('<script type="text/plain"');
if (cut > 0) t = t.slice(0, cut);
const blocks = [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let bad = 0;
blocks.forEach((b, i) => {
  const f = `_archive/_blk${i + 1}.js`;
  fs.writeFileSync(f, b, "utf8");
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    console.log(`  块${i + 1}: node --check 通过 (${b.split("\n").length} 行)`);
  } catch (e) {
    bad++;
    console.log(`  块${i + 1}: ✗ 语法错误\n${String(e.stderr || e.message).slice(0, 300)}`);
  }
});
console.log(`块数=${blocks.length} 失败=${bad}`);
process.exit(bad ? 1 : 0);
