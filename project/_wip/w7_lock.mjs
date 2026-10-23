/* W7 主文件写互斥(main.lock 协议): 每批编辑前 acquire, syncheck 通过后 release。
 * 用法: node _wip/w7_lock.mjs acquire|release|status [mainfile]
 * 规则: fs.writeFileSync(p, Date.now(), {flag:"wx"}); 占用则 2s 重试; mtime > 10 分钟视为陈旧可抢占。 */
import fs from "node:fs";
import path from "node:path";
const cmd = process.argv[2] || "status";
const lock = process.argv[3] || "_wip/main.lock";
const STALE = 10 * 60 * 1000;
function status() {
  try {
    const st = fs.statSync(lock);
    const age = Date.now() - st.mtimeMs;
    return { exists: true, ageMs: Math.round(age), stale: age > STALE, content: fs.readFileSync(lock, "utf8").trim() };
  } catch (e) { return { exists: false }; }
}
if (cmd === "status") { console.log(JSON.stringify(status())); process.exit(0); }
if (cmd === "release") {
  if (status().exists) fs.unlinkSync(lock);
  console.log("released " + lock);
  process.exit(0);
}
if (cmd === "acquire") {
  for (let attempt = 1; attempt <= 40; attempt++) {
    try {
      fs.writeFileSync(lock, String(Date.now()), { flag: "wx" });
      console.log("acquired " + lock + " (attempt " + attempt + ")");
      process.exit(0);
    } catch (e) {
      const st = status();
      if (st.exists && st.stale) {
        console.log("stale lock (age " + st.ageMs + "ms) -> takeover");
        try { fs.unlinkSync(lock); } catch (e2) { /* ignore */ }
        continue;
      }
      if (attempt % 5 === 0) console.log("busy (attempt " + attempt + ") " + JSON.stringify(st));
      const t0 = Date.now(); while (Date.now() - t0 < 2000) { /* 2s 重试 */ }
    }
  }
  console.error("acquire failed: " + lock + " 仍被占用");
  process.exit(3);
}
console.error("用法: node _wip/w7_lock.mjs acquire|release|status [lockpath]");
process.exit(2);
