# T5 / W9 2D 变体（掠食竞赛_2D.html）—— 交付与验收证据

- **产物**：`掠食竞赛_2D.html` sha256 `a958941d50dcf7bfc2720dcfc63fb60363cd4f796069f578fbf293a9c5fd5918`（415,653 B）
  ← **这是同时通过"真机双路径"与"守恒线"的冻结修订**（修 bug 后没再改文件，避免产生未验证的新 sha）
- **来源**：`掠食竞赛(4).html` sha256 `205BD9A324526FFED7950D2156D3AE466B45010CDA955203CF1A17F8168629ED`（449,254 B）✔ 与 Lead 指定一致
- **未动**：`掠食竞赛(3).html` sha256 `8bc1a4a2752b7f89…`（与 T3 开工时一致）· `掠食竞赛(4).html` sha256 `205bd9a3…`（与指定一致）
- **脚本**：`_w6w9/t5_p1_physics.mjs`(43) · `t5_p1b_trail.mjs`(10) · `t5_p2_view.mjs`(10 区间) · `t5_p2b_cam.mjs`(1) · `t5_p3a_zrefs.mjs`(67) · `t5_p3b_zprops.mjs`(19) · `t5_p4_gl3d.mjs`(7) · `t5_fix_gl3dref.mjs`(1) · `t5_handoff.mjs`
- **验收脚本**：`t5_conserve.mjs`（守恒线）· `t5_accept.mjs`（render+bench+钩子）· `t5_bench_cmp.mjs`（基线对照）· `t5_realcheck.ps1`（Edge headless 双路径）

## 0. 真机补验（Lead 抓到 bug → 已修）

Lead 用 Edge headless 抓到：**默认路径**（WebGL 2D）抛 `Uncaught ReferenceError: gl3dReady is not defined`、截图 33.4KB 空白；
而 `?render=2d` 正常 —— 因为 `gl3dReady`（3D 就绪标志）在 T5 里被删，但 `tryInitGL()` 成功分支里还有一句赋值
（原第 4481 行 `gl3dReady = glReady && !!(B.has3D && B.has3D());`）；严格模式下给未声明标识符赋值 = ReferenceError，
把整条默认渲染路径打断。**jsdom 与 `?render=2d` 都绕过了这条分支 → 之前的"render 无异常"是假绿。**

**修法**：删掉该赋值语句（`_w6w9/t5_fix_gl3dref.mjs`，1 处），并全量复扫已删 3D 标识符。

复扫（`node _w6w9/t5_scan.mjs "掠食竞赛_2D.html" "<pattern>"`）：

| 模式 | 结果 |
|---|---|
| `gl3dReady\|gl3d\b` | 代码引用 **0**（仅 3 行注释：4481/4482 修复说明、5090 `gl3d:false` 字段） |
| `prog3\|progTrail3\|instVBO3\|star3Buf\|goose3Buf\|trailVBO\|tex3\|fbo3\|depth3\|A4\.\|U4\.\|U3\.` | 代码引用 0（仅注释 / handoffDoc 历史） |
| `VS_BIRD3\|FS_BIRD3\|VS_TRAIL3\|FS_TRAIL3\|draw3D\|renderSoft3D\|VIEW3D\|trailPush\|uPxScale\|vpM` | 代码引用 0（仅注释与 handoffDoc 第 8 轮历史） |
| `s\.size3d\|s\.trail3\|s\.zLow\|s\.zHigh\|s\.Z\b\|s\.VZ\|s\.Z2\|s\.VZ2` | 0（3D 资产块整段删除，无残留） |

**修复后真机双路径**（Edge headless，`--headless=new --virtual-time-budget=9000 --screenshot`，脚本 `_w6w9/t5_realcheck.ps1`）：

| 路径 | 控制台错误 | 截图 | 渲染后端 |
|---|---|---|---|
| 默认（无 query） | **0 条** ✓ | **122,027 B（非空白）** ✓ | `WebGL 实例化渲染已启用: WebGL2 · 最大 20000 实例` |
| `?render=2d` | **0 条** ✓ | **145,800 B（非空白）** ✓ | `render=2d: 走 Canvas2D 全路径` |

（两条都只出现 `WebGPU 不可用(requestAdapter() 返回 null), 走 CPU 路径` —— 无头无 GPU，预期。）

## 0b. 守恒线（最关键）—— 逐位一致 ✓

`node _w6w9/t5_conserve.mjs 2000 11,22,33,44 ""`（修复后重跑；固定 LCG 种子 + `setGeometry` 重建 + Q 表清零）：

| 种子 | (4)`?grav=0` | 掠食竞赛_2D | 判定 |
|---|---|---|---|
| 11 | `f1939905` | `f1939905` | ✓ |
| 22 | `5d7bc120` | `5d7bc120` | ✓ |
| 33 | `48af6cbe` | `48af6cbe` | ✓ |
| 44 | `a29bfac1` | `a29bfac1` | ✓ |

**修 bug 前后哈希完全一致**（11/22/33 与修复前逐位相同）→ 这次修复没碰随机数流与物理语义。
分数数组与存活数也逐项相同（如种子 33：`[432.198, 1.305, 332.965]`，存活 1916）。
**可达的原因**：只删/只改写"在 `GRAV_ON=false` 下永不执行"的代码，且**保留全部 `Math.random()` 调用**——
`spawnRaptor` 里 `r2.z = 120 + Math.random() * 100` 这行虽已无人读，但在基线里同样执行，删掉会改变随机数流、
守恒线立刻不成立（这是本次唯一"故意留下的 z 字段"，代码里有注释说明）。

## 1. 删了什么 / 保了什么

**删除（锚点见各补丁脚本）**
- **三维视角层**：`VIEW3D`/`toggleView`/`updateCamera` 的三维部分（`perspM/lookAtM/mulM`）/`project()` 三维分支/`renderSoft3D()`/相机拖拽与滚轮监听/`?view=top`/「切换俯视」按钮/`T` 键/`cam.yaw|pitch|dist|auto`。`project()` 退化为**恒等 + 相机平移**（保留签名与 `{s,f,ok}` 字段，渲染调用点无需改）。
- **重力与 z 轴（物理删除）**：`GRAV_ON` 常量化 `false`（`?grav=` 解析删除）；数组 `Z/VZ/ZT/Z2/VZ2`；椋鸟定高弹簧+重力+阻尼、雁分层弹簧、猛禽爬升/俯冲相与俯冲红利、近地拉起、三维逃逸分量、三维吃判球（`EAT_3D` + `ez` 项）、尸体抛体系统（`spawnCorpse/stepCorpses/CORPSE_CAP`）、`inCone3` 三维部分、`tryDash` 的 `dz/cvz`；`GH_LAYER_OFF/GH_CLIMB_RATE/GH_DIVE_RATE`。
- **三维拖尾**：`TRAIL3_*`、`trailPush/trailBuf/trailColor/TRAIL_LEN`、`drawHunter` 的折线拖尾段。
- **WebGL 3D 路径**：`VS/FS_BIRD3`、`VS/FS_TRAIL3`、`prog3/progTrail3` 与程序/缓冲/深度帧缓冲初始化、`draw3D()` 方法（block2 从 589 行降到 310 行）。
- **面板**：「高度 鸟/雁」「云厚/尸体」两行、切换俯视/复位视角按钮、重力/自动环绕/三维拖尾/3D 吃判四个开关、视图行里三维/重力/相机/拖尾字段。

**保留**：WebGL **2D** 实例化 `draw()` 与 ping-pong 残影；第三个 `<script>` 的 **WebGPU 计算后端原样未动**；面板「计算后端」行；T2 bandit 表、T3 驱逐鸟行、W5 失速计数、ES/Q 表等全部面板与钩子。
**弃用但保留（值退化为常量，不破旧契约）**：`SIM.view3D/setView3D/gravity/setGravity/setSize3D/size3D/setTrail3/trail3/setEat3D/eat3D/setGhunterZ/stoop/zRange/corpses`，以及 `starling(i).z|vz`、`goose(i).z`、`hunter(i).z|vz`、`hunterDetail().z|vz|stoopT`、`ghunterInfo().z`、`harrierInfo.list[].z`。
**口径变化（声明）**：T2 的 bandit 状态位"自身是否高于雁层"在平面版恒为 0（贴层飞行），UCB1 仍按"雁群是否混乱"一个状态学。

## 2. 验收数字

| 项 | 结果 |
|---|---|
| 守恒线 | 3 种子 × 2000 帧**逐位一致** ✓ |
| 500 帧 step+render（`?render=2d`） | **step 500/500 · render 500/500 · 异常 0 · VirtualConsole 0 条** ✓（假 2D 上下文共 3,347,213 次绘图调用；5.33 ms/帧 step+render） |
| `SIM.bench(100,[2000,20000])` | 可跑 ✓ N=2000 中位数 6.36ms · N=20000 中位数 130.3ms（单跑）；**交替对照**：N=2000 3.93→4.41 (1.122×)、N=20000 171.45→177.53 (**1.035× ≤1.2×**) ✓ |
| 基线 | `涌现HTML汇总/05_早期二维版本/掠食竞赛-round7-2d.html`（round 7，207KB）。**口径说明**：它与本血统不同代（无 T1–T3/W2 特性），N=20000 的邻居搜索是同一套 CELL/PERCEPTION/topoK，所以可比性尚可；为消除墙钟漂移我用**同进程交替 3 轮取中位数**给比值，并附绝对值。 |
| `SIM.compute` | 存在（`object`）✓ |
| WebGPU 代码路径 | grep 命中 `ComputeBackend` / `neighborForces` / `WebGPU`（第 3 块 393 行未动）✓ |
| 三块 `node --check` | 4700 / 310 / 393 行，全部通过 ✓ |

## 3. 未达标项 / 已知取舍

1. ~~浏览器里的 WebGL 2D 路径没有真机验证~~ → **已由 Lead 真机补验并抓到 `gl3dReady` 残留 bug；本报告 §0 已修复 + 双路径复验通过。**
   教训：`?render=2d` 专走 Canvas2D，**默认路径（WebGL 2D）必须单独验**；jsdom 两条都不覆盖默认分支。
2. **jsdom 渲染测试用的是"假 2D 上下文"**（jsdom 的 `getContext` 被驱动打桩成 null；我用 `beforeParse` 装了计数 Proxy ctx），
   所以它只证明"渲染路径能跑完且不抛错"，不证明像素正确 —— 像素正确性由 §0 的真机截图（122KB / 146KB 非空白）承担。
3. `handoffDoc` 里第 8 轮的历史描述保留（该文件以变更记录累积为规矩），W9 一节已明确说明三维部分在本变体中删除；
   本次 gl3dReady 修复写在代码注释里（4481-4482 行），**没有**再动 handoffDoc —— 以免浏览器已验证的 sha 漂移。
4. **T5 的 bench 基线是 round 7（不同代）**：N=20000 比值 1.035×（交替 3 轮中位数），绝对值 130~178ms（受机器负载影响）。
