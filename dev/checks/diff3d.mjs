import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// 脚本在 dev/checks/ 下，上溯两级即仓库根。
// 原来的 SRC 指向本机微信接收目录；该文件与会话归档 project/_archive/掠食竞赛-3d-原始交付.html
// 字节相同（sha256 已核对），故改用仓库内副本；仍可用 argv[2] 覆盖。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = process.argv[2] || path.join(ROOT, "project", "_archive", "掠食竞赛-3d-原始交付.html");
const MINE = path.join(ROOT, "掠食竞赛.html");
const blocks = f => [...fs.readFileSync(f,"utf8").matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const A = blocks(MINE), B = blocks(SRC);
console.log("块数 mine/3d =", A.length, B.length);
for (let i=0;i<3;i++) console.log(`  块${i+1}: mine ${A[i].split("\n").length} 行 / 3d ${B[i].split("\n").length} 行`);
// 行集合差异(去掉纯空白行, 便于看内容)
const set = s => new Set(s.split("\n").map(l=>l.trim()).filter(l=>l.length>0));
for (let i=0;i<3;i++) {
  const sa = set(A[i]), sb = set(B[i]);
  const onlyMine = [...sa].filter(l=>!sb.has(l));
  const only3d   = [...sb].filter(l=>!sa.has(l));
  console.log(`\n=== 块${i+1} ===`);
  console.log(`  只在 mine 里(可能被 3D 版丢了): ${onlyMine.length} 行`);
  console.log(`  只在 3d 里(本轮新增/改写): ${only3d.length} 行`);
  if (onlyMine.length) console.log("  --- only-mine 前 18 行 ---\n" + onlyMine.slice(0,18).map(l=>"    "+l.slice(0,110)).join("\n"));
}
