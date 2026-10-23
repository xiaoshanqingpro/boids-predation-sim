/* 主文件写互斥锁: node _wip/bnd_lock.mjs acquire|release
 * 协议: fs.writeFileSync(lock, String(Date.now()), {flag:"wx"}); 占用则每 2s 重试, 最多 60s;
 *       mtime 超过 10 分钟视为陈旧锁, 可抢占。 */
import fs from "node:fs";
const LOCK = "_wip/main.lock";
const cmd = process.argv[2] || "acquire";
const STALE = 10 * 60 * 1000;

if (cmd === "release") {
  try { fs.unlinkSync(LOCK); console.log("lock released"); }
  catch (e) { console.log("lock release: " + e.code); }
  process.exit(0);
}

const t0 = Date.now();
for (;;) {
  try {
    fs.writeFileSync(LOCK, String(Date.now()), { flag: "wx" });
    console.log("lock acquired");
    process.exit(0);
  } catch (e) {
    if (e.code !== "EEXIST") { console.log("lock error: " + e.code + " " + e.message); process.exit(1); }
    let age = 0;
    try { age = Date.now() - fs.statSync(LOCK).mtimeMs; } catch (_) { continue; }
    if (age > STALE) {
      try { fs.unlinkSync(LOCK); console.log("stale lock removed (age " + Math.round(age / 1000) + "s)"); continue; }
      catch (_) { }
    }
    if (Date.now() - t0 > 60000) { console.log("lock timeout: held by another writer (" + Math.round(age / 1000) + "s)"); process.exit(2); }
    console.log("lock busy (" + Math.round(age / 1000) + "s), retry in 2s");
    await new Promise(r => setTimeout(r, 2000));
  }
}
