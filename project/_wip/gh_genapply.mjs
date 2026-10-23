/* 生成 _patches/goose_hunter_apply.mjs:
 * 把 base->我的副本 的 24 个 hunk(精确 old/new 文本对)写进补丁脚本, 其中 3 个
 * 锚点已按"主文件当前内容"重写(eagles 出生点行 / resetPredators 上下文 / hunter() 现文)。
 * 生成后逐条校验: 每个 old 在主文件里必须唯一命中、且 new 尚未出现。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const mainPath = path.join(root, "掠食竞赛.html");
const main = fs.readFileSync(mainPath, "utf8");
const H = JSON.parse(fs.readFileSync(path.join(here, "gh_hunks.json"), "utf8"));

/* ---- 适配 1: hunk #2 —— 主文件的 eagles 初始化行已变成 EAGLE_HOME ---- */
const oldEagle = 'const eagles = [makeEagle(W * 0.7, H * 0.7, "鹰 EAGLE")];';
const newEagle = 'const EAGLE_HOME = spawnPoint(EAGLE_HOME_A, RAPTOR_HOME_R);\nconst eagles = [makeEagle(EAGLE_HOME.x, EAGLE_HOME.y, "鹰 EAGLE")];';
if (!H[2].old.includes(oldEagle)) throw new Error("hunk2 old 里没找到 W*0.7 的 eagles 行");
H[2].old = H[2].old.replace(oldEagle, newEagle);
H[2].new = H[2].new.replace(oldEagle, newEagle);

/* ---- 适配 2: hunk #8 —— 主文件 resetPredators 里 eagles 行之后是新上下文, 锚点截到该行 ---- */
const cutAt = (s, marker) => { const L = s.split("\n"); const i = L.findIndex(x => x.includes(marker)); if (i < 0) throw new Error("hunk8 找不到 " + marker); return L.slice(0, i + 1).join("\n"); };
H[8].old = cutAt(H[8].old, "while (eagles.length > 1)");
H[8].new = cutAt(H[8].new, "while (ghunters.length > 0)");
if (!H[8].new.includes("ghunters.length > 0")) throw new Error("hunk8 new 丢了 ghunters 行");

/* ---- 适配 3: hunk #23 —— hunter() 已由 task-6 改成带 kind/label, 用主文件现文重建 ---- */
H[23].old =
`    const h = raptors[i];
    return { x: h.x, y: h.y, z: h.z, vx: h.vx, vy: h.vy, vz: h.vz || 0, energy: h.energy || 0, dashT: h.dashT || 0,
             mob: h.mob || 0, stun: h.stun || 0, lockIdx: h.lockIdx === undefined ? -1 : h.lockIdx,
             score: h.score, dashEats: h.dashEats || 0,
             kind: h.kind || "raptor", label: h.label || "" };   // 【task-6】验收探针要按种类区分`;
H[23].new =
`    const h = raptors[i];
    return { x: h.x, y: h.y, z: h.z, vx: h.vx, vy: h.vy, vz: h.vz || 0, energy: h.energy || 0, dashT: h.dashT || 0,
             mob: h.mob || 0, stun: h.stun || 0, lockIdx: h.lockIdx === undefined ? -1 : h.lockIdx,
             score: h.score, dashEats: h.dashEats || 0,
             kind: h.kind || "raptor", label: h.label || "",                    // 【task-6】验收按种类区分
             cool: h.cool || 0, gcool: h.gcool || 0, attacks: h.attacks || 0,   // W4: 冷却与攻击次数(雁隼)
             attack: h.attack || 0, hitGoose: h.hitGoose || 0, hitStarling: h.hitStarling || 0,
             dietGoose: h.dietGoose || h.hitGoose || 0, dietStarling: h.dietStarling || h.hitStarling || 0 };`;

/* ---- 校验 ---- */
const count = (hay, needle) => { let n = 0, i = 0; for (;;) { const k = hay.indexOf(needle, i); if (k < 0) break; n++; i = k + 1; } return n; };
let bad = 0;
H.forEach((h, i) => {
  const no = count(main, h.old), nn = count(main, h.new);
  const okOne = no === 1 && nn === 0;
  if (!okOne) { bad++; console.log(`  ✗ hunk ${i}: old×${no} new×${nn}  首行: ${h.old.split("\n")[0].slice(0, 70)}`); }
});
console.log(`锚点校验: ${H.length - bad}/${H.length} 唯一命中 (主文件 ${main.length} 字符)`);
if (bad) { console.log("存在未命中锚点, 不生成补丁脚本"); process.exit(1); }

const script = `#!/usr/bin/env node
/* ============================================================================
 * W4 雁隼(GooseHunter, kind="ghunter") 补丁 —— 对 ROOT/掠食竞赛.html 做精确字符串替换
 * ----------------------------------------------------------------------------
 * 用法:
 *   node _patches/goose_hunter_apply.mjs [目标文件] [--dry]
 *   默认目标 = <脚本目录>/../掠食竞赛.html
 * 退出码:
 *   0 = 全部替换成功并写回(或 --dry 校验通过)
 *   1 = 有锚点未命中/歧义 —— 什么都不写(整体回滚), 已打印未命中的锚点原文
 *   2 = 已经应用过(检测到所有 new 都在、所有 old 都不在) —— 什么都不写
 *   3 = 参数/文件错误
 * 特性: 先读原文 -> 全部替换成功才写回; 可重复执行; 幂等; 不产生 BOM。
 * 生成方式: _wip/gh_mkhunks.mjs + _wip/gh_genapply.mjs(由 base->副本的 diff 抽取),
 *          锚点已按主文件当前内容核对。细节见 _patches/goose_hunter_notes.md。
 * ==========================================================================*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HUNKS = ${JSON.stringify(H, null, 1)};

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter(a => a !== "--dry");
const dry = process.argv.includes("--dry");
const target = args[0] ? path.resolve(args[0]) : path.join(here, "..", "掠食竞赛.html");
if (!fs.existsSync(target)) { console.error("✗ 目标文件不存在: " + target); process.exit(3); }
let src = fs.readFileSync(target, "utf8");
const count = (hay, needle) => { let n = 0, i = 0; for (;;) { const k = hay.indexOf(needle, i); if (k < 0) break; n++; i = k + 1; } return n; };

/* ---- 1) 幂等检测: 全部已应用? ----
 * 注意: 纯插入型 hunk(new 里含 old)不能靠 "old 消失" 判断, 得靠 "new 出现" ——
 * 否则第二次执行会把插入块再加一遍(实测踩到: 文件 +155 字符)。 */
const isIns = h => h.new.includes(h.old);
const state = (buf, h) => {
  const no = count(buf, h.old), nn = count(buf, h.new);
  if (isIns(h)) return nn >= 1 ? "applied" : (no === 1 ? "ready" : (no === 0 ? "miss" : "ambig"));
  if (nn >= 1 && no === 0) return "applied";
  return no === 1 ? "ready" : (no === 0 ? "miss" : "ambig");
};
const st0 = HUNKS.map(h => state(src, h));
if (st0.every(s => s === "applied")) {
  console.error("✗ 已应用: 本补丁的 " + HUNKS.length + " 处改动全部已在 " + target + " 里, 未做任何修改。");
  process.exit(2);
}

/* ---- 2) 逐个定位(全部先算, 不写) ---- */
const misses = [], ambig = [], done = [];
for (let i = 0; i < HUNKS.length; i++) {
  const s = st0[i];
  if (s === "applied") { done.push(i); continue; }
  if (s === "ready") continue;
  if (s === "miss") misses.push({ i, h: HUNKS[i] });
  else ambig.push({ i, h: HUNKS[i], no: count(src, HUNKS[i].old) });
}
if (misses.length || ambig.length) {
  console.error("✗ 未命中/歧义 —— 已整体回滚, 未修改 " + target);
  for (const m of misses) console.error("  [未命中 #" + m.i + "] 锚点原文:\\n----\\n" + m.h.old + "\\n----");
  for (const a of ambig) console.error("  [歧义 #" + a.i + "] 锚点出现 " + a.no + " 次:\\n----\\n" + a.h.old + "\\n----");
  console.error("  提示: 主文件可能已被别的写者改动; 请对照 _patches/goose_hunter_notes.md 的锚点清单刷新。");
  process.exit(1);
}
if (dry) {
  console.log("✓ --dry: " + (HUNKS.length - done.length) + " 处可替换, " + done.length + " 处已应用(共 " + HUNKS.length + " 处) —— 未写文件");
  process.exit(0);
}

/* ---- 3) 全部替换 + 写前复验(任何一处不成立就不写回) ---- */
let out = src, applied = 0;
for (const h of HUNKS) {
  if (state(out, h) === "ready") { out = out.replace(h.old, h.new); applied++; }
}
const badAfter = HUNKS.map((h, i) => state(out, h) === "applied" ? -1 : i).filter(i => i >= 0);
if (badAfter.length) {
  console.error("✗ 替换后复验失败(未写回): hunk " + badAfter.join(",") + " 未达到已应用状态");
  process.exit(1);
}
/* 写回: UTF-8 无 BOM, 保持原换行风格 */
fs.writeFileSync(target, out, { encoding: "utf8" });
const b = fs.readFileSync(target);
if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) {
  fs.writeFileSync(target, out.replace(/^\\uFEFF/, ""), { encoding: "utf8" });
  console.error("! 检测到 BOM, 已去掉");
}
console.log("✓ 补丁已应用: " + applied + " 处替换 -> " + target + " (" + src.length + " -> " + out.length + " 字符)");
if (done.length) console.log("  (另有 " + done.length + " 处此前已应用, 跳过)");
console.log("  下一步: node _checks/syncheck3d.mjs && node _checks/headless.mjs");
process.exit(0);
`;
fs.writeFileSync(path.join(root, "_patches", "goose_hunter_apply.mjs"), script, "utf8");
console.log("已写出 _patches/goose_hunter_apply.mjs (" + script.length + " 字符, " + H.length + " 处替换)");
