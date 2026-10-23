/* T5/W9 阶段 1b: 三维拖尾残影(trailPush / trailBuf / trailColor / drawHunter 里的拖尾段)整段删除。
 * 这些只写/读渲染缓冲, 不参与物理 -> 删掉不影响 2D 守恒线(且三维拖尾本来就在删除清单里)。 */
import fs from "node:fs";
const P = "掠食竞赛_2D.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const reps = [];
const must = (a, b) => reps.push([a, b]);
const del = a => reps.push([a, ""]);

/* 1) step 内的三处调用 */
del('    trailPush(E, E.x, E.y, GRAV_ON ? E.z : Z_INIT);\n');
del('    trailPush(f, f.x, f.y, GRAV_ON ? f.z : Z_INIT);\n');
del('    trailPush(g, g.x, g.y, GRAV_ON ? g.z : Z_INIT);\n');
/* 2) 两个工厂里的 trailBuf 字段 */
must(
  '           trailBuf: new Float32Array(TRAIL_LEN * 3), trailN: 0, trailHead: 0,   // 第 8 轮: 3D 拖尾\n' +
  '           shock: null,\n' +
  '           memX: x, memY: y, memT: -1e9 };',
  '           shock: null,\n' +
  '           memX: x, memY: y, memT: -1e9 };   // 【W9 2D】无 trailBuf(三维拖尾已删)'
);
/* 3) 重置里的 trailN/trailHead */
must(
  '    f.energy = ENERGY_MAX; f.dashT = 0; f.trailN = 0; f.trailHead = 0; f.shock = null;',
  '    f.energy = ENERGY_MAX; f.dashT = 0; f.shock = null;'
);
must(
  '    E.dashT = 0; E.cool = 0; E.trailN = 0; E.trailHead = 0; E.shock = null;',
  '    E.dashT = 0; E.cool = 0; E.shock = null;'
);
/* 4) trailPush 函数本体 */
del(
  '// 拖尾环形缓冲: 定容 Float32Array + 头指针, 推一个点 O(1), 永不分配(第 8 轮: 3 分量)\n' +
  'function trailPush(o, x, y, z) {\n' +
  '  const L = TRAIL_LEN;\n' +
  '  if (o.trailN < L) {\n' +
  '    const idx = (o.trailHead + o.trailN) * 3;\n' +
  '    o.trailBuf[idx] = x; o.trailBuf[idx + 1] = y; o.trailBuf[idx + 2] = z; o.trailN++;\n' +
  '  } else {\n' +
  '    o.trailBuf[o.trailHead * 3] = x; o.trailBuf[o.trailHead * 3 + 1] = y; o.trailBuf[o.trailHead * 3 + 2] = z;\n' +
  '    o.trailHead = (o.trailHead + 1) % L;\n' +
  '  }\n' +
  '}\n'
);
/* 5) trailColor + 缓存 */
del(
  '// 拖尾颜色字符串缓存: 按(颜色, 透明度档位)预生成, 避免每段一次模板字符串\n' +
  'const TRAIL_BUCKETS = 12;\n' +
  'const trailColorCache = new Map();\n' +
  'function trailColor(C, a) {\n' +
  '  let bucket = (a * TRAIL_BUCKETS) | 0;\n' +
  '  if (bucket < 0) bucket = 0; else if (bucket >= TRAIL_BUCKETS) bucket = TRAIL_BUCKETS - 1;\n' +
  '  const key = C + "|" + bucket;\n' +
  '  let s = trailColorCache.get(key);\n' +
  '  if (s === undefined) {\n' +
  '    s = `rgba(${C}, ${((bucket + 0.5) / TRAIL_BUCKETS).toFixed(3)})`;\n' +
  '    trailColorCache.set(key, s);\n' +
  '  }\n' +
  '  return s;\n' +
  '}\n'
);
/* 6) drawHunter 里的拖尾段(从 const n = h.trailN 到 shadowBlur = 0;) */
must(
  '  const n = h.trailN;\n' +
  '  if (n >= 2) {                                // 环形缓冲按时间序连点(3D 投影)\n' +
  '    const L = TRAIL_LEN;\n' +
  '    ctx.lineCap = "round";\n' +
  '    let px = 0, py = 0, open = true;\n' +
  '    for (let k = 0; k < n; k++) {\n' +
  '      const idx = ((h.trailHead + k) % L) * 3;\n' +
  '      project(h.trailBuf[idx], h.trailBuf[idx + 1], h.trailBuf[idx + 2], PR_B);\n' +
  '      if (!PR_B.ok) { open = true; continue; }\n' +
  '      if (!open) {\n' +
  '        const dx = PR_B.x - px, dy = PR_B.y - py;\n' +
  '        if (dx * dx + dy * dy <= 2500 * ss * ss) {   // 投影跳变(转到背侧)不连线\n' +
  '          ctx.strokeStyle = trailColor(C, opt.trailA * (k + 1) / n * ff);\n' +
  '          ctx.lineWidth = (dash ? 2.5 : 1.5) * Math.max(0.55, ss);\n' +
  '          if (dash) { ctx.shadowColor = `rgb(${C})`; ctx.shadowBlur = 14; }\n' +
  '          ctx.beginPath();\n' +
  '          ctx.moveTo(px, py);\n' +
  '          ctx.lineTo(PR_B.x, PR_B.y);\n' +
  '          ctx.stroke();\n' +
  '        }\n' +
  '      }\n' +
  '      px = PR_B.x; py = PR_B.y; open = false;\n' +
  '    }\n' +
  '    ctx.shadowBlur = 0;\n' +
  '  }\n',
  '  /* 【W9 2D】三维拖尾折线已删除(平面版只画本体 + 辉光)。 */\n'
);
/* 7) 常量 TRAIL_LEN 不再需要(保留声明也无害, 但一并删干净) */
must('const TRAIL_LEN = 50;\n', '');

let bad = 0;
reps.forEach(([a], i) => { const n = t.split(a).length - 1; if (n !== 1) bad++; console.log(`${n === 1 ? "✓" : "✗"} #${i + 1} 命中 ${n} 次 (${a.split(NL).length} 行) ${a.split(NL)[0].slice(0, 56)}`); });
console.log(`锚点 ${reps.length} 处, 异常 ${bad} 处`);
if (!APPLY) { console.log("(体检模式)"); process.exit(bad ? 1 : 0); }
if (bad) { console.log("不写回"); process.exit(1); }
for (const [a, b] of reps) t = t.split(a).join(b);
fs.writeFileSync(P, t);
console.log(`T5 阶段1b 已应用: ${reps.length} 处`);
