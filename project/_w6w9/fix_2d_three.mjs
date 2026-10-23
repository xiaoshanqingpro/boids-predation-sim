/* ============================================================================
 * 2D 变体三处修正（用户实测反馈）
 *  ① 真 bug: makeGooseHunter 残留 TRAIL_LEN 引用 -> 加雁隼抛 ReferenceError
 *  ② 驱逐鸟真可控: setHarrierOn(false) 退场 / true 重新生成; 面板 −/＋ 数量控制; SIM.setHarrierCount
 *  ③ 2D 里画出世界边界 + 厌恶带(用 project 的恒等+平移口径, 不用世界坐标直接当屏幕坐标)
 * 只改 掠食竞赛_2D.html。
 * 【随机数纪律】所有生成/退场路径都用确定性布局(spawnPoint + 固定角度), 不消耗 Math.random
 *   -> 守恒线必须仍然逐位一致(见回归)。默认编制 harrierWant=HARRIER_N=6, 与修正前完全一致。
 * 用法: node _w6w9/fix_2d_three.mjs [--apply]
 * ========================================================================== */
import fs from "node:fs";
const P = "掠食竞赛_2D.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const reps = [];
const must = (a, b) => reps.push([a, b]);

/* ---------- ① TRAIL_LEN 残留 ---------- */
must(
  '           trailBuf: new Float32Array(TRAIL_LEN * 3), trailN: 0, trailHead: 0,\n' +
  '           shock: null, seeing: false,',
  '           shock: null, seeing: false,   // 【W9 2D 修正①】无 trailBuf(三维拖尾已删) —— 这里原残留一行 TRAIL_LEN 引用,\n' +
  '                                          // 会让"雁隼 ＋"在 makeGooseHunter 抛 ReferenceError'
);

/* ---------- ② 驱逐鸟: 真退场 + 数量控制 ---------- */
must(
  '           slot: i, orbitA: (i / HARRIER_N) * TAU, dead: 0, recover: 0, bumpCd: 0, dives: 0,',
  '           slot: i, orbitA: (i / HARRIER_N) * TAU, dead: 0, active: 1, recover: 0, bumpCd: 0, dives: 0,'
);
must(
  'let harrierSkuaHits = 0;                    // 贼鸥模式生效次数(取证)',
  'let harrierSkuaHits = 0;                    // 贼鸥模式生效次数(取证)\n' +
  'let harrierWant = HARRIER_N;                // 【修正②】当前"在编"数量(0~HARRIER_N): 面板 −/＋ 与 SIM.setHarrierCount 控制\n' +
  'let harrierSwarm = 0;                       // 【修正②】生成/退场代数(面板与日志取证用)'
);
must(
  'function harrierAliveCount() { let c = 0; for (let i = 0; i < harriers.length; i++) if (harriers[i].dead === 0) c++; return c; }',
  '// 【修正②】存活数 = 在编且未阵亡: setHarrierOn(false)/setHarrierCount(0) 会真的变成 0\n' +
  'function harrierAliveCount() { let c = 0; for (let i = 0; i < harriers.length; i++) if (harriers[i].active && harriers[i].dead === 0) c++; return c; }'
);
must(
  '    harriers.push(makeHarrier(p.x, p.y, i));\n' +
  '  }\n' +
  '  harrierTarget = null; harrierRespawnSeq = 0; harrierSkuaHits = 0;',
  '    const h = makeHarrier(p.x, p.y, i);\n' +
  '    h.active = i < harrierWant ? 1 : 0;        // 【修正②】在编数量控制(0 = 退场)\n' +
  '    harriers.push(h);\n' +
  '  }\n' +
  '  harrierSwarm++;\n' +
  '  harrierTarget = null; harrierRespawnSeq = 0; harrierSkuaHits = 0;'
);
must(
  '// 开关(面板 cbHarrier / SIM.setHarrier): 关 = 对照组, 同时清掉猛禽身上的残余压力\n' +
  'function setHarrierOn(v) {\n' +
  '  harrierOn = !!v;\n' +
  '  const cb = el("cbHarrier"); if (cb) cb.checked = harrierOn;\n' +
  '  for (let i = 0; i < raptors.length; i++) {\n' +
  '    if (harrierOn) raptors[i].hScorePrev = raptors[i].score;\n' +
  '    else raptors[i].hLayer = 0;\n' +
  '  }\n' +
  '  if (!harrierOn) harrierTarget = null;\n' +
  '  return harrierOn;\n' +
  '}',
  '/* 【修正②】清掉猛禽身上的残余压力(退场时必须清, 否则 debuff 会留在目标身上) */\n' +
  'function clearHarrierPressure() {\n' +
  '  for (let i = 0; i < raptors.length; i++) { raptors[i].hLayer = 0; raptors[i].hInRange = 0; }\n' +
  '  harrierTarget = null;\n' +
  '}\n' +
  '// 【修正②】数量控制: n=0 -> 全体真退场(active=0, harrierAliveCount()=0); n>0 -> 重新生成 n 只\n' +
  'function applyHarrierCount(n) {\n' +
  '  n = clamp(Math.round(+n) || 0, 0, HARRIER_N);\n' +
  '  harrierWant = n;\n' +
  '  if (n === 0) {                              // 退场: 不移出数组, 只置 active=0(数组长度恒定, 无分配)\n' +
  '    for (let i = 0; i < harriers.length; i++) {\n' +
  '      const h = harriers[i];\n' +
  '      h.active = 0; h.dead = 0; h.recover = 0; h.bumpCd = 0; h.vx = 0; h.vy = 0;\n' +
  '    }\n' +
  '    clearHarrierPressure();\n' +
  '    logDec(8, 255, "驱逐鸟全部退场(0/" + HARRIER_N + ")");\n' +
  '  } else {\n' +
  '    resetHarriers();                          // 重新生成(确定性布局: spawnPoint + 固定角度, 不吃随机数)\n' +
  '    logDec(8, 255, "驱逐鸟在编 " + n + "/" + HARRIER_N + " 只");\n' +
  '  }\n' +
  '  harrierOn = n > 0;\n' +
  '  const cb = el("cbHarrier"); if (cb) cb.checked = harrierOn;   // 与复选框状态同步\n' +
  '  // 注: 这里**不主动** refreshPanel() —— 面板每帧由主循环刷新; 主动刷会去画面板 canvas,\n' +
  '  //     在无头 jsdom(getContext 打桩成 null)里会抛 "clearRect of null", 干扰 SIM 钩子调用。\n' +
  '  return harrierWant;\n' +
  '}\n' +
  '// 开关(面板 cbHarrier / SIM.setHarrier): false = 对照组(真退场), true = 重新生成满编 6 只\n' +
  'function setHarrierOn(v) {\n' +
  '  if (v) { harrierWant = HARRIER_N; }         // 打开 = 回满编(规格: true -> resetHarriers 重新生成 6 只)\n' +
  '  return applyHarrierCount(v ? HARRIER_N : 0) > 0;\n' +
  '}\n' +
  'function harrierWantCount() { return harrierWant; }'
);
must(
  'function harrierLineText() {\n' +
  '  if (!harrierOn) return "已关闭（对照口径: 无驱逐鸟）";\n' +
  '  const T = harrierTarget;\n' +
  '  return "存活 " + harrierAliveCount() + "/" + HARRIER_N + " · 俯冲 " + stats.harrierDives +',
  'function harrierLineText() {\n' +
  '  if (!harrierOn) return "驱逐鸟 存活 0/" + HARRIER_N + "（已退场）· 战果: 俯冲 " + stats.harrierDives +\n' +
  '         " 次 · 蒸发 " + stats.harrierScoreBurned.toFixed(1) + " 分 · 撞落 " + stats.harrierDowns;\n' +
  '  const T = harrierTarget;\n' +
  '  return "驱逐鸟 存活 " + harrierAliveCount() + "/" + HARRIER_N + " · 战果: 俯冲 " + stats.harrierDives +'
);
/* harrierStep: 三处循环跳过退场个体 */
must(
  '      const h = harriers[i];\n' +
  '      if (h.dead > 0) continue;\n' +
  '      const dx = minImageX(h.x - T.x), dy = minImageY(h.y - T.y);\n' +
  '      if (dx * dx + dy * dy <= HARRIER_RANGE2) inRange++;',
  '      const h = harriers[i];\n' +
  '      if (!h.active || h.dead > 0) continue;      // 【修正②】退场个体不施压\n' +
  '      const dx = minImageX(h.x - T.x), dy = minImageY(h.y - T.y);\n' +
  '      if (dx * dx + dy * dy <= HARRIER_RANGE2) inRange++;'
);
must('      if (h.dead > 0 || h.recover > 0) continue;',
     '      if (!h.active || h.dead > 0 || h.recover > 0) continue;   // 【修正②】');
must('    if (h.dead > 0) { h.dead--; if (h.dead === 0) respawnHarrier(h); continue; }',
     '    if (!h.active) continue;                     // 【修正②】退场个体不移动/不参与反制\n' +
     '    if (h.dead > 0) { h.dead--; if (h.dead === 0) respawnHarrier(h); continue; }');
/* 渲染/小地图: 退场个体不画 */
must(
  '  if (harrierOn) {\n' +
  '    for (let i = 0; i < harriers.length; i++) {\n' +
  '      const h = harriers[i];\n' +
  '      if (h.dead > 0) continue;\n' +
  '      project(h.x, h.y, h.z, PR_A);',
  '  if (harrierOn) {\n' +
  '    for (let i = 0; i < harriers.length; i++) {\n' +
  '      const h = harriers[i];\n' +
  '      if (!h.active || h.dead > 0) continue;      // 【修正②】\n' +
  '      project(h.x, h.y, h.z, PR_A);'
);
must(
  '  if (harrierOn) {                             // W8 驱逐鸟(青绿 2px 点)\n' +
  '    ctx.fillStyle = `rgb(${HARRIER_COLOR})`;\n' +
  '    for (let i = 0; i < harriers.length; i++) {\n' +
  '      const h = harriers[i];\n' +
  '      if (h.dead > 0) continue;',
  '  if (harrierOn) {                             // W8 驱逐鸟(青绿 2px 点)\n' +
  '    ctx.fillStyle = `rgb(${HARRIER_COLOR})`;\n' +
  '    for (let i = 0; i < harriers.length; i++) {\n' +
  '      const h = harriers[i];\n' +
  '      if (!h.active || h.dead > 0) continue;      // 【修正②】\n'
);
/* 面板按钮 + 处理 */
must(
  '  <div class="row"><button id="btnGMinus" style="border-color:#5c4a8a">雁隼 −（⇧G）</button><button id="btnGPlus" style="border-color:#5c4a8a">雁隼 ＋（G）</button></div>',
  '  <div class="row"><button id="btnGMinus" style="border-color:#5c4a8a">雁隼 −（⇧G）</button><button id="btnGPlus" style="border-color:#5c4a8a">雁隼 ＋（G）</button></div>\n' +
  '  <div class="row"><button id="btnHMinus" style="border-color:#4a8a72">驱逐鸟 −</button><button id="btnHPlus" style="border-color:#4a8a72">驱逐鸟 ＋</button></div>'
);
must(
  'el("btnGPlus").onclick  = () => { spawnRaptor("ghunter"); refreshScore(); };',
  'el("btnGPlus").onclick  = () => { spawnRaptor("ghunter"); refreshScore(); };\n' +
  '// 【修正②】驱逐鸟数量控制: 0~HARRIER_N, 与 cbHarrier 状态同步\n' +
  'el("btnHMinus").onclick = () => { applyHarrierCount(harrierWant - 1); };\n' +
  'el("btnHPlus").onclick  = () => { applyHarrierCount(harrierWant + 1); };'
);
/* SIM 钩子 */
must(
  '  setHarrier(v) { return setHarrierOn(v); },',
  '  setHarrier(v) { return setHarrierOn(v); },                    // 兼容: false=退场 / true=满编重新生成\n' +
  '  setHarrierCount(n) { return applyHarrierCount(n); },          // 【修正②】0~HARRIER_N 数量控制\n' +
  '  get harrierWant() { return harrierWant; },'
);

/* ---------- ③ 2D 里的世界边界 + 厌恶带 ---------- */
must(
  '  if (ovClear) ctx.clearRect(0, 0, VIEW_W, VIEW_H);      // 底层 GL 已画不透明画面 -> 先清叠加层\n' +
  '  else if (!TORUS) {\n' +
  '    ctx.strokeStyle = "rgba(255,255,255,0.05)";\n' +
  '    ctx.lineWidth = 1;\n' +
  '    ctx.strokeRect(0.5, 0.5, VIEW_W - 1, VIEW_H - 1);\n' +
  '  }',
  '  if (ovClear) ctx.clearRect(0, 0, VIEW_W, VIEW_H);      // 底层 GL 已画不透明画面 -> 先清叠加层\n' +
  '  else if (!TORUS) {\n' +
  '    ctx.strokeStyle = "rgba(255,255,255,0.05)";\n' +
  '    ctx.lineWidth = 1;\n' +
  '    ctx.strokeRect(0.5, 0.5, VIEW_W - 1, VIEW_H - 1);\n' +
  '  }\n' +
  '  if (!TORUS) drawWorldBounds();               // 【修正③】把"世界边界 + 厌恶带"画出来(平面模式)' 
);
must(
  'function drawMinimap() {',
  '/* 【修正③】2D 里的"世界边界"是什么效果: 世界不环绕、也没有墙 —— 只有一圈 BOUND_R 宽的**厌恶带**\n' +
  ' * (进带后朝外速度被削、并被柔和推回, 见边界厌恶那一段)。这里把它画出来, 让玩家看得见:\n' +
  ' *   ① 世界矩形 [0,W]×[0,H]  ② 四条 BOUND_R 宽的半透明带(带内 = 开始被推回)\n' +
  ' *   ③ 带内边界虚线(进到这里就明显感到"被推回来")。\n' +
  ' * 坐标一律走 project() 的"恒等 + 相机平移"口径, 不把世界坐标当屏幕坐标。 */\n' +
  'function drawWorldBounds() {\n' +
  '  const panX = cam.tx - VIEW_W * 0.5, panY = cam.ty - VIEW_H * 0.5;\n' +
  '  const x0 = -panX, y0 = -panY, x1 = W - panX, y1 = H - panY;\n' +
  '  if (x1 < 0 || y1 < 0 || x0 > VIEW_W || y0 > VIEW_H) return;    // 整个世界都在屏幕外 -> 不画\n' +
  '  ctx.save();\n' +
  '  // ① 厌恶带: 四条 420px 宽的淡色带(带内个体会被柔和推回)\n' +
  '  ctx.fillStyle = "rgba(255, 168, 96, 0.040)";\n' +
  '  ctx.fillRect(x0, y0, x1 - x0, BOUND_R);\n' +
  '  ctx.fillRect(x0, y1 - BOUND_R, x1 - x0, BOUND_R);\n' +
  '  ctx.fillRect(x0, y0, BOUND_R, y1 - y0);\n' +
  '  ctx.fillRect(x1 - BOUND_R, y0, BOUND_R, y1 - y0);\n' +
  '  // ② 世界边框\n' +
  '  ctx.strokeStyle = "rgba(255, 186, 110, 0.32)";\n' +
  '  ctx.lineWidth = 2;\n' +
  '  ctx.setLineDash(EMPTY_DASH);\n' +
  '  ctx.strokeRect(x0 + 0.5, y0 + 0.5, (x1 - x0) - 1, (y1 - y0) - 1);\n' +
  '  // ③ 厌恶带内边界(虚线): 越过它就开始被推回\n' +
  '  ctx.strokeStyle = "rgba(255, 186, 110, 0.14)";\n' +
  '  ctx.lineWidth = 1;\n' +
  '  ctx.setLineDash(DASH_MEM);\n' +
  '  ctx.strokeRect(x0 + BOUND_R, y0 + BOUND_R, (x1 - x0) - 2 * BOUND_R, (y1 - y0) - 2 * BOUND_R);\n' +
  '  ctx.setLineDash(EMPTY_DASH);\n' +
  '  // ④ 低调说明: 只在边框进入视口时标一次\n' +
  '  if (x0 > -220 && x0 < VIEW_W - 40 && y0 > -20 && y0 < VIEW_H - 20) {\n' +
  '    ctx.fillStyle = "rgba(255, 186, 110, 0.55)";\n' +
  '    ctx.font = "11px \'Microsoft YaHei\', sans-serif";\n' +
  '    ctx.fillText("世界边界（外圈 " + BOUND_R + "px 厌恶带：靠近会被柔和推回, 不是墙）", x0 + 6, y0 - 5);\n' +
  '  }\n' +
  '  ctx.restore();\n' +
  '}\n' +
  '\n' +
  'function drawMinimap() {'
);

let bad = 0;
reps.forEach(([a], i) => { const n = t.split(a).length - 1; if (n !== 1) { bad++; console.log(`✗ #${i + 1} 命中 ${n} 次 (${a.split(NL).length} 行) ${a.split(NL)[0].slice(0, 58)}`); } });
console.log(`锚点 ${reps.length} 处, 异常 ${bad} 处`);
if (!APPLY) { console.log("(体检模式)"); process.exit(bad ? 1 : 0); }
if (bad) { console.log("不写回"); process.exit(1); }
for (const [a, b] of reps) t = t.split(a).join(b);
fs.writeFileSync(P, t);
console.log(`2D 三处修正已应用: ${reps.length} 处`);
