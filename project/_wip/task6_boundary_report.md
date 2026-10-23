# task-6 (W1b) 边界厌恶饱和 / 猛禽不越界 / 出生点修正 —— 交付证据

补丁：`_patches/w1b_boundary_v2.mjs`（15 处）、`w1b_boundary_v3.mjs`（3 处加固）、`w1b_boundary_v4.mjs`（1 处收尾，Lead 裁决 B）
接手快照：`_wip/bnd_pre.html`；v4 前快照：`_wip/bnd_pre_v4.html`

> **冻结修订（本文所有数字的版本）**：`掠食竞赛.html` SHA256
> `BDA9B25AB8B20B8EEB53FF1E954D296CD8D0E39901250586EF0D58465561A88F`（236332 字符），
> 与 `_wip/bnd_m40.html` **逐字节相同** —— 任何人可用 `node _probe_boundary.mjs 4000 _wip/bnd_m40.html` 复现。
>
> **修订漂移提醒**：我收尾期间 emergence/falcon-strategy/goose-hunter 仍在写主文件，主文件在我测完后
> 又变成了 SHA256 `9A1E80BE0B245CA7D1E897A96E5AF2B1087817B33B62989469AA249A0BB7C2CD`（296394 字符）。
> 我已在**最新**主文件上复核：18 项锚点自检全通过 + `_probe_boundary.mjs 4000` PASS
> （椋鸟 262.3px / 雁 385.8px / 猛禽 254.3px，clamp 0、越界 0、peak 0.395）。
> 最终冻结版的 golden/syncheck/headless 请由 Lead 在收口时统一复跑。

---

## 1. 改了哪些锚点（改前 → 改后）

| # | 锚点（函数/常量） | 改前 | 改后 |
|---|---|---|---|
| 1 | `BOUND_FORCE` 常量组 | 单个 `BOUND_FORCE = 0.30` | 新增 `BOUND_F_MAX = 0.60`（力饱和上限）、`BOUND_CUT_LO = 0.35`、`BOUND_CUT_K = 2.0`、`DASH_BOUND_LOOK = 45`、`DASH_BOUND_MARGIN = 90→40`、`BOUND_FALLBACK = 60` |
| 2 | `applyBoundary(o,k)` | 力 `F = BOUND_FORCE·k·pen²·9`（k=2、pen=1.10 → **5.9 px/帧²**）；削减 `0.35·pen`；`pen>0.5` 收势；兜底在世界外 2×BOUND_R(840px) | 拆出 `boundAversion()`：力 `F = min(BOUND_F_MAX·k, BOUND_FORCE·k·p²)`（**≤0.6**，二次 ramp）；削减比例 `BOUND_CUT_LO+(1-LO)·min(2p,1)`（pen≥0.5 饱和到 **1.0**）；冲刺边界预测 `boundPredOut` → 会出界则 `dashT=min(dashT,1)`（下一帧走正常收势，不破坏落空罚款/解锁）；兜底收紧到世界外 **60px** |
| 3 | `boundAccel(x,y,vx,vy,dashT)` | 返回 `[nx,ny,pen]`，调用方自己算旧力 | 改为 `boundAccel(x,y,k)` → `[nx,ny,F,cut]`（复用 boundAversion）；两个调用点（椋鸟受力 1444 行 / 雁积分 1730 行）改成"先削朝外分量、再加饱和力" |
| 4 | `tryDash()`（隼，task-3 区域，仅加 1 道门） | 直接落地冲刺速度与 `dashT` | 先算 `dashFrames`，`boundPredOut(f.x,f.y, ux·DASH_SPEED, …, dashFrames, 40)` 命中则 **return false**（此时尚未改速度） |
| 5 | 鹰冲刺触发（6.6） | `if (夹角 ≤ 60°) { E.dashT = 18; … }` | 追加 `&& !boundPredOut(E.x,E.y, ux·EAGLE_DASH, …, EAGLE_DASH_FRAMES, 40)` |
| 6 | `makeFalcon` 初值（`falcons` 常量） | `(W/2, -40)` / `(W/2, H+40)` —— **世界外 35~40px** | 新增 `flockCenter()` + `spawnPoint(ang,r)`；隼①质心正上 300px、隼②正下 300px（`F0_HOME/F1_HOME`） |
| 7 | `makeEagle` 初值 | `(W·0.7, H·0.7)`，离鸟群质心 777px | `EAGLE_HOME = spawnPoint(0.28π, 300)` |
| 8 | `resetPredators()` | `W/2, inOpen? -40 : …`、`H+40`、`W·0.7/H·0.7`；`memX = W/2` | 全部走 `spawnPoint`（质心 ±300px 四个错开方位）；`SPAWN_MARGIN = 130` 保证完全在世界内；记忆点 = 鸟群质心 |
| 9 | `initGeese()` 领队出生点 | `Lx = W·0.3, Ly = H·0.3`（离质心 777px） | `spawnPoint(GOOSE_HOME_A=1.15π, 300)` |
| 10 | `REFILL_SIDES` | `-PAD-20 / W+PAD+20 / H+PAD+20` —— 世界放大后**全在世界外 190px** | `FILL_INSET = 120` 的世界内侧四点，方向仍朝内 |
| 11 | `wrapX/wrapY` | 已由 Lead 去掉硬夹取 | 未改 |
| 12 | `SIM.hunter(k)` | 无 `kind` | 追加 `kind: h.kind \|\| "raptor"`、`label: h.label \|\| ""` |

**未触碰**：椋鸟结群受力/涌现常量（task-2）、隼的选目标/瞄准细节（task-3）、面板与文件末尾说明容器、`_checks/*`。
**已知残留（未改，自愿报告）**：雁的受力段 1692–1695 行仍留着视口时代的 `if (xi < -PAD) ax += BOUND_FORCE` 软墙。它只在雁跑到世界外 170px 时才触发（实测雁全程到边 ≥365px），是死代码；因涉及 task-4 的雁区锚点，未动。

---

## 2. 边界探针（`node _probe_boundary.mjs 4000`，逐帧）

最终版（M=40）主文件连跑 3 次 + 变体（与主文件逐字节相同的 `_wip/bnd_m40.html`）连跑 3 次，**6/6 PASS**：

| 运行 | 椋鸟 | 雁 | 猛禽 | 越界帧 | clampCount | peakPenetration |
|---|---|---|---|---|---|---|
| 主文件 ×3 | 316.9 / 373.6 / 354.9 | 401.8 / 387.4 / 377.3 | 282.9 / 260.9 / 215.8 | 0 / 0 / 0 | 0 | 0.326 / 0.379 / 0.486 |
| 变体 ×3 | 376.2 / 257.4 / 329.2 | 387.4 / 376.4 / 397.6 | 221.9 / 340.4 / 259.9 | 0 / 0 / 0 | 0 | 0.472 / 0.391 / 0.381 |

阈值：三类 ≥40px、越界 0、clamp 0 —— **全部满足，最小余量 215.8px（5.4× 阈值）**。
对照（我接手前）：猛禽 **-47.7px**、越界 20 采样帧、探针 FAIL。

---

## 3. 总捕获（`setRefill(false)`，5000 帧，独立进程）

| 版本 | 样本 | 均值 | ≥100 |
|---|---|---|---|
| 接手前 `bnd_pre.html` | 61 / 85 / 89 | 78.3 | 0/3 |
| 上一版 M=90（v3） | 90 / 104 / 105 / 83 / 118 / 73 | 95.5 | 2/6 |
| **最终版 M=40** | 101 / 87 / 127（主文件）+ 137 / 139 / 123（同字节变体） | **119.0** | **5/6** |

两只隼每样本都开张；headless（`setRefill(true)`，5000 步）在**最终版**上"捕食确实发生 总捕获 **112**（隼①24/隼②43/鹰45）"✓、"两只隼都开张 24/43"✓（M=90 版那次是 69，差分属随机性与生态口径）。

---

## 4. 守恒线哈希（`node _checks/golden.mjs 掠食竞赛.html 2000 …`，两次复现一致）

| 命令 | 新值 | 记录旧值 |
|---|---|---|
| `"" "?grav=0"` | **`acb907e8`** | `9ae66dff`（Lead 记录）→ `6facd300`（W1 版） |
| 无 query（重力开） | **`a669a6e3`** | （本轮新增记录） |

理由：本轮是用户明确要求的物理变更（世界/视口解耦 + 边界厌恶改为"饱和力 + 削朝外速度 + 冲刺边界预测" + 出生点改为质心附近），星鸟位置/速度与猛禽轨迹必然改变 → 哈希重基线。隔离验证：对同一份"接手快照"施加我 18 处替换得到的就是当前文件（行级 diff 只含我的改动，无第三方行被改写）；我接手快照本身 `?grav=0` = `1f1533ed`。随机数消耗未变（`flockCenter/spawnPoint/boundPredOut` 均不消耗 `Math.random`），哈希差异只来自几何与力。

---

## 5. 回归

| 项目 | 结果 |
|---|---|
| `_probe_boundary.mjs 4000` | PASS ×6（见 §2） |
| `_checks/syncheck3d.mjs` | 三块 `node --check` 通过（3528 / 586 / 364 行），失败 0 |
| `_checks/headless.mjs`（最终版，输出 `_wip/boundary_headless_final.txt`） | **152/155** |
| `_wip/bnd_finalcheck.mjs` | 16 项该在的在 / 9 项该清的清，全通过 |

最终版 headless 全绿项（与世界/生态/边界相关的全部断言）：
`✓ 位置/速度/能量不变量全程成立 (maxSpeed=3.600)`、`✓ 自动补充生效: 最低存活 1899/2000`、
`✓ 捕食确实发生: 总捕获 112 (隼① 24 / 隼② 43 / 鹰 45)`、`✓ 两只隼都开张 24/43`、
`✓ 群体质心 (1828,1026) 仍在世界内 (世界 3200x2200)`、`✓ 环面模式不变量成立 (0≤x<3200, 0≤y<2200)`、
`✓ 世界与视口解耦`、`✓ 边界从不硬夹取(clampCount=0, 1500 帧)`。

**剩余 3 条失败与 task-6 无关，指向 W2(惊飞波) 与 WebGPU 着色器不同构**：
```
✗ setCompute("gpu") 在假 GPU 上初始化成功(backend=cpu)
✗ 自检通过路径: passed=false, maxAbs=0.279646635055542
✗ 恢复正常后可以再切回 webgpu
```
归因证据（静态、可复核）：
1. 自检的 CPU 参考 = `computeScene.cpuForces` → 调 `cpuGridAndForces`（主文件 2453–2457 行）；
2. W2 的"接力转向力"就在 `cpuGridAndForces` 内（主文件 **1400–1429 行**：`relay` 累加 + `mag = min(1,|relay|)·CONT_W·MAX_FORCE`，`CONT_W·MAX_FORCE = 4.0×0.15 = 0.6`）；
3. 但第三块 `<script>` 的 WGSL `neighborForces` **没有** W2 项：全文件 `W2_ALERT/W2_TURN/W2_RELAY/relay/RELAY_MIN` 只出现在 ≤1629 行（主脚本块），WGSL 区块（>4300 行）零命中；
4. 我的边界改动在 `stepRest`（1505 / 1815 行），**不在** `cpuGridAndForces`(1340–1447) 内，因此不可能影响这次自检；
5. 观测 `maxAbs=0.2796` 落在 W2 接力力的幅值上限 0.6 之内，量级吻合（M=90 版那次跑自检恰好通过，是因为当时的 fixture 状态没有个体处在警报/接力态 → 该项恒为 0）。
→ 建议：让 emergence(task-2) 在 WGSL 里补上接力项，或由 verifier 把自检 fixture 固定到"无警报"状态并显式说明口径。

---

## 6. 性能归因（回应 Lead 的可选项②）

同进程 N 缩放 + 世界尺寸消融（`_wip/perf_split.mjs`，3 次取最快，400 帧/次）：

| 世界 | 桶数 | N=100 | N=1000 | N=2000 |
|---|---|---|---|---|
| 当前 3200×2200 | 7029 | 0.76 ms | 5.19 ms | **13.41 ms** |
| 消融 1620×1060 | 2145 | 0.71 ms | 7.24 ms | **21.00 ms** |

结论（与"桶数 1350→7029 导致 +38%"的假设相反）：
1. 固定开销（含全部桶的清空）在两档桶数下几乎相同（0.76 vs 0.71 ms，桶数差 3.3× 只值 ~0.05ms）→ **网格桶数不是瓶颈**；
2. 同一份代码把世界缩回 1620×1060 反而 **慢 36%**（13.41 → 21.00 ms）：世界越小、同样 2000 只鸟被边界压得越密，3×3 邻域候选越多，每鸟开销从 ~8.2µs 涨到 ~13.8µs；
3. 因此"世界放大"对 step 开销是**净收益**，1.380 的比值应归因于同期加入的每鸟特性（第 8 轮 3D 高度/尸体/拖尾 + W2 惊飞波等），不是世界解耦。
4. 处置：**不做 CELL/桶数优化**（无收益；且改 `GW×GH` 会撞 headless 的 WebGPU 缓冲断言"桶数=7029、HEAD=28116B"）。建议文档记为"累计特性带来的每鸟开销，已量化"。

---

## 7. 钩子

- 我新增：`SIM.hunter(k)` 的 `kind`（`"falcon"` / `"eagle"`）与 `label` 两个字段。
- 我**没有**改动 `SIM.hunterDetail` / `SIM.startledList` / `SIM.startledFlags` / `SIM.setStarlingVel` / `SIM.starlingNear`（均为 Lead 新增）。
- `SIM.worldInfo()` / `SIM.resetBoundStats()` 语义未变（`clampCount` 现在只可能由"世界外 60px"的兜底触发）。

## 8. 复现命令

```
node _probe_boundary.mjs 4000
node _wip/bnd_samples.mjs 掠食竞赛.html 3 5000
node _checks/syncheck3d.mjs
node _checks/headless.mjs
node _checks/golden.mjs 掠食竞赛.html 2000 "" "?grav=0"
node _checks/golden.mjs 掠食竞赛.html 2000
node _wip/bnd_finalcheck.mjs
```
