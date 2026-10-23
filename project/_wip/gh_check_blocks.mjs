/* W4 雁隼: 三个 <script> 块逐个 node --check(自己的一份, 不写 _archive/, 只写 _wip/_ghblk*.js)
 * 用法: node _wip/gh_check_blocks.mjs [路径]  (默认 _wip/掠食竞赛-goosehunter.html) */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? path.join(here, "掠食竞赛-goosehunter.html");
let t = fs.readFileSync(file, "utf8");
const cut = t.indexOf('<script type="text/plain"');
if (cut > 0) t = t.slice(0, cut);
const blocks = [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let bad = 0;
blocks.forEach((b, i) => {
  const f = path.join(here, `_ghblk${i + 1}.js`);
  fs.writeFileSync(f, b, "utf8");
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    console.log(`  块${i + 1}: node --check 通过 (${b.split("\n").length} 行)`);
  } catch (e) {
    bad++;
    console.log(`  块${i + 1}: ✗ 语法错误\n${String(e.stderr || e.message).slice(0, 400)}`);
  }
});
console.log(`块数=${blocks.length} 失败=${bad}`);
process.exit(bad ? 1 : 0);
