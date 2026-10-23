/* W7: 给"改前"基线副本补上**纯计数**钩子(隼的分物种食谱/净猎获), 不改任何物理。
 * 目的: 用同一支探针测出"改前隼顺路吃雁几只", 与改后对照。
 * 用法: node _wip/w7_instr.mjs <src.html> <out.html>   (每个锚点必须恰好命中 1 次) */
import fs from "node:fs";
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error("用法: node _wip/w7_instr.mjs <src> <out>"); process.exit(2); }
let t = fs.readFileSync(src, "utf8");
const EDITS = [
  ["makeFalcon+计数", "           memX: x, memY: y, memT: -1e9, score: 0, kills: 0, pending: 0 };\n}\n/* 第 7 轮: 鹰也变成工厂",
   "           memX: x, memY: y, memT: -1e9, score: 0, kills: 0, pending: 0,\n           lockGoose: -1, tgtGoose: -1, dietStarling: 0, dietGoose: 0, scoreHunt: 0 };\n}\n/* 第 7 轮: 鹰也变成工厂"],
  ["stats", "                ghunterMaxDashSpeed: 0 };        // 实测冲刺速度峰值(px/帧, 验收用)",
   "                ghunterMaxDashSpeed: 0, falconGooseKills: 0, falconGooseTargetFrames: 0, falconDashFrames: 0, falconHuntScore: 0 };"],
  ["椋鸟吃判", "        if (f.kind === \"eagle\") f.dietStarling++;",
   "        if (f.kind === \"eagle\" || f.kind === \"falcon\") f.dietStarling++;\n        if (f.kind === \"falcon\") { f.scoreHunt += SCORE_STARLING; stats.falconHuntScore += SCORE_STARLING; }"],
  ["雁吃判", "        if (f.kind === \"eagle\") f.dietGoose++;",
   "        if (f.kind === \"eagle\" || f.kind === \"falcon\") f.dietGoose++;\n        if (f.kind === \"falcon\") { f.scoreHunt += SCORE_GOOSE; stats.falconGooseKills++; stats.falconHuntScore += SCORE_GOOSE; }"],
  ["dietByKind", "    for (const g of ghunters) { out.ghunter.starling += g.hitStarling; out.ghunter.goose += g.hitGoose; }",
   "    for (const g of ghunters) { out.ghunter.starling += g.hitStarling; out.ghunter.goose += g.hitGoose; }\n    for (const f of falcons) { out.falcon.starling += f.dietStarling || 0; out.falcon.goose += f.dietGoose || 0; }"],
  ["hunterDetail", "    gcool: h.gcool || 0, attacks: h.attacks || 0,",
   "    gcool: h.gcool || 0, attacks: h.attacks || 0,\n    dietGoose: h.dietGoose || h.hitGoose || 0, dietStarling: h.dietStarling || h.hitStarling || 0,\n    lockGoose: h.lockGoose === undefined ? -1 : h.lockGoose, tgtGoose: h.tgtGoose === undefined ? -1 : h.tgtGoose,\n    scoreHunt: h.kind === \"falcon\" ? (h.scoreHunt || 0) : 0,"],
];
for (const [name, find, repl] of EDITS) {
  const n = t.split(find).length - 1;
  if (n !== 1) { console.error(`锚点 "${name}" 命中 ${n} 次(要求 1 次) -> 中止, 不写回`); process.exit(3); }
  t = t.replace(find, repl);
}
fs.writeFileSync(out, t, "utf8");
console.log(`instrumented ${out} <- ${src} (${EDITS.length} 个锚点全部命中) bytes=${t.length}`);
