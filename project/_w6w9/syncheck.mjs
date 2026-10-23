/* 三块 <script> 语法自检: 抽出来分别 node --check。
 * 用法: node _w6w9/syncheck.mjs ["掠食竞赛(4).html"] */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
const P = process.argv[2] || "掠食竞赛(4).html";
const html = fs.readFileSync(P, "utf8");
const cut = html.indexOf('<script type="text/plain"');
const head = cut > 0 ? html.slice(0, cut) : html;
const blocks = [...head.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log(`${P}: 可执行 <script> 块 ${blocks.length} 个`);
let fail = 0;
const tmp = path.join(os.tmpdir(), "w6w9_syn");
blocks.forEach((b, i) => {
  const f = tmp + "_" + i + ".js";
  fs.writeFileSync(f, b);
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    console.log(`  块${i + 1}: node --check 通过 (${b.split("\n").length} 行)`);
  } catch (e) {
    fail++;
    console.log(`  块${i + 1}: ✗ 语法错误\n` + String(e.stderr || e.message).split("\n").slice(0, 12).join("\n"));
  }
});
console.log(fail ? `失败 ${fail}` : "全部通过");
process.exit(fail ? 1 : 0);
