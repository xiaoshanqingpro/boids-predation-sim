/* ============================================================================
 * 第 8 轮之六 最终验收一条龙
 *   node _final_accept.mjs            # 全套
 *   node _final_accept.mjs --fast     # 跳过浏览器(CDP)部分
 * 每项输出 PASS/FAIL + 关键数字; 最后打印汇总与守恒线哈希。
 * ========================================================================== */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const FAST = process.argv.includes("--fast");
const rows = [];
function run(name, cmd, args, opts = {}) {
  const t0 = Date.now();
  let out = "", code = 0;
  try {
    out = execFileSync(cmd, args, { encoding: "utf8", timeout: opts.timeout || 900000, maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    out = (e.stdout || "") + (e.stderr || "");
    code = e.status === undefined ? 1 : e.status;
  }
  const ms = Date.now() - t0;
  let verdict = "?";
  const m = opts.match ? out.match(opts.match) : null;
  if (opts.fail && new RegExp(opts.fail, "m").test(out)) verdict = "FAIL";
  else if (opts.expect && new RegExp(opts.expect, "m").test(out)) verdict = "PASS";
  else if (opts.fail) verdict = "PASS";
  else verdict = code === 0 ? "PASS" : "FAIL";
  const detail = (m ? m[0] : (out.trim().split("\n").filter(l => l.trim()).slice(-1)[0] || "")).slice(0, 150);
  rows.push({ name, verdict, ms, detail });
  console.log(`[${verdict}] ${name}  (${(ms / 1000).toFixed(1)}s)  ${detail}`);
  if (opts.dump && verdict === "FAIL") console.log(out.split("\n").filter(l => /✗|Error|FAIL/.test(l)).slice(0, 12).join("\n"));
  return { out, code };
}

console.log("=== 第 8 轮之六 最终验收 ===");
const html = "掠食竞赛.html";

// 1) 语法
run("① 三块 node --check", "node", ["_checks/syncheck3d.mjs"], { expect: "失败=0" });
// 2) 守恒线(?grav=0) 与 2D 语义哈希
//    【参数坑】golden.mjs 的 QUERY 取 argv[4]; PowerShell 会丢掉空字符串参数(所以 shell 里
//    `... 2000 "" "?grav=0"` 能工作), 但 execFileSync 原样传递 → 这里必须**不要**那个空参数。
const g1 = run("② 守恒线 ?grav=0", "node", ["_checks/golden.mjs", html, "2000", "?grav=0"], { match: /PHYSICS_HASH=\w+/ });
const g2 = run("③ 默认(重力开)哈希", "node", ["_checks/golden.mjs", html, "2000"], { match: /PHYSICS_HASH=\w+/ });
// 3) headless 套件
run("④ headless 套件", "node", ["_checks/headless.mjs"], { fail: "✗", dump: true });
// 4) 边界 / 出生点 / 两群
run("⑤ 边界厌恶(无夹取/无越界/≥40px)", "node", ["_probe_boundary.mjs", "4000"], { fail: "^FAIL", expect: "^PASS" });
run("⑥ 猛禽出生点与捕食曲线", "node", ["_probe_spawn.mjs"], { fail: "总捕获 0\\b" });
// 5) 验收方探针(存在才跑) —— 判据 = 探针自己的总结论行 "总判决: PASS/FAIL"
for (const f of ["accept_boundary", "accept_emergence", "accept_falcon", "accept_ghunter"]) {
  const p = `_checks/${f}.mjs`;
  if (fs.existsSync(p)) run(`⑦ ${f}`, "node", [p], { fail: "总判决:\\s*FAIL", expect: "总判决:\\s*PASS" });
  else rows.push({ name: `⑦ ${f}`, verdict: "SKIP", ms: 0, detail: "脚本尚未交付" });
}
// 6) 浏览器(CDP)
if (!FAST) {
  run("⑧ CDP 交互验收(#2/#4/#5/#7/#8)", "node", ["_checks/cdp_accept.mjs", html], { fail: "验收脚本出错" });
  run("⑨ CDP 计分板稳定", "node", ["_checks/cdp_panel.mjs"], { expect: "状态列 x 全程不变: true" });
}

console.log("\n=== 汇总 ===");
for (const r of rows) console.log(`  ${r.verdict.padEnd(5)} ${r.name}  ${r.detail}`);
const fails = rows.filter(r => r.verdict === "FAIL");
console.log(`\nPASS ${rows.filter(r => r.verdict === "PASS").length} / FAIL ${fails.length} / SKIP ${rows.filter(r => r.verdict === "SKIP").length}`);
console.log(`守恒线(?grav=0) ${(g1.out.match(/PHYSICS_HASH=(\w+)/) || [])[1]} ; 默认(3D) ${(g2.out.match(/PHYSICS_HASH=(\w+)/) || [])[1]}`);
process.exit(fails.length ? 1 : 0);
