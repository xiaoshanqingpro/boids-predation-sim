/* 汇总所有"涌现"（掠食竞赛 / 椋鸟群）HTML: 扫描 → 内容分类 → 去重 → 收进一个文件夹 → 生成清单
 * 用法: node _w6w9/collect_html.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const DRY = process.argv.includes("--dry");
const ROOT = "C:/Users/LIHAOYANG/Desktop/资料库";
const OUT = path.join(ROOT, "涌现HTML汇总");
const SCAN_DIRS = [
  ROOT,                                                     // 项目树(含 _archive/_wip/_patches)
  "C:/Users/LIHAOYANG/Desktop",                             // 桌面(用户给的基线)
  "C:/Users/LIHAOYANG/Downloads",
  "C:/Users/LIHAOYANG/Documents/xwechat_files/wxid_augoprt6793822_89f3/msg/file/2026-10",
];
const MARKERS = {
  "W5失速(施工单血统)": t => t.includes("GH_STALL_FRAMES") && t.includes("ghunterStallFrames"),
  "T2bandit": t => t.includes("ghunterBandit") || t.includes("GH_BANDIT"),
  "T3驱逐鸟": t => t.includes("harrier") || t.includes("harriers"),
  "T1链式": t => t.includes("F_CHAIN"),
  "3D管线": t => t.includes("renderSoft3D") && t.includes("GLBackend.draw3D"),
  "WebGPU计算": t => t.includes("ComputeBackend") && t.includes("neighborForces"),
  "雁隼物种": t => t.includes("ghunter") || t.includes("GHUNTER"),
  "末制导": t => t.includes("DASH_HOME_K"),
  "我的惊飞波": t => t.includes("W2_ALERT"),
  "我的边界厌恶": t => t.includes("BOUND_R") || t.includes("boundAversion"),
  "重力/3D解耦": t => t.includes("GRAV_ON") && t.includes("VIEW_W"),
  "二维纯版": t => !t.includes("GLBackend.draw3D") && !t.includes("GRAV_ON"),
};
const isProject = t => t.includes("掠食竞赛") || t.includes("椋鸟") || t.includes("boids");

const seen = new Map();   // sha256 -> 代表路径
const rows = [];
for (const dir of SCAN_DIRS) {
  if (!fs.existsSync(dir)) continue;
  const walk = d => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!/node_modules|\.git/.test(e.name)) walk(p); continue; }
      if (!/\.html?$/i.test(e.name)) continue;
      let t = "";
      try { t = fs.readFileSync(p, "utf8"); } catch { continue; }
      if (!isProject(t)) continue;
      const st = fs.statSync(p);
      const sha = createHash("sha256").update(t).digest("hex").slice(0, 16);
      const tags = Object.entries(MARKERS).filter(([, f]) => { try { return f(t); } catch { return false; } }).map(([k]) => k);
      const row = { p, name: e.name, dir: d, kb: +(st.size / 1024).toFixed(1), mtime: st.mtime, sha, tags, dupOf: null };
      if (seen.has(sha)) row.dupOf = seen.get(sha); else seen.set(sha, p);
      rows.push(row);
    }
  };
  walk(dir);
}
rows.sort((a, b) => b.mtime - a.mtime);

// 同一内容哈希只收一份当代表: 规范文件名/主目录优先(否则会被先遍历到的工作副本抢走)
const score = r => {
  let s = 0;
  if (/^掠食竞赛\.html$/i.test(r.name)) s += 200;
  if (/^掠食竞赛[（(][34][)）]\.html$/i.test(r.name)) s += 180;
  if (/^掠食竞赛_2D\.html$/i.test(r.name)) s += 180;
  if (/^掠食竞赛/.test(r.name) && !/^掠食竞赛[（(][0-9]/.test(r.name)) s += 60;
  if (/鸟群掠食模拟$/.test(r.dir)) s += 40;
  if (/_wip[\\/]/.test(r.p)) s -= 60;
  if (/_archive[\\/]/.test(r.p)) s -= 20;
  if (/^(dbg\d|sandbox_|w[67]_|task3_|bnd_|a1_|[cfghjm]_|s2_|split_|v_|perf_)/i.test(r.name)) s -= 40;
  s -= Math.min(30, Math.max(0, (Date.now() - r.mtime.getTime()) / 86400000));   // 越新越优先
  return s;
};
const bestOf = new Map();   // sha -> 代表
for (const r of rows) {
  const cur = bestOf.get(r.sha);
  if (!cur || score(r) > score(cur)) bestOf.set(r.sha, r);
}
const uniq = [...bestOf.values()];
for (const r of rows) r.dupOf = (bestOf.get(r.sha) === r) ? null : bestOf.get(r.sha).p;
const roleOf = r => {
  const n = r.name, d = r.dir;
  if (/^掠食竞赛\.html$/i.test(n) && !/wip|_archive/.test(d)) return "01_正式交付_主线";
  if (/掠食竞赛[（(]3[)）]|baseline_T1/i.test(n)) return "02_施工单基线(3)";
  if (/掠食竞赛[（(]4[)）]|_2D\.html$/i.test(n)) return "03_施工单产物_四与二维版";
  if (/^(sandbox_|dbg\d|smoke|w6_diag|w6_probe)/i.test(n)) return "03b_施工单调试副本";
  if (/掠食竞赛-3d|_cv_|^v3d/i.test(n)) return "04_三维历史版本";
  if (/^掠食竞赛[（(]1[)）]|^old\.html$|186|round7|2d/i.test(n)) return "05_早期二维版本";
  if (/^w[67]_|^task3_|^bnd_|^a1_|^[cfghjm]_|^s2_|^split_|^v_|^perf_|^verify_gh|goosehunter|^w2_base/i.test(n)) return "06_实验与工作副本";
  if (/_archive/i.test(d)) return "07_存档";
  if (r.tags.includes("W5失速(施工单血统)")) return "02_施工单基线(3)";
  if (r.tags.includes("T1链式") || r.tags.includes("T2bandit") || r.tags.includes("T3驱逐鸟")) return "03_施工单产物_四与二维版";
  return "08_其他";
};
const byRole = {};
for (const r of uniq) (byRole[roleOf(r)] ||= []).push(r);

console.log(`扫描 ${SCAN_DIRS.length} 个目录: 命中项目 html ${rows.length} 个, 去重后 ${uniq.length} 个唯一内容`);
for (const k of Object.keys(byRole).sort()) console.log(`  ${k}: ${byRole[k].length} 个`);

if (DRY) { for (const r of uniq.slice(0, 60)) console.log(`   ${r.kb.toString().padStart(7)}KB ${r.mtime.toISOString().slice(5, 16)} ${r.sha} ${r.name}  [${r.tags.join(",")}]`); process.exit(0); }

// 落盘
fs.mkdirSync(OUT, { recursive: true });
const manifest = ["# 涌现 HTML 汇总清单", "",
  `生成时间: ${new Date().toLocaleString("zh-CN")}  `,
  `来源目录: ${SCAN_DIRS.join(" | ")}  `,
  `命中 ${rows.length} 个文件 → 去重后 ${uniq.length} 份唯一内容（其余为字节级重复副本，仅记录不复制）`, "",
  "| 分类 | 文件 | 大小 | 修改时间 | sha256(前16) | 特征标记 |", "|---|---|---|---|---|---|"];
const dupIndex = [];
for (const role of Object.keys(byRole).sort()) {
  const dir = path.join(OUT, role);
  fs.mkdirSync(dir, { recursive: true });
  for (const r of byRole[role]) {
    const base = r.name.replace(/[\\/:*?"<>|]/g, "_");
    // 同名不同内容时加哈希后缀
    let dest = path.join(dir, base);
    if (fs.existsSync(dest)) {
      const other = fs.readFileSync(dest);
      if (createHash("sha256").update(other).digest("hex").slice(0, 16) !== r.sha) dest = path.join(dir, base.replace(/\.html?$/i, `_${r.sha}.html`));
    }
    if (!fs.existsSync(dest)) fs.copyFileSync(r.p, dest);
    manifest.push(`| ${role} | ${path.basename(dest)} | ${r.kb}KB | ${r.mtime.toLocaleString("zh-CN")} | ${r.sha} | ${r.tags.join(" / ")} |`);
    for (const d of rows.filter(x => x.dupOf === r.p)) dupIndex.push(`- ${path.basename(dest)} ← 重复副本: ${d.p} (${d.kb}KB)`);
  }
}
manifest.push("", "## 字节级重复副本（未复制，仅登记来源）", "", ...(dupIndex.length ? dupIndex : ["- 无"]));
fs.writeFileSync(path.join(OUT, "清单.md"), manifest.join("\n"), "utf8");
console.log(`\n已汇总到: ${OUT}`);
console.log(`清单: ${path.join(OUT, "清单.md")}`);
console.log(`复制了 ${uniq.length} 份唯一内容, 登记 ${dupIndex.length} 份重复副本`);

