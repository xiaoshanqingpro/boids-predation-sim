/* 修正: ① `_2D` 雁隼路径的 tz 残留(加雁隼即崩) ② 计分板长小数(显示取整, 不动物理) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// 脚本在 dev/w6w9/ 下，上溯两级即仓库根（原来写死本机桌面副本目录）。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const F2D = path.join(ROOT, "掠食竞赛_2D.html");
const F4 = path.join(ROOT, "掠食竞赛(4).html");
const NL = "\n";

function apply(file, reps, label) {
  let t = fs.readFileSync(file, "utf8");
  let ok = 0;
  for (const [a, b] of reps) {
    if (t.includes(a)) {
      const n = t.split(a).length - 1;
      if (n !== 1) { console.log(`  ⚠ ${label}: 锚点出现 ${n} 次(要求恰好 1): ${a.slice(0, 60)}`); continue; }
      t = t.split(a).join(b); ok++;
    } else console.log(`  ✗ ${label} 未命中: ${a.slice(0, 70)}`);
  }
  if (ok !== reps.length) { console.log(`  ${label}: 只命中 ${ok}/${reps.length} → 不写回`); return false; }
  fs.writeFileSync(file, t);
  console.log(`  ${label}: ${ok}/${reps.length} 处已改 ✓`);
  return true;
}

console.log("=== ① _2D 雁隼路径 tz 残留 ===");
apply(F2D, [
  ['if (useGoose) { tx = gxT; ty = gyT; tz = gzT; hasT = true; g.tgtGoose = ti; }',
   'if (useGoose) { tx = gxT; ty = gyT; hasT = true; g.tgtGoose = ti; }        // 【修正④】2D 无 tz(原残留 → 加雁隼即 ReferenceError)'],
  ['else if (starlingAvail) { tx = sxT; ty = syT; tz = szT; hasT = true; g.tgtGoose = -1; }',
   'else if (starlingAvail) { tx = sxT; ty = syT; hasT = true; g.tgtGoose = -1; }'],
  ['if (hasT) { g.tgtX = tx; g.tgtY = ty; g.tgtZ = tz; }',
   'if (hasT) { g.tgtX = tx; g.tgtY = ty; }'],
], "_2D");

console.log("=== ② 计分板显示取整(只改显示, 不动物理) ===");
const scoreReps = [
  ['    row.s.textContent = r.score;',
   '    row.s.textContent = Math.round(r.score);          // 【修正⑤】T3 按比例蒸发会留下浮点, 显示取整(不改物理)'],
  ['  el("scoreTotal").textContent = ts;',
   '  el("scoreTotal").textContent = Math.round(ts);     // 【修正⑤】否则合计会出现 -6.300000000000001'],
];
apply(F4, scoreReps, "(4)");
apply(F2D, scoreReps, "_2D");
