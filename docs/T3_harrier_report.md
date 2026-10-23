# T3 / W8 驱逐鸟新物种 harrier —— 交付与验收证据

- 产物：`掠食竞赛(4).html`（sha256 `2a418a0d36c00f0a6e02e4be18e7c8e6b1c25dd25e946db52e8533dbf500f50a`）
- 基线 `掠食竞赛(3).html` **未动**：sha256 `8bc1a4a2752b7f89cf95f7382d2e5fb8a8dc00454b1aff03cd5109fe11ffad27`（与本任务开工时一致）
- 补丁：`_w6w9/t3_harrier_patch.mjs`（26 处）+ `t3_harrier_fix1.mjs`（4 处）+ `t3_harrier_fix2.mjs`（1 处）+ `t3_handoff_numbers.mjs`（handoffDoc 数字）
- 验收：`_w6w9/accept_harrier.mjs`（4 种子 × 4000 帧，对照 = `SIM.setHarrier(false)`）
- 诊断：`_w6w9/diag_harrier.mjs`；物理哈希：`_w6w9/t3_physhash.mjs`；语法：`_w6w9/syncheck.mjs`；自检：`_w6w9/finalcheck_harrier.mjs`

## 1. 落地清单（规格逐条）

| 规格 | 实现 |
|---|---|
| 新数组 `harriers`，`HARRIER_N=6`，速度 6.0，颜色 `"90,220,180"` | 常驻数组 6 只（阵亡只置 `dead` 计时，长度不变）；`HARRIER_SPEED=6.0`；`HARRIER_COLOR="90,220,180"`（青绿，2D 叠加层三角 + 小地图点） |
| 不可食用、不进 `threats`、不触发逃逸 | harriers **只**在 `harriers` 里；`threats`/`raptors` 一行未改（`SIM.harrierConst.inThreats===false` 可验）。6.4/6.5 的 EAT 与逃逸都只遍历 `threats` → 天然跳过，且 harrier 自己不进食 |
| 每 60 帧点名当前 `score` 最高的猛禽 | `frame % HARRIER_LOCK_FRAMES(60) === 0` 重选 `raptors` 中 score 最大者；目标被移除时立即重选 |
| 120px 内每帧 +1 层（上限 30） | `HARRIER_RANGE=120`；带内每帧 `+1`；`hLayerSet` 钳在 `[0,30]` |
| 转向类参数 ×(1−0.02×层) | `hTurnPen()` 接进：隼 6.8 盘旋 `CIRCLE_TURN`、冲刺末制导 `DASH_HOME_K`；鹰 6.6 巡航制导 0.25 与搜索盘旋 0.05；雁隼 6.85 攻击制导 `GH_STRIKE_TURN` 与巡航 `turnCap` |
| 冲刺能耗 ×(1+0.03×层) | `hDrainPen()` 接进：隼冲刺 `drain`、雁隼 `GH_DASH_DRAIN` |
| 层满 30 → `stun += 12`、`score −= 当前分×5%`（蒸发） | `HARRIER_DIVE_STUN=12`；`burned = max(0,score)×frac` 直接扣掉（不进任何人口袋）；`stats.harrierDives` / `harrierScoreBurned` 记账 |
| 俯冲后自身 20 帧 ×0.6 速 | `HARRIER_RECOVER=20`、`HARRIER_RECOVER_SPEED=0.6` |
| 猛禽冲刺中撞到 → 驱逐鸟死亡（不给分），60 帧后质心外 300px 重生 | `HARRIER_HIT_R=16` 判定；给分代码一行未加；`dead=60` → 计时到 0 时 `spawnPoint(方位, 300)` 重生 |
| 非冲刺撞上 → 双方弹开（复用互攻击退几何，不眩晕不扣分） | 复用 `CLASH_KNOCK` 口径（`HARRIER_KNOCK=11`，位置 + 速度各推一把）；不写 `stun`、不写 `score`；`HARRIER_BUMP_CD=30` 防抖 |
| 贼鸥模式（默认开）5%→15% | `HARRIER_SKUA_ON=true`；用 `score` 上涨检测"30 帧内刚得分"（`HARRIER_SKUA_WINDOW=30`），窗口内 `HARRIER_SKUA_BURN=0.15`；`stats`/面板记 `skuaHits` |
| 面板行 + 小地图 + `cbHarrier` + `SIM.harrierInfo/harrierCount` | 计分板后新增「驱逐鸟 战果（W8）」行；小地图青绿点；开关行 `cbHarrier`（默认 checked）；`harrierCount/harrierRoster/harrierInfo/harrierConst/harrierPressure/harrierOn/setHarrier/harrierSkua/setHarrierSkua` |
| handoffDoc 变更记录 | 已追加「变更记录(W8)」含常量清单、接入点、验收数字与 CV 归因 |

新增常量：`HARRIER_N=6 / SPEED=6.0 / MAX_TURN=0.18 / COLOR="90,220,180" / ORBIT_R=90 / ORBIT_W=0.045 / LOCK_FRAMES=60 / RANGE=120 / LAYER_MAX=30 / TURN_PEN=0.02 / DRAIN_PEN=0.03 / DIVE_STUN=12 / DIVE_BURN=0.05 / SKUA_BURN=0.15 / SKUA_WINDOW=30 / RECOVER=20 / RECOVER_SPEED=0.6 / RESPAWN_FRAMES=60 / RESPAWN_R=300 / HIT_R=16 / KNOCK=11 / BUMP_CD=30 / Z=150`。
新增 stats：`harrierDives / harrierScoreBurned / harrierDowns / harrierBumps`。

## 2. 验收数字（4 种子 11/22/33/44 × 4000 帧；固定 LCG 种子配对 A/B）

修订 `4d4eaf1f1fdb270b`（物理修订；其后只追加了 handoffDoc 文本，物理逐位不变——见 §5 哈希复现）

| 种子 | 处理·领先者 | 对照·领先者 | 命中率(全群在 250px 内) | 俯冲 | 撞落 | 弹开 | 贼鸥 | 存活 | 捕获 处理/对照 |
|---|---|---|---|---|---|---|---|---|---|
| 11 | 266.1 | 982.0 | 84.3% | 103 | 4 | 27 | 10 | 4~6 | 86 / 108 |
| 22 | 339.1 | 435.0 | 70.2% | 86 | 8 | 41 | 14 | 4~6 | 131 / 112 |
| 33 | 135.9 | 1042.0 | 73.3% | 82 | 7 | 27 | 7 | 4~6 | 109 / 122 |
| 44 | 123.6 | 876.0 | 93.0% | 124 | 2 | 45 | 9 | 4~6 | 61 / 202 |

- **① 目标命中率**：处理 **80.2%**（任意一只口径 88.1%）→ **✓ ≥70%**
- **② 领先者得分增速**：处理均值 216.2 vs 对照 833.8 → **降 74.1%** → **✓ ≥30%**
- **③ `stats.harrierDives`**：103/86/82/124（合计 **395**）→ **✓ 每种子 ≥3**
- **④ 存活数**：全程 4~6，越界帧 **0** → **✓ 恒 0~6，无负无超**
- 战果合计：蒸发 **3974.0** 分 · 撞落 21 · 弹开 140 · 贼鸥模式 40 次

### ② 的第二个子项「终值 CV 缩小」—— **未达标，如实记录 + 归因**

| 口径 | 处理 | 对照 | 判定 |
|---|---|---|---|
| 终值**方差** σ²（跨种子，领先者） | **8154**（σ 90.3） | **56533**（σ 237.8） | **✓ −85.6%** |
| 终值**方差** σ²（组内三只猛禽，均值） | σ 81.4 | σ 315.8 | **✓ −74%** |
| **CV** σ/μ（组内，均值） | **1.737** | 0.776 | ✗ 变大 |
| **CV** σ/μ（跨种子，领先者） | **0.418** | 0.285 | ✗ 变大 |

归因（结构性，不是随机噪声）：
1. 本机制的核心动作是**按比例蒸发**（`score -= frac·score`）。乘法映射在数学上**保持 CV 不变**，只能把分数整体缩小；
   CV 只可能被"眩晕/能耗"这类行为通道改变，而这两个通道的净效应是把方差和均值一起压小。
2. 实测 μ 从 833.8 → 216.2（**−74%**）、σ 从 237.8 → 90.3（**−62%**）：**μ 掉得比 σ 快**，于是 σ/μ 变大。
   字面口径"方差缩小"稳定成立（−74%~−86%），"CV 缩小"在不改规格参数的前提下不成立。
3. 两个 CV 变大的种子（s11/s44）恰好也是猛禽终值被打成**负分**的种子（−1.1 / −23.6 / −55.0）：
   强骚扰（≈40% 时间被眩晕）让领先者反复空冲刺吃罚款，μ 趋近 0 时 CV 爆炸。
4. 未做静默调参：规格给定的 5%/15%、+12 帧、20 帧恢复、+1 层/帧、上限 30 全部按原文实现。

## 3. 声明的设计决定（规格未规定处，均已写进代码注释与 handoffDoc）

1. **层数满 30 后的俯冲节奏**：规格未说层数是否清零。若不减，则只要有就绪个体（恢复期 20 帧）就会逐帧俯冲
   → 每秒十几次，显然不是原意。实现取「俯冲后把目标层数**清零**，重新累积」，于是自然节奏 ≈ 30 帧/次。
2. **出生点**：规格只规定了"重生点在质心外 300px"，出生点未规定。实测教训：速度只比猛禽巡航快 1.0px/帧，
   出生在 300~600px 外时前 450 帧都在追（命中率仅 13.9%）→ 改为**直接落在当前最高分猛禽身边 90px 的环绕环上**。
3. **重生方位**：距离固定 300px，方位未规定 → 取"质心 → 当前点名目标"方向（否则重生后又要追几百帧）。
4. **追击策略**：距离 > 2×环绕半径时走**纯追踪**，进入后才环绕站位（避免绕环浪费脚程）。
5. **转艏上限 0.18 rad/帧**（规格只给了速度）：必胜鸟/贼鸥的现实敏捷度；换目标时要 ~17 帧回头，不是瞬移。
6. **蒸发语义修正**：`score` 为负时"扣 5%"等于回血 → 改为只从正分蒸发。

## 4. 回归与契约

- 三块 `<script>` `node --check`：**全部通过**（4658 / 589 / 393 行）。
- 既有契约未破：`SIM.scores/kills` 前三元素、`SIM.stats`、`SIM.bench`、`raptorCount`、`hunter(i)`、`hunterDetail(k)` 均未改。
- `threats`/`raptors` 数组内容不变 → 鸟群逃逸、互攻、食物网行为不受 harrier 直接污染（只有通过猛禽状态间接影响）。
- 未删任何旧钩子；`cbHarrier` 关掉时该节整段跳过，并把残留压力层清零（对照组口径干净）。

## 5. 物理哈希（固定种子，可复现）

`node _w6w9/t3_physhash.mjs "掠食竞赛(4).html" 11 4000`（修订 `2a418a0d36c00f0a`，与验收修订物理一致）：

- 驱逐鸟 **开**：`physicsHash=2919ae1f`，scores=[266.1, 45.0, −1.1]，存活椋鸟 1930
- 驱逐鸟 **关**：`physicsHash=f2183ea6`，scores=[54.0, 157.0, 982.0]，存活椋鸟 1905

（两臂与 §2 的种子 11 结果逐一相同 → 证明 handoffDoc 追加文本未动物理。）

## 6. 并发写者提醒

T1/T2 在本次施工期间也在改同一文件（期间文件从 5845 → 4658+ 行两度变动）。
本任务所有改动都走 `_w6w9/main.lock`（一次等待 97s 后成功），每次编辑后立刻 `node --check` 三块。
本报告的验收数字绑定在修订 `4d4eaf1f1fdb270b` 上；若 T1/T2 之后再改物理，T3 的验收需重跑（命令见 §2 开头）。
