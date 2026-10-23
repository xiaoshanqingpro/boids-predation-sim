/* W7/T2 施工工具: 写互斥锁 + 三块 <script> 语法自检
 * 用法:
 *   node _w6w9/t2_tool.mjs lock     # 创建 _w6w9/main.lock(占用则 2s 重试, mtime>10min 可抢占)
 *   node _w6w9/t2_tool.mjs unlock   # 释放
 *   node _w6w9/t2_tool.mjs check [file]   # 语法自检(默认 掠食竞赛(4).html)
 *   node _w6w9/t2_tool.mjs whoami   # 看锁状态
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const lockPath = path.join(here, "main.lock");
const cmd = process.argv[2] || "whoami";
const TARGET = process.argv[3] || path.join(root, "掠食竞赛(4).html");

const sleep = ms => { const t = Date.now() + ms; while (Date.now() < t) { /* busy */ } };

function lock() {
  for (let i = 0; i < 300; i++) {
    try {
      fs.writeFileSync(lockPath, String(Date.now()), { flag: "wx" });
      console.log("lock acquired: " + lockPath);
      return 0;
    } catch (e) {
      let age = Infinity;
      try { age = Date.now() - fs.statSync(lockPath).mtimeMs; } catch (e2) { /* 竞态: 刚被删 */ }
      if (age > 10 * 60 * 1000) {                       // 超过 10 分钟 -> 抢占
        console.log("lock stale (" + Math.round(age / 1000) + "s), 抢占");
        try { fs.unlinkSync(lockPath); } catch (e2) { /* 忽略 */ }
        continue;
      }
      if (i % 5 === 0) console.log("lock busy (age " + Math.round(age / 1000) + "s), retry...");
      sleep(2000);
    }
  }
  console.error("✗ lock 重试超时");
  return 1;
}
function unlock() {
  try { fs.unlinkSync(lockPath); console.log("lock released"); } catch (e) { console.log("no lock"); }
  return 0;
}
function check() {
  let t = fs.readFileSync(TARGET, "utf8");
  const cut = t.indexOf('<script type="text/plain"');
  if (cut > 0) t = t.slice(0, cut);
  const blocks = [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  let bad = 0;
  blocks.forEach((b, i) => {
    const f = path.join(here, "_blk" + (i + 1) + ".js");
    fs.writeFileSync(f, b, "utf8");
    try {
      execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
      console.log(`  块${i + 1}: node --check 通过 (${b.split("\n").length} 行)`);
    } catch (e) {
      bad++;
      console.log(`  块${i + 1}: ✗ 语法错误\n${String(e.stderr || e.message).slice(0, 500)}`);
    }
  });
  console.log(`块数=${blocks.length} 失败=${bad}  (${path.basename(TARGET)})`);
  return bad ? 1 : 0;
}
if (cmd === "lock") process.exit(lock());
else if (cmd === "unlock") process.exit(unlock());
else if (cmd === "check") process.exit(check());
else {
  let st = "free";
  try { st = "held since " + fs.statSync(lockPath).mtime.toISOString(); } catch (e) { /* free */ }
  console.log("lock: " + st);
  process.exit(0);
}
