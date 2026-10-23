import fs from "node:fs";
const SRC = "C:/Users/LIHAOYANG/Documents/xwechat_files/wxid_augoprt6793822_89f3/msg/file/2026-10/掠食竞赛-3d.html";
const MINE = "掠食竞赛.html";
const rd = f => fs.readFileSync(f,"utf8");
const T = rd(SRC), M = rd(MINE);
// 历轮功能清单: 每一项都要在 3D 版里找到
const features = [
 ["r1 合并: 环面/开阔", /TORUS/], ["r1 双隼", /makeFalcon/], ["r2A 空冲刺罚款", /DASH_EMPTY_PENALTY|dashEats/],
 ["r2B 代谢", /METAB_EAGLE/], ["r2C 围攻", /MOB_FRACTION/], ["r2D 冲刺锁定", /lockIdx/],
 ["r2E 猛禽互攻", /CLASH_COST/], ["r2F 判定圈", /EAT_R2_S/], ["r2G 收紧", /COHESION_W/],
 ["r3 可收起面板", /setPanelHidden/], ["r4P1 采样捞勺", /SCOOP_R|SAMPLE_RADII/], ["r4P2 雁中心化", /leaderIdx|gooseShift/],
 ["r4P3 隼 ES", /ES_EVAL_FRAMES/], ["r4P4 借网预警", /gooseAlerts/], ["r5 链表池化网格", /gridNext|cellOrder/],
 ["r5 拖尾环形缓冲", /trailPush/], ["r5 死亡涟漪池", /DEATH_CAP/], ["r5 WebGL 实例化", /drawArraysInstanced/],
 ["r5 ?render=2d 回退", /render2d|render2D/], ["r5 SIM.perf", /get perf\(\)/], ["r6 WebGPU 后端", /ComputeBackend/],
 ["r6 自检", /selfCheck/], ["r6 ?compute= 开关", /compute=/], ["r6 ?initTimeout", /initTimeout/], ["r6 ?diag", /diagMode/],
 ["r6 boot 首帧闸门", /requestAnimationFrame\(async function boot/], ["r6 WGSL 编译错误检测", /getCompilationInfo/],
 ["r7 BODY_S", /BODY_S/], ["r7 BODY_G", /BODY_G/], ["r7 加入隼按钮", /btnAddFalcon/], ["r7 加入鹰按钮", /btnAddEagle/],
 ["r7 spawnRaptor", /function spawnRaptor/], ["r7 编制行", /raidLine/], ["r7 SIM.addFalcon", /addFalcon/],
 ["r7 SIM.bodySizes", /bodySizes/], ["r7 快捷键 F/E", /k === "f"/], ["r7 重置猛禽解散增援", /while \(falcons\.length > 2\)/],
 ["r7 鹰独立Q表", /Q: new Float32Array\(N_STATES \* N_ACTIONS\)/], ["r8 Z 数组", /Z: Float32Array|Z = new Float32Array/],
 ["r8 重力开关", /GRAV_ON/], ["r8 尸体池", /CORPSE_CAP/], ["r8 3D 投影", /function project/], ["r8 软渲染兜底", /renderSoft3D/],
];
let miss = 0;
for (const [name, re] of features) {
  const in3d = re.test(T), inMine = re.test(M);
  if (!in3d) { miss++; console.log(`  ✗ 3D 版缺少: ${name}  (mine=${inMine})`); }
}
console.log(miss === 0 ? "✓ 清单全部命中: 6 轮功能在 3D 版里都在" : `✗ 有 ${miss} 项缺失`);
// 只在 mine 里的"结构性"行(function/常量/DOM id/SIM 钩子) 单独列出, 这些才是真丢功能的候选
const blocks = f => [...rd(f).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const A = blocks(MINE), B = blocks(SRC);
const setB = new Set(B[0].split("\n").map(l=>l.trim()));
const structural = A[0].split("\n").map(l=>l.trim())
  .filter(l => l.length>0 && !setB.has(l) && /^(function |const |let |get |async |el\("|<)/.test(l));
console.log(`\n只在 mine 的结构性行(${structural.length}) —— 逐条判断是否被 3D 版改写/替换:`);
structural.forEach(l=>console.log("    " + l.slice(0,118)));
