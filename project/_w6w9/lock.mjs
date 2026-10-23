/* W6-W9 主文件写互斥锁: node _w6w9/lock.mjs acquire|release [lockPath]
 * 协议: writeFileSync(lock, Date.now(), {flag:"wx"}); 占用则每 2s 重试, 最多 120s;
 *       mtime > 10 分钟视为陈旧锁可抢占。 */
import fs from "node:fs";
const LOCK = process.argv[3] || "_w6w9/main.lock";
const cmd = process.argv[2] || "acquire";
const STALE = 10 * 60 * 1000;
if (cmd === "release") {
  try { fs.unlinkSync(LOCK); console.log("lock released: " + LOCK); } catch (e) { console.log("release: " + e.code); }
  process.exit(0);
}
const t0 = Date.now();
for (;;) {
  try { fs.writeFileSync(LOCK, String(Date.now()), { flag: "wx" }); console.log("lock acquired: " + LOCK); process.exit(0); }
  catch (e) {
    if (e.code !== "EEXIST") { console.log("lock error " + e.code); process.exit(1); }
    let age = 0;
    try { age = Date.now() - fs.statSync(LOCK).mtimeMs; } catch (_) { continue; }
    if (age > STALE) { try { fs.unlinkSync(LOCK); console.log("stale lock removed"); continue; } catch (_) { } }
    if (Date.now() - t0 > 120000) { console.log("lock timeout (" + Math.round(age / 1000) + "s held)"); process.exit(2); }
    console.log("lock busy (" + Math.round(age / 1000) + "s), retry 2s");
    await new Promise(r => setTimeout(r, 2000));
  }
}
