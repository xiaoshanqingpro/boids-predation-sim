/* W6: 生成 _wip/w6_headless_probe.mjs —— headless.mjs 的只读诊断副本(不改 _checks/) */
import fs from "node:fs";
const src = fs.readFileSync("_checks/headless.mjs", "utf8");

const inject = `
/* ================= W6 锥诊断注入(不改任何断言) ================= */
const __kinds = ["falcon", "eagle"];
const __con = {};
for (const k of __kinds) __con[k] = { frames: 0, cone2D: 0, cone3Dok: 0, under180: 0, min2D: 1e9, min3D: 1e9, minDz: 1e9, at2D: -1 };
let __frames = 0;
let __last = { coneFalconFrames: SIM.stats.coneFalconFrames, coneEagleDrain: SIM.stats.coneEagleDrain };
const __step0 = SIM.step.bind(SIM);
SIM.step = function __wrappedStep() {
  __step0();
  __frames++;
  const L = SIM.leader;
  const tot = SIM.raptorCount.total;
  for (let i = 0; i < tot; i++) {
    const r = SIM.hunter(i);
    const k = __con[r.kind] ? r.kind : "falcon";
    const a = __con[k];
    const d2h = Math.hypot(r.x - L.x, r.y - L.y);
    const dz = r.z - L.z;
    const d3 = Math.hypot(d2h, dz);
    a.frames++;
    if (d2h < 180) a.under180++;
    if (SIM.inCone(r.x, r.y)) a.cone2D++;
    if (d3 < 180) a.cone3Dok++;
    if (d2h < a.min2D) { a.min2D = d2h; a.at2D = __frames; }
    if (d3 < a.min3D) a.min3D = d3;
    if (Math.abs(dz) < a.minDz) a.minDz = Math.abs(dz);
  }
};
function __conReport(tag) {
  const dF = SIM.stats.coneFalconFrames - __last.coneFalconFrames;
  const dE = SIM.stats.coneEagleDrain - __last.coneEagleDrain;
  __last = { coneFalconFrames: SIM.stats.coneFalconFrames, coneEagleDrain: SIM.stats.coneEagleDrain };
  const parts = [];
  for (const k of __kinds) {
    const a = __con[k];
    parts.push(\`\${k}: 引擎\${dF && k === "falcon" ? dF : 0}/\${dE && k === "eagle" ? dE : 0} 2D锥\${a.cone2D} 3D<180\${a.cone3Dok} <180水平\${a.under180} 出现\${a.frames} 最小水平\${a.min2D === 1e9 ? "-" : a.min2D.toFixed(0)}(f\${a.at2D}) 最小3D\${a.min3D === 1e9 ? "-" : a.min3D.toFixed(0)} 最小|dz|\${a.minDz === 1e9 ? "-" : a.minDz.toFixed(0)}\`);
  }
  console.log(\`\\n@@CONE[\${tag}] 累计帧 \${__frames} | 累计失血 隼\${SIM.stats.coneFalconFrames}/鹰\${SIM.stats.coneEagleDrain} || \` + parts.join(" || "));
}
/* ============================================================== */
`;

let out = src.replace(
  'if (!SIM) { console.error("✗ window.SIM 调试钩子缺失"); process.exit(1); }',
  'if (!SIM) { console.error("✗ window.SIM 调试钩子缺失"); process.exit(1); }\n' + inject
);

// 每个 section 头前插入报告
const sections = [...out.matchAll(/console\.log\("\\n\[(\d+)\]/g)].map(m => m.index);
if (!sections.length) throw new Error("没找到 section 头");
let res = "", prev = 0;
for (const idx of sections) {
  const n = out.slice(idx, idx + 30).match(/\[(\d+)\]/)[1];
  res += out.slice(prev, idx) + `__conReport("before-[${n}]");\n`;
  prev = idx;
}
res += out.slice(prev);
res += `\n__conReport("END");\n`;
fs.writeFileSync("_wip/w6_headless_probe.mjs", res);
console.log("written", res.length, "sections", sections.length);
