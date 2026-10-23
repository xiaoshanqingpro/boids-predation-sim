/* 抽取 HTML 里的三块 <script>(无 src 的) 到 _w6w9/_blocks/ 并逐块语法检查
 * 用法: node _w6w9/t1_check.mjs [html]
 * 块1/块2 用 vm.Script 编译(与 node --check 等价); 块3(WebGPU) 里若有顶层 await 会编译失败,
 * 那种情况退化为"抽出后交给 node --check 的 .mjs 变体"。
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML = path.resolve(ROOT, process.argv[2] || "掠食竞赛(4).html");
const OUT = path.join(ROOT, "_w6w9", "_blocks");
fs.mkdirSync(OUT, { recursive: true });
const src = fs.readFileSync(HTML, "utf8");
const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
let m, n = 0, ok = 0, fail = 0;
while ((m = re.exec(src))) {
  const attrs = m[1] || "";
  if (/type\s*=\s*["']text\/plain["']/i.test(attrs)) continue;
  n++;
  const body = m[2];
  const f = path.join(OUT, `block${n}.js`);
  fs.writeFileSync(f, body);
  try {
    new vm.Script(body, { filename: f });
    console.log(`块${n}: vm.Script OK  (${body.length} chars, attrs="${attrs.trim()}")`);
    ok++;
  } catch (e) {
    // 顶层 await / 模块语法 -> 用 node --check 的 ESM 形式再试
    const fm = f.replace(/\.js$/, ".mjs");
    fs.writeFileSync(fm, body);
    try {
      execFileSync(process.execPath, ["--check", fm], { stdio: ["ignore", "pipe", "pipe"] });
      console.log(`块${n}: node --check(ESM) OK  (${body.length} chars)`);
      ok++;
    } catch (e2) {
      console.log(`块${n}: FAIL -> ${String(e.message).split("\n")[0]} | ESM: ${String(e2.stderr || e2.message).split("\n").slice(0, 3).join(" / ")}`);
      fail++;
    }
  }
}
console.log(`--- ${path.basename(HTML)}: 共 ${n} 块, 通过 ${ok}, 失败 ${fail}`);
process.exit(fail ? 1 : 0);
