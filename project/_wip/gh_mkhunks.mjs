/* 把 _wip/gh.diff(base -> 我的副本) 解析成 (old, new) 精确替换对, 并检查每对
 * 在当前主文件里的命中情况(唯一命中 / 未命中 / 多处命中)。
 * 用法: node _wip/gh_mkhunks.mjs [diff] [target]
 * 输出: _wip/gh_hunks.json  + 控制台逐条状态 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const diffPath = process.argv[2] ?? path.join(here, "gh.diff");
const targetPath = process.argv[3] ?? path.join(here, "..", "掠食竞赛.html");

const diff = fs.readFileSync(diffPath, "utf8").split(/\r?\n/);
const target = fs.readFileSync(targetPath, "utf8");

const hunks = [];
let cur = null;
for (const ln of diff) {
  if (ln.startsWith("@@")) {
    if (cur) hunks.push(cur);
    cur = { header: ln, old: [], new: [], removed: [], added: [] };
    continue;
  }
  if (!cur) continue;
  if (ln.startsWith("diff --git") || ln.startsWith("index ") || ln.startsWith("--- ") || ln.startsWith("+++ ")) continue;
  if (ln.startsWith(" ")) { cur.old.push(ln.slice(1)); cur.new.push(ln.slice(1)); }
  else if (ln.startsWith("-")) { cur.old.push(ln.slice(1)); cur.removed.push(ln.slice(1)); }
  else if (ln.startsWith("+")) { cur.new.push(ln.slice(1)); cur.added.push(ln.slice(1)); }
}
if (cur) hunks.push(cur);

const count = (hay, needle) => { if (!needle) return 0; let n = 0, i = 0; for (;;) { const k = hay.indexOf(needle, i); if (k < 0) break; n++; i = k + 1; } return n; };

let uniq = 0, zero = 0, multi = 0;
const rep = [];
hunks.forEach((h, i) => {
  const oldT = h.old.join("\n"), newT = h.new.join("\n");
  const core = h.removed.join("\n");
  const nOld = count(target, oldT), nNew = count(target, newT), nCore = count(target, core);
  const st = nNew > 0 && nOld === 0 ? "已应用" : nOld === 1 ? "唯一命中" : nOld === 0 ? "未命中" : "多处命中";
  if (st === "唯一命中") uniq++; else if (st === "未命中") zero++; else if (st === "多处命中") multi++;
  rep.push({ i, line: h.header, st, nOld, nNew, nCore, oldLines: h.old.length, coreLines: h.removed.length,
             oldHead: h.old.slice(0, 2).join(" | ").slice(0, 90), coreHead: core.split("\n").slice(0, 2).join(" | ").slice(0, 90) });
});
console.log(`hunks=${hunks.length} 唯一命中=${uniq} 未命中=${zero} 多处命中=${multi}`);
for (const r of rep) console.log(`  #${String(r.i).padStart(2)} ${r.st}(old×${r.nOld},new×${r.nNew},core×${r.nCore}) ${r.line.slice(0, 40)} :: ${r.coreHead}`);
fs.writeFileSync(path.join(here, "gh_hunks.json"), JSON.stringify(hunks.map(h => ({ old: h.old.join("\n"), new: h.new.join("\n") })), null, 1), "utf8");
console.log(`已写出 ${hunks.length} 对到 _wip/gh_hunks.json`);
