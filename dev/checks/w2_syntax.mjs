/* W2 附助: 对任意 html 跑"三块 node --check"(用于检查离线调参生成出来的变体副本)。
 * 主文件的正式回归仍用 _checks/syncheck3d.mjs。用法: node _checks/w2_syntax.mjs <html...> */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
let badAll = 0;
for (const f of process.argv.slice(2)) {
  let t = fs.readFileSync(f, "utf8");
  const cut = t.indexOf('<script type="text/plain"');
  if (cut > 0) t = t.slice(0, cut);
  const blocks = [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  let bad = 0;
  blocks.forEach((b, i) => {
    const tmp = `_wip/_syn_${i + 1}.js`;
    fs.writeFileSync(tmp, b, "utf8");
    try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); }
    catch (e) { bad++; console.log(`  ${f} 块${i + 1}: ✗ ${String(e.stderr || e.message).slice(0, 200)}`); }
  });
  badAll += bad;
  console.log(`${f}: 块数=${blocks.length} 失败=${bad}`);
}
process.exit(badAll ? 1 : 0);
