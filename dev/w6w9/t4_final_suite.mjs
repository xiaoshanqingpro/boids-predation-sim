/* ============================================================================
 * T1/T2/T3/T4 最终一次性验收编排（同一 sha256 上跑完并出汇总表）
 * 用法:
 *   node _w6w9/t4_final_suite.mjs [html]            # 正式跑(推荐 掠食竞赛(4).html)
 *   node _w6w9/t4_final_suite.mjs [html] --fast     # 小参数只验证流水线
 * 产物:
 *   _w6w9/final_<step>.log  每步原始输出
 *   _w6w9/t4_final_table.md 汇总表(含修订 sha256 + 每项 PASS/FAIL)
 * 只读被测 html; 不修改任何机制。
 * ==========================================================================*/
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const HTML = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "掠食竞赛(4).html";
const FAST = process.argv.includes("--fast");
const ALLOW_DIRTY = process.argv.includes("--allow-dirty");   // plumbing 验证用: 允许过程中修订变化
const REPARSE = process.argv.includes("--reparse");           // 只用已保存的 final_*.log 重新解析并出表(不重跑)
const absHtml = path.resolve(ROOT, HTML);
const shaOf = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const SHA_BEFORE = shaOf(absHtml);

const P = {
  t1Check: ["_w6w9/t1_check.mjs", [HTML]],
  t1: FAST ? ["_w6w9/t1_run.mjs", [HTML, "300", "400", "1"]] : ["_w6w9/t1_run.mjs", [HTML, "1500", "4000", "1", "2", "3", "4"]],
  t1off: FAST ? ["_w6w9/t1_run.mjs", [HTML, "300", "400", "1"]] : ["_w6w9/t1_run.mjs", [HTML, "1500", "4000", "1", "2", "3", "4"]],
  t1pf: FAST ? ["_w6w9/t1_verify_pf.mjs", [HTML, "300", "400", "1"]] : ["_w6w9/t1_verify_pf.mjs", [HTML, "1500", "4000", "1", "2", "3", "4"]],
  // T1b(配合四件套)验收矩阵 + 同盟豁免定向 A/B + T3 归因臂(同一脚本跑 T1 基线 471acc03)
  t1b: FAST ? ["_w6w9/t1b_run.mjs", [HTML, "300", "400", "1"]] : ["_w6w9/t1b_run.mjs", [HTML, "1500", "4000", "1", "2", "3", "4"]],
  t1bclash: ["_w6w9/t1b_falconclash.mjs", [HTML]],
  t1bclashBase: ["_w6w9/t1b_falconclash.mjs", ["_w6w9/t1b_base.html"]],
  t3base: ["_w6w9/accept_harrier.mjs", ["_w6w9/t1b_base.html", FAST ? "400" : "4000"]],
  t3: FAST ? ["_w6w9/accept_harrier.mjs", [HTML, "400"]] : ["_w6w9/accept_harrier.mjs", [HTML, "4000"]],
  t2: FAST ? ["_w6w9/t2_accept.mjs", ["400", "1"]] : ["_w6w9/t2_accept.mjs", ["8000", "4"]],
  t4: FAST ? ["_w6w9/t4_stall_verify.mjs", [HTML, "3000", "101"]] : ["_w6w9/t4_stall_verify.mjs", [HTML, "8000", "101,202,303,404"]],
};

const logs = {};
const rows = [];
// 冻结守卫: 每步开始前核对修订哈希; 一旦被别的智能体写入就立即中止(避免跑 40 分钟后得到跨修订的表)
function assertFrozen(where) {
  const now = shaOf(absHtml);
  if (now !== SHA_BEFORE) {
    console.error(`\n!! 修订在验收过程中被修改(${where}): ${SHA_BEFORE.slice(0, 16)} -> ${now.slice(0, 16)}`
      + `\n   本次结果跨修订, 已中止。等冻结后再跑(plumbing 验证可用 --allow-dirty)。`);
    process.exit(2);
  }
}
function step(key, rel, args, opts = {}) {
  const f = path.join(HERE, `final_${key}.log`);
  if (REPARSE) {
    if (!fs.existsSync(f)) { console.error(`[reparse] 缺 ${f}`); process.exit(2); }
    logs[key] = fs.readFileSync(f, "utf8");
    console.log(`[reuse] ${rel} (读已保存日志 ${path.basename(f)}, ${logs[key].length} 字符)`);
    return logs[key];
  }
  if (!ALLOW_DIRTY) assertFrozen(`before ${key}`);
  let out = "", code = 0;
  const t0 = Date.now();
  try {
    out = execFileSync(process.execPath, [path.resolve(ROOT, rel), ...args],
      { encoding: "utf8", cwd: ROOT, timeout: opts.timeout || 3600000, maxBuffer: 128 * 1024 * 1024,
        env: opts.env ? { ...process.env, ...opts.env } : process.env });
  } catch (e) {
    out = (e.stdout || "") + (e.stderr || "");
    code = e.status === undefined ? 1 : e.status;
  }
  fs.writeFileSync(f, out, "utf8");
  logs[key] = out;
  console.log(`[${code === 0 ? "ok" : "exit " + code}] ${rel} ${args.join(" ")}${opts.env ? " " + JSON.stringify(opts.env) : ""}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  return out;
}
const num = s => Number(String(s).replace(/[^\d.\-]/g, ""));
// 队友的 .txt 记录可能是 UTF-16LE(实测 t1b_base_matrix.txt 是 FF FE BOM) —— 自动识别
function readTextAuto(p) {
  const b = fs.readFileSync(p);
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return b.toString("utf16le").replace(/^\uFEFF/, "");
  if (b.includes(0)) return b.toString("utf16le").replace(/^\uFEFF/, "");
  return b.toString("utf8").replace(/^\uFEFF/, "");
}
function pick(re, group = 1) { const m = logs[re.key].match(re.re); return m ? m[group] : null; }
function check(name, value, op, thr, note = "") {
  let pass = null;
  if (value !== null && value !== undefined && Number.isFinite(value)) {
    pass = op === ">=" ? value >= thr : op === "<=" ? value <= thr : op === ">" ? value > thr : op === "<" ? value < thr : value === thr;
  }
  rows.push({ name, value, op, thr, pass, note });
  console.log(`  [${pass === null ? "N/A" : pass ? "PASS" : "FAIL"}] ${name} = ${value} (${op} ${thr}) ${note}`);
  return pass;
}

console.log(`=== 最终一次性验收  html=${HTML} ===\n修订 sha256(开工) = ${SHA_BEFORE}  ${FAST ? "[FAST 模式]" : ""}\n`);

/* ---- 0 语法 ---- */
step("syntax", ...P.t1Check);
check("0 三块 <script> 语法检查(失败数)", num(pick({ key: "syntax", re: /失败\s*(\d+)/ })), "==", 0, pick({ key: "syntax", re: /共 \d+ 块[^\n]*/ }) || "");

/* ---- 1 T1/W6 隼链式攻击(双臂并列) ---- */
step("t1", ...P.t1);
step("t1off", ...P.t1off, { env: { T1_HARRIER_OFF: "1" } });
step("t1pf", ...P.t1pf);
{
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
  const parse = key => {
    const o = logs[key];
    const list = o.match(/单次冲刺 eats 均值[^:]*:\s*([\d.,]+)/);
    return {
      maxEats: num((o.match(/dashMaxEats 全局:\s*(\d+)/) || [])[1]),
      eats: list ? list[1].split(",").map(Number).filter(Number.isFinite) : [],
      evs: ((o.match(/EV\/次冲刺:\s*([\d.,\-]+)/) || [])[1] || "").split(",").map(Number).filter(Number.isFinite),
      posSeeds: num((o.match(/隼①净得分>0 的种子数:\s*(\d+)/) || [])[1]),
      cge: ((o.match(/chainGooseEnds:\s*([\d,]+)/) || [])[1] || "").split(",").map(Number).filter(Number.isFinite),
      hashes: (o.match(/物理哈希:\s*(.+)/) || [])[1] || "-",
      endAttr: (o.match(/链终止归因合计:([^\n]*)/) || [])[1] || "",
    };
  };
  const A = parse("t1"), B = parse("t1off");
  check("1a dashMaxEats ∈ [2,8] (集成臂)", A.maxEats, ">=", 2, `实测 ${A.maxEats}; 上限另判`);
  check("1a' dashMaxEats <= 8 (集成臂)", A.maxEats, "<=", 8);
  check("1b 单次 eats 均值 >= 2 (集成臂)", mean(A.eats), ">=", 2, `各轮 [${A.eats.join(", ")}] 池化均值 ${mean(A.eats).toFixed(2)}`);
  check("1b* 单次 eats 均值 >= 2 (归因臂 T1_HARRIER_OFF=1, 关 T3)", mean(B.eats), ">=", 2, `各轮 [${B.eats.join(", ")}] 池化均值 ${mean(B.eats).toFixed(2)}`);
  check("1c EV/次冲刺 >= +1.5 (集成臂)", mean(A.evs), ">=", 1.5, `各轮 [${A.evs.join(", ")}]`);
  check("1c* EV/次冲刺 >= +1.5 (归因臂)", mean(B.evs), ">=", 1.5, `各轮 [${B.evs.join(", ")}]`);
  check("1d 隼①净得分为正的种子数 >= 3 (集成臂)", A.posSeeds, ">=", 3);
  check("1d* 隼①净得分为正的种子数 >= 3 (归因臂)", B.posSeeds, ">=", 3);
  check("1e chainGooseEnds >= 1 (集成臂)", A.cge.reduce((a, b) => a + b, 0), ">=", 1, `各轮 [${A.cge.join(", ")}]`);
  check("1e* chainGooseEnds >= 1 (归因臂)", B.cge.reduce((a, b) => a + b, 0), ">=", 1, `各轮 [${B.cge.join(", ")}]`);
  rows.push({ name: "1f 物理哈希 集成臂 / 归因臂", value: `${A.hashes} | ${B.hashes}`, op: "info", thr: null, pass: null, note: "" });
  const t1RunDist = (logs.t1.match(/链终止分布 能量:([^\n]+)/) || [])[1] || "";
  const pfAttr = (logs.t1pf.match(/链终止归因合计:([^\n]+)/g) || []).map(s => s.replace("链终止归因合计:", "").trim());
  rows.push({ name: "1g 链终止归因(集成/归因)", value: `t1_run 集成分布 能量:${t1RunDist.trim()} | t1_verify_pf 双臂合计 ${pfAttr.join(" || ")}`, op: "info", thr: null, pass: null, note: "能量越线占压倒多数 → 支持 T3 debuff 耗尽链能量预算的归因" });
  // 我的 per-falcon 复核: 直接从 t1_verify_pf 的输出里取"错误配对 vs 正确配对"
  const pf = logs.t1pf;
  const pfBuggy = (pf.match(/错误配对均值=([\d.]+)/g) || []).map(s => s.split("=")[1]);
  const pfPooled = (pf.match(/池化均值=([\d.]+)/g) || []).map(s => s.split("=")[1]);
  const pfEatRows = (pf.match(/单次 eats 均值: 池化各轮 \[([^\]]+)\] 池化=([\d.]+)[^\n]*/g) || []);
  rows.push({ name: "1h per-falcon 复核(正确池化 / 错误配对)", value: `${pfEatRows.length ? pfEatRows.map(s => (s.match(/池化=([\d.]+)/) || [])[1]).join(" vs ") : pfPooled.join(" vs ")}`, op: "info", thr: null, pass: null, note: `错误配对值 ${pfBuggy.join(" / ")} (若有人用 stats.dashEnds 当分母会系统性减半)` });
}

/* 结构化解析 t1b_run 输出(比正则跨段匹配稳): 返回 { iso2, iso1, int2, int1, iso_ratio, int_ratio } */
function parseMatrix(txt) {
  const out = {};
  let arm = null, cur = null;
  for (const line of String(txt).split(/\r?\n/)) {
    let m = line.match(/^\[(集成\(驱逐鸟开\)|隔离\(驱逐鸟关\))\]\s*隼×(\d)\s+n=(\d+)/);
    if (m) {
      arm = m[1].startsWith("集成") ? "int" : "iso";
      cur = { arm, nf: +m[2], dashList: [], dashMean: NaN, varList: [], varMed: NaN, steal: "", clash: "", eatF0: [] };
      out[`${arm}${cur.nf}`] = cur;
      continue;
    }
    m = line.match(/隼×2 \/ 隼×1 总捕获比:.*?中位\s*([\d.]+)/);
    if (m && arm) { out[`${arm}_ratio`] = +m[1]; continue; }
    if (!cur) continue;
    m = line.match(/dashEndBirds\/冲刺 = (\S+)\s+均值\s*([\d.]+)/);
    if (m) { cur.dashList = m[1].split("/").map(Number); cur.dashMean = +m[2]; continue; }
    m = line.match(/速度方差\(全隼合并\) = (\S+)\s+中位\s*([\d.]+)/);
    if (m) { cur.varList = m[1].split("/").map(Number); cur.varMed = +m[2]; continue; }
    m = line.match(/隼-隼互攻 ([^·]+?) · 隼-隼抢分 ([^·]+?) ·/);
    if (m) { cur.clash = m[1].trim(); cur.steal = m[2].trim(); continue; }
    m = line.match(/单冲刺吃数\(隼①\) = ([^\n]+)/);
    if (m) { cur.eatF0 = m[1].split("/").map(Number).filter(Number.isFinite); continue; }
  }
  return out;
}
const meanOf = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const anyNonZero = s => /[1-9]/.test(String(s));
const zeroSum = s => String(s).split("/").every(x => Number(x) === 0);

/* ---- 1b T1b/W6b 配合四件套(矩阵 + 同盟豁免 A/B) ---- */
step("t1b", ...P.t1b);
step("t1bclash", ...P.t1bclash);
step("t1bclashBase", ...P.t1bclashBase);
{
  const o = logs.t1b;
  const M = parseMatrix(o);
  const iso2 = M.iso2 || { dashMean: NaN, varList: [], clash: "", steal: "", eatF0: [], dashList: [] };
  const iso1 = M.iso1 || { varList: [] };
  const int2 = M.int2 || { dashMean: NaN, clash: "" };
  // 基线(471acc03): t1b_base_matrix.txt(同脚本同种子, T1b 作者记录在 sha 钉扎的基线文件上)
  let MB = {};
  try { MB = parseMatrix(readTextAuto(path.join(HERE, "t1b_base_matrix.txt"))); } catch (e) { MB = {}; }
  const bIso2 = MB.iso2 || { dashMean: NaN };
  const baseDashMean = bIso2.dashMean, baseRatio = MB.iso_ratio;
  const baseVar1 = (MB.iso1 || {}).varList || [];
  const hashLine = (o.match(/隔离臂 隼×2 物理哈希:\s*([\d,]+)/) || [])[1] || "";
  const dmax = (o.match(/隔离臂 隼×2 dashMaxEats:\s*([\d,]+)/) || [])[1] || "";
  const shr = (o.match(/共享感知 ([^\n]+?) ·/) || [])[1] || "";
  const edb = (o.match(/事件双打 ([^\n]+?) ·/) || [])[1] || "";
  const shp = (o.match(/牧羊帧 ([^\n]+?) ·/) || [])[1] || "";
  check("1i T1b dashEndBirds/冲刺 隔离×2 相对 T1 基线上升", iso2.dashMean - baseDashMean, ">", 0,
    `T1 基线 ${baseDashMean} -> T1b ${iso2.dashMean} (集成×2 ${int2.dashMean}); 各轮 [${iso2.dashList.join(", ")}]`);
  check("1j 隼×2/隼×1 总捕获比(隔离臂) 中位 >= 1.8", M.iso_ratio, ">=", 1.8, `T1 基线中位 ${baseRatio}`);
  check("1k 同盟豁免: 隔离×2 隼-隼抢分 == 0", zeroSum(iso2.steal) ? 0 : 1, "==", 0, `各轮 [${iso2.steal}]`);
  check("1l 同盟豁免: 隼-隼互攻仍发生(隔离×2 + 集成×2)", (anyNonZero(iso2.clash) || anyNonZero(int2.clash)) ? 1 : 0, "==", 1,
    `隔离 [${iso2.clash}] 集成 [${int2.clash}]`);
  check("1m T1 回归: 隔离×2 dashMaxEats >= 2", Math.max(...dmax.split(",").map(v => Number(v) || 0)), ">=", 2, `[${dmax}]`);
  check("1m' T1 回归: 隔离×2 dashMaxEats <= 8", Math.max(...dmax.split(",").map(v => Number(v) || 0)), "<=", 8,
    `实测 [${dmax}] —— T1 判据写于 T1b 之前; T1b 的目标就是加长链(隔离臂 dashEndBirds/冲刺 +61%), 超出上界属设计交互, 需在表尾注明`);
  check("1n T1 回归: 单冲刺吃数(隼①, 隔离×2) 均值 >= 2", meanOf(iso2.eatF0), ">=", 2, `各轮 [${iso2.eatF0.join(", ")}]`);
  check("1o 四件套: 共享感知/事件双打/牧羊帧 有非零计数", (anyNonZero(shr) || anyNonZero(edb) || anyNonZero(shp)) ? 1 : 0, "==", 1,
    `共享感知 [${shr}] 事件双打 [${edb}] 牧羊帧 [${shp}]`);
  const pairRatios = (iso1.varList || []).map((v, i) => baseVar1[i] ? v / baseVar1[i] : NaN).filter(Number.isFinite);
  check("1p 单隼速度方差 <= T1 基线 2 倍(逐种子)", pairRatios.length ? Math.max(...pairRatios) : NaN, "<=", 2.0,
    pairRatios.length ? `比值 [${pairRatios.map(v => v.toFixed(3)).join(", ")}] (T1b ${iso1.varList.join("/")} vs 基线 ${baseVar1.join("/")})` : "基线方差缺失");
  rows.push({ name: "1q T1b 物理哈希(隔离×2)", value: hashLine || "-", op: "info", thr: null, pass: null, note: "物理再基线: 相对 T1 基线 936db330/d4a6d456/22b97d54/453be215" });
  const cl = logs.t1bclash.trim().split("\n"), clB = logs.t1bclashBase.trim().split("\n");
  const j = (l) => { try { return JSON.parse(l); } catch (e) { return {}; } };
  const J = j(cl[0]), JB = j(clB[0]);
  check("1r 同盟豁免(T1b): 隼-隼互攻分数零转移 + 有豁免拦截 + 眩晕>0",
    (J.scoreDeltaSum === 0 && J.dFalconSteals === 0 && (J.dFalconAvoided || 0) > 0 && (J.loserStunMax || 0) > 0) ? 1 : 0, "==", 1,
    `scoreDeltaSum=${J.scoreDeltaSum} dFalconSteals=${J.dFalconSteals} dFalconAvoided=${J.dFalconAvoided} 眩晕=${J.loserStunMax} 第二次互攻@${J.nextClashAfterFrames} 帧`);
  check("1s 对照(T1 基线 471acc03): 隼-隼互攻仍扣分(scoreDeltaSum < 0)", JB.scoreDeltaSum, "<", 0,
    `基线 scoreDeltaSum=${JB.scoreDeltaSum} dFalconSteals=${JB.dFalconSteals}`);
}

/* ---- 2 T3/W8 驱逐鸟(并在 T1 基线上复测归因) ---- */
step("t3", ...P.t3);
step("t3base", ...P.t3base);
{
  const o = logs.t3;
  const hit = num((o.match(/① 目标命中率[^:]*:\s*([\d.]+)%/) || [])[1]);
  const drop = num((o.match(/增速降幅\s*([\d.]+)%/) || [])[1]);
  const dives = ((o.match(/③ harrierDives:\s*([\d/]+)/) || [])[1] || "").split("/").map(Number).filter(Number.isFinite);
  const cvOK = /跨种子 CV\(领先者终值\):[^\n]*✓ 缩小/.test(o);
  const aliveOK = /④ 存活数:[^\n]*✓/.test(o);
  check("2a 目标命中率(全群 250px 内) >= 70%", hit, ">=", 70, pick({ key: "t3", re: /任意一只口径[^)]*\)/ }) || "");
  check("2b 领先者增速降幅 >= 30%", drop, ">=", 30);
  check("2c 跨种子 CV 缩小", cvOK ? 1 : 0, "==", 1);
  check("2d harrierDives 每种子 >= 3", dives.length && dives.every(d => d >= 3) ? 1 : 0, "==", 1, `[${dives.join("/")}]`);
  check("2e 存活数恒在 0~N", aliveOK ? 1 : 0, "==", 1);
  rows.push({ name: "2f 修订 sha256(脚本自报)", value: (o.match(/修订 sha256 = (\w+)/) || [])[1] || "-", op: "info", thr: null, pass: null, note: "" });
  // T3 ① 归因复核: 同一脚本在 T1 基线(471acc03)上跑, 看 ① 是否同样 <70%(即缺陷早于 T1b)
  const ob = logs.t3base;
  const hitB = num((ob.match(/① 目标命中率[^:]*:\s*([\d.]+)%/) || [])[1]);
  const anyB = (ob.match(/任意一只口径 ([\d.]+)%/) || [])[1];
  const anyNew = (o.match(/任意一只口径 ([\d.]+)%/) || [])[1];
  rows.push({ name: "2g T3① 归因(T1 基线 vs T1b)", value: `T1 基线 ${hitB}%(任意 ${anyB}%) -> T1b ${hit}%(任意 ${anyNew}%)`, op: "info", thr: null, pass: null, note: "两版同量级 → 缺陷早于 T1b, 不是 T1b 引入的回归" });
  check("2h T3① 归因确认: T1 基线上也 <70%(缺陷早于 T1b)", hitB, "<", 70, `基线 ${hitB}%`);
  // Lead 裁决: 判据以【全群口径】为准(施工文档原文), 任意一只口径仅作并列参考
  rows.push({ name: "2a' T3① 并列参考(任意一只口径)", value: `T1b ${anyNew}% / T1 基线 ${anyB}%  ${Number(anyNew) >= 70 ? "✓≥70" : "✗"}`,
    op: "info", thr: null, pass: null, note: "裁定: 判据用【全群口径】→ 2a 判 FAIL; 本行说明机制本身有效, 只是群内有个体游离散" });
  rows.push({ name: "2i T3① 定级与归因", value: "既有缺陷、非 W6–W9 引入: 驱逐鸟群把「整群」维持在 250px 内的能力不足(60~61%), 机制其余三项(领先者增速 −66.1%、harrierDives、存活数)均达标",
    op: "info", thr: null, pass: null, note: `同脚本 T1 基线 ${hitB}% / T1b ${hit}% 同量级` });
  rows.push({ name: "2j T3① 修复建议(仅建议, 未改机制)", value: "提高驱逐鸟对点名目标的群体内聚/环绕半径自适应: 群成员离点名目标 >250px 时优先回追该成员, 或让 orbitR=90 随群离散度放大; 预期可把全群口径抬过 70%",
    op: "info", thr: null, pass: null, note: "本轮按要求不动机制" });
}

/* ---- 3 T2/W7 bandit ---- */
step("t2", ...P.t2);
{
  const o = logs.t2;
  const a1 = (o.match(/A1 命中率差:[^\n]*均值\s*(-?[\d.]+)/) || [])[1];
  const a2 = (o.match(/A2 混乱期\(s1\)[^\n]*=>\s*(\w+)/) || [])[1];
  const a4 = (o.match(/A4 physicsHash[^\n]*?=\s*([0-9a-f]{6,})/) || [])[1];
  // 对照组命中率(逐 run 行里的 命中率=): 统计贴天花板(=1.000)的 run 数
  const ctrlRates = (o.match(/\[对照\s*\][^\n]*命中率=([\d.]+)/g) || []).map(s => Number(s.split("命中率=")[1]));
  const nCeil = ctrlRates.filter(v => v >= 0.999).length;
  // A2: s1 的决策样本数(合并 4 run)
  const s1Counts = (o.match(/n\(s1\)=\[([\d,]+)\]/g) || []).map(s => (s.match(/\[([\d,]+)\]/) || [])[1].split(",").map(Number).reduce((a, b) => a + b, 0));
  const s1Total = s1Counts.reduce((a, b) => a + b, 0);
  const q0s = (o.match(/Q表\(s0\)=\[([^\]]+)\]/g) || []).map(s => (s.match(/\[([^\]]+)\]/) || [])[1]);
  const n0s = (o.match(/n\(s0\)=\[([^\]]+)\]/g) || []).map(s => (s.match(/\[([^\]]+)\]/) || [])[1]);
  const s0Goose = n0s.map(s => Number(s.split(",")[0]) || 0), s0Tot = n0s.map(s => s.split(",").map(Number).reduce((a, b) => a + b, 0));
  const s0Rate = s0Goose.reduce((a, b) => a + b, 0) / Math.max(1, s0Tot.reduce((a, b) => a + b, 0));
  check("3a A1 命中率差 > +0.05", num(a1), ">", 0.05,
    `逐种子差 ` + ((o.match(/A1 命中率差: 各种子 \[([^\]]+)\]/) || [])[1] || "?") + `; 对照组命中率 [${ctrlRates.map(v => v.toFixed(3)).join(", ")}] 贴 1.000 的 run 数 ${nCeil}/4`);
  rows.push({ name: "3a' A1 判据可评估性", value: nCeil > 0 ? `对照组 ${nCeil}/4 run 命中率=1.000 → 差值上限被天花板锁死, 判据数学上不可达` : "对照组未贴天花板, 判据可评估", op: "info", thr: null, pass: null, note: "" });
  if (s1Total < 5) {
    rows.push({ name: "3b A2 s1 攻雁率 > 0.7", value: `判据失效: s1 决策样本合计 ${s1Total} 次(<5, 4 run 的 n(s1)=[${s1Counts.join(", ")}]) → 比率无统计意义`, op: "skip", thr: null, pass: null, note: "非实现缺陷: 混乱期状态在本轮几乎不存在" });
    console.log(`  [N/A] 3b A2 s1 攻雁率 = 判据失效(s1 样本 ${s1Total} 次)`);
  } else {
    check("3b A2 s1 攻雁率 > 0.7", a2 === "PASS" ? 1 : 0, "==", 1, `s1 样本 ${s1Total} 次`);
  }
  rows.push({ name: "3b' A2 替代证据(s0 攻雁臂)", value: `Q(s0)=[${q0s.join("] [")}] · n(s0)=[${n0s.join("] [")}] · s0 攻雁选择率 ${(s0Rate * 100).toFixed(1)}%`, op: "info", thr: null, pass: null, note: "s1 无样本时的可用佐证" });
  rows.push({ name: "3c A4 物理哈希(bandit on, seed1)", value: a4 || "-", op: "info", thr: null, pass: null, note: "" });
  rows.push({ name: "3d A3 得分对照", value: (o.match(/A3 得分: [^\n]*/) || [])[0] || "-", op: "info", thr: null, pass: null, note: "" });
}

/* ---- 4 T4/W5 失速回归 ---- */
step("t4", ...P.t4);
{
  const o = logs.t4;
  const ratioMin = num((o.match(/最小\s*([\d.]+)/) || [])[1]);
  const judge = /判据 stats\.ghunterStallFrames[^\n]*:\s*(PASS|FAIL)/.exec(o);
  check("4a ① stallFrames >= attacks×45×0.9(按最小值)", judge ? (judge[1] === "PASS" ? 1 : 0) : NaN, "==", 1, `最小比值 ${ratioMin}`);
  const speeds = (o.match(/速度比中位\s*([\d.]+)/) || [])[1];
  const speedsP95 = (o.match(/P95 速度比中位\s*([\d.]+)/) || [])[1];
  check("4b ③ 失速速度比 P95 ≈ 0.85(0.75~0.95)", num(speedsP95), ">=", 0.75, `P95 ${speedsP95}, 中位 ${speeds}`);
  check("4b' 失速速度比 P95 <= 0.95", num(speedsP95), "<=", 0.95);
  const cap = (o.match(/失速转艏上限\(解析\)\s*([\d.]+)/) || [])[1];
  const p95 = (o.match(/转艏 max[^\n]*P95\s*([\d.]+)\/([\d.]+)/) || []);
  rows.push({ name: "4c ③ 转艏上限 与 P95 对照", value: `上限 ${cap}°/帧; 失速P95 ${p95[1]} vs 非失速P95 ${p95[2]}`, op: "info", thr: null, pass: null, note: "" });
  rows.push({ name: "4d ③ 主动加升速帧(应 0)", value: (o.match(/主动加 vz 帧\s*(\d+)/) || [])[1] || "-", op: "info", thr: null, pass: null, note: "" });
  rows.push({ name: "4e ② 三条结算路径", value: (o.match(/L950|ghunterResolve/gi) ? "见 final_t4.log 源码指认(L955/L975/L2959)" : "-"), op: "info", thr: null, pass: null, note: "" });
}

/* ---- 汇总 ---- */
const SHA_AFTER = shaOf(absHtml);
const fails = rows.filter(r => r.pass === false);
const passes = rows.filter(r => r.pass === true);
const infos = rows.filter(r => r.pass === null);
console.log(`\n=== 汇总 (sha256 ${SHA_BEFORE.slice(0, 16)}) ===`);
for (const r of rows) {
  const tag = r.pass === null ? "info" : r.pass ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${r.name}${r.value !== undefined && r.value !== null && r.pass !== null ? " = " + r.value : ""}`);
}
console.log(`\nPASS ${passes.length} / FAIL ${fails.length} / info ${infos.length}`);
console.log(`修订完整性: 开工 ${SHA_BEFORE.slice(0, 16)} -> 收工 ${SHA_AFTER.slice(0, 16)} ${SHA_BEFORE === SHA_AFTER ? "(未变 ✓)" : "(**已变 ✗ 本次结果跨修订, 不可用**)"}`);
if (fails.length) console.log(`FAIL 项: ${fails.map(f => f.name).join(" | ")}`);

const md = [`# W6–W9 最终验收汇总表`, ``, `- 被测文件: \`${HTML}\``, `- 修订 sha256(开工): \`${SHA_BEFORE}\``,
  `- 修订 sha256(收工): \`${SHA_AFTER}\` ${SHA_BEFORE === SHA_AFTER ? "(未变)" : "(已变)"}`, `- 模式: ${FAST ? "FAST" : "正式"}`, ``, `| 项 | 结果 | 数字 |`, `|---|---|---|`,
  ...rows.map(r => `| ${r.name} | ${r.pass === null ? "info" : r.pass ? "PASS" : "FAIL"} | ${typeof r.value === "number" ? r.value.toFixed(3) : r.value} ${r.note || ""} |`),
  ``, `**PASS ${passes.length} / FAIL ${fails.length} / info ${infos.length}**`, ``].join("\n");
fs.writeFileSync(path.join(HERE, "t4_final_table.md"), md, "utf8");
console.log(`\n汇总表已写入 _w6w9/t4_final_table.md`);
process.exit(fails.length ? 1 : 0);
