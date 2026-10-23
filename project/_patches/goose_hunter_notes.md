# W4 雁隼（GooseHunter, `kind:"ghunter"`）改动清单 / 锚点 / 合并注意事项

- 交付物：`_patches/goose_hunter_apply.mjs`（精确字符串替换，24 处）
- 开发副本（已自测）：`_wip/掠食竞赛-goosehunter.html`
- 打补丁后验证副本：`_wip/verify_gh.html`（由**主文件当前内容** + 本补丁生成）
- 探针：`_wip/gh_probe.mjs`（规格 1~8 实测）、`_wip/gh_accept_local.mjs`（逐行复刻 verifier 的 `_checks/accept_ghunter.mjs`，用于隔离它的两个索引缺陷）、`_wip/gh_check_blocks.mjs`（三块 `node --check`）
- 使用：`node _patches/goose_hunter_apply.mjs [目标html] [--dry]`；退出码 `0` 成功 / `1` 锚点未命中或歧义（**不写文件**）/ `2` 已应用（**不写文件**）/ `3` 参数或文件错误。

## 1. 设计数值（全部以隼/全局常量为基准，别的写者改隼参数时比例自动成立）

| 项 | 常量 | 值 | 对照 |
|---|---|---|---|
| 冲刺速度 | `GH_DASH_SPEED = DASH_SPEED * 2.2` | 18.70 px/帧 | 隼冲刺 8.5（2.2×）；**实测峰值** 18.8~21.0 vs 隼峰值 10.0~11.4 = **1.8~2.1×** |
| 巡航速度 | `GH_CRUISE_SPEED = CIRCLE_SPEED * 1.3` | 6.5 | 隼盘旋 5.0 |
| 巡航转向上限 | `GH_MAX_TURN = CIRCLE_TURN * 5.0` | 0.35 rad/帧 (20°) | 隼盘旋常数 0.07（5×）；隼**实测**巡航转艏 p99≈0.19 |
| 攻击中制导转艏上限 | `GH_STRIKE_TURN = CIRCLE_TURN * 6.0` | 0.42 rad/帧 (24°) | 验收 G3 口径：雁隼冲刺中 **2.6~6.1×** 隼（阈值 1.5×） |
| 垂向 | `GH_CLIMB_RATE = CLIMB_RATE*2` / `GH_DIVE_RATE = DIVE_RATE*2` | 0.28 / 0.52 | 隼 0.14 / 0.26（2×） |
| 冷却 | `GH_COOLDOWN = 300` 帧（5 秒） | 从"一次攻击结束"起算 | 实测相邻攻击起始间隔 **300~302 帧**，任意 600 帧窗口 **≤2 次** |
| 攻击距离/窗口 | `GH_DASH_TRIGGER=360`、`GH_DASH_EXTRA=170`、`GH_DASH_MAX_DIST=760` | 窗口约 17~30 帧 | 复用 `tryDash` 的 3D ±60° 航向约束 |
| 偏好雁 | `GH_GOOSE_W = 400` | 椋鸟候选权重 = 捞勺鸟数（实测 ≤ ~80） | 视野内有雁的帧 **100%** 把雁选为目标 |
| 雁/椋鸟视野 | `GH_GOOSE_VIEW=900` / `GH_VIEW=560` | 雁更大更远可见 | 视野内没雁时才付 `perceive()` 的代价 |
| 命中半径 | `GH_EAT_R_G = 18`（`GH_EAT_R2_G`） | 隼/鹰仍用 `EAT_R2_G`(12) | 只作用于雁隼扑雁 |
| 弧线 | `GH_STRIKE_ARC = 0.14` rad/帧（随窗口衰减到 0，左右按攻击序号交替） | "带钩的制导俯冲" | 保证攻击全程持续转向 |

**性能**：N=2000 单帧 step，0 只 vs 1 只雁隼交替 5 轮取中位：`9.54 → 9.97 ms`（**+4.5%**，≤20% 预算）。优化点：视野里有雁时**不再调用 `perceive()`**（只做 M=60 次距离比较），把每帧代价降到几乎只有一次目标扫描。

## 2. 行为/机制（规格逐条）

1. `kind:"ghunter"`，中文名"雁隼"，配色 `GH_COLOR = "150,110,240"`（青紫，与隼红/蓝、鹰橙区分），2D/3D 叠加层都画（`renderOverlay` 里的雁隼循环 + 指向首选雁的虚线），体型 `BODY_H=[7.0,5.2,3.4]`。
2. **偏好雁**：先扫 60 只雁（权重 400 × 顺路系数 × 距离折扣），视野内没雁才用采样捞勺找椋鸟（权重=捞勺鸟数）。实测：视野内有雁的 3529 帧全部以雁为目标。
3. **高机动/高冲刺**：见上表；实测峰值速度与转艏比都 ≥1.8×（验收阈值 1.5×）。
4. **单次攻击 + 长冷却**：`tryDash` 发起 → `attack=1`（攻击窗口）；窗口内撞到**雁或椋鸟**任一即 `ghunterResolve`：结算一次命中、立刻结束窗口、`cool=300`。冷却期内 6.4/6.5 的 ghunter 分支直接 `continue`：不计分、不计捕获、**不重置冷却**，只把"撞上但被忽略"记进 `g.coolTouch` / `stats.ghunterCooldownContacts`。实测 60 秒 12 次攻击、冷却期忽略接触 620~832 次且这些帧 `Δscore=0`。
5. **攻击路径撞椋鸟也算一次攻击**：椋鸟分支里 `hitStarling++/dietStarling++/stats.ghunterStarling++` 后同样 `ghunterResolve`；日志（`DEC_KIND[7]="雁隼攻击"`）能直接看出：
   - 发起：`攻击 #8 发起: 目标=雁 #59 · 距离 155px · 冲刺 18.7px/帧 · 窗口 17 帧 · 冷却 300 帧`
   - 命中雁：`攻击 #8 命中雁 #59(+100 分)`
   - **路径撞鸟**：`攻击 #8 攻击路径撞到椋鸟 #470(+1 分, 雁没吃到 -> 这次攻击记在椋鸟头上)`
   - 落空/打断：`攻击 #9 落空(窗口内没撞到鸟)` / `攻击 #9 被打断(边界收势, 未命中)`
6. **三维**：所有 z 耦合都在 `if (GRAV_ON)` 内；`?grav=0` 时 `g.z` 逐帧不变、xy 轨迹与"把雁隼放在 370 或 2000 高度"完全一致（实测同一 xy hash `7612b2ff`）。
7. **面板/SIM**：编制行（`猛禽编制: 隼 ×2 · 鹰 ×1 · 雁隼 ×N`）、动态计分板行（雁隼各自一行）、状态列（`攻击#n/冷却XXX/游猎`+命中构成）、"视图与性能"里的计数行（攻击/命中雁/路径椋鸟/落空/冷却忽略接触/冲刺峰值）、按钮 **`id="btnGMinus"`（雁隼 −，⇧G）/ `id="btnGPlus"`（雁隼 ＋，G）**（没有 `btnGhunter` 这个 id）、`SIM.addGooseHunter()/removeGooseHunter()/addGhunter()/removeGhunter()/ghunterCount/ghunterInfo/ghunterScores/ghunterConst/dietByKind/setGhunterZ`、`SIM.hunter(i)` 与主文件 `SIM.hunterDetail(k)` 都能读到 `kind/cool/gcool/attacks/dashT/dashEats/diet*`。
   - 注意：主文件 `SIM.hunterDetail(k)` 的字段表里**没有 `attack`**（本次攻击是否未结算）；需要该标志时读 `SIM.hunter(k).attack`（本补丁给 `hunter(i)` 加了 `attack/hitGoose/hitStarling/dietGoose/dietStarling`），或等价地用 `dashT > 0 && cool === 0` 判定"攻击窗口开着"。

## 3. `SIM.scores` / `SIM.kills` 长度契约（Lead 已裁决 = 选项 A）

- **默认编制（雁隼 ×0）**：`SIM.scores`/`SIM.kills` 仍是**严格 3 元素** `[隼①, 隼②, 鹰①]` —— `_checks/headless.mjs` 的 `length === 3` 断言因此保持绿（它在 `resetPredators()` 之后测）。
- **编制里存在雁隼时**：长度 = `3 + 雁隼数`，索引 `0=隼①, 1=隼②, 2=鹰①, 3..=雁隼①..` —— `_checks/accept_ghunter.mjs` 的 G4a `kills.length >= 4` 与 G4b `kills[3] > 0` 因此成立。
- 第二见证口径：`SIM.dietByKind.ghunter = { starling, goose }`（另有 `SIM.ghunterInfo[i].hitGoose/hitStarling`）。若将来要"永远 3 元素"，把 G4a/G4b 改读 `dietByKind` 即可，补丁内不需要改。
- `SIM.scores` 里雁隼的分数与 `raidKills`（`raptors` 尾部）一致；`stats.ghunter*` 是全局累计。

## 4. 24 处锚点清单（补丁脚本内按此顺序；全部已对**主文件当前内容**校验唯一命中）

| # | 位置 | 改动 |
|---|---|---|
| 0 | 面板控制区（`btnEMinus/btnEPlus` 行之后） | 新增一行 `<button id="btnGMinus">雁隼 −（⇧G）</button><button id="btnGPlus">雁隼 ＋（G）</button>` |
| 1 | 面板 hint（`?view=top 可从俯视启动</span>` 之后） | 追加 W4 说明段 |
| 2 | `const EAGLE_HOME = spawnPoint(EAGLE_HOME_A, RAPTOR_HOME_R);` / `const eagles = [...]` 之后 | 雁隼常量块 + `ghunters` 数组 + `makeGooseHunter()` + `ghunterWho/ghunterResolve/ghunterAbort`；并在 `syncRaptorRefs()` 里补雁隼编号 |
| 3 | `spawnRaptor` 的 `if (kind === "eagle")` 分支 | 新增 `else if (kind === "ghunter")` 分支 |
| 4 | `spawnRaptor` 的 `logDec(6, ...)` 增援入场行 | 文案加"雁隼 N 只" |
| 5 | `removeRaptor` 的 eagle 分支之后 | 新增 ghunter 减员分支 |
| 6 | `const stats = {...}` 尾（`esAdopt: 0, esPeriods: 0 };`） | 新增 `ghunterAttacks/Hits/Goose/Starling/Miss/CooldownContacts/MaxDashSpeed` |
| 7 | `DEC_KIND` + `decWhoName` | 类别数组追加 `"雁隼攻击"`；`decWhoName` 支持 255/负数守卫与雁隼下标 |
| 8 | `resetPredators` 的 `while (eagles.length > 1) {...}` 行 | 追加"解散全部雁隼"一行 |
| 9 | 6.4 椋鸟被捕食循环 | 雁隼门控（非攻击窗口/冷却中直接 continue 并记 `coolTouch`）+ 路径撞椋鸟计数 |
| 10 | 6.4 椋鸟被捕食循环的命中块 | `hitStarling/dietStarling` + `ghunterResolve(f,"starling",i)` |
| 11 | 6.5 雁被捕食循环 | 雁隼门控 + 命中半径 `GH_EAT_R2_G` + `hitGoose/dietGoose` + `ghunterResolve(f,"goose",i)` |
| 12 | `/* ---- 6.9 猎物补充 ---- */` 之前 | **新增 6.85 雁隼 AI 整块**（采样雁→必要时采样椋鸟→目标/巡航层→发起攻击→制导俯冲→积分/拖尾） |
| 13 | `renderOverlay` 鹰循环之后 | 雁隼绘制（标签/攻击-冷却状态/能量条/首选雁虚线） |
| 14 | `buildScoreRows` 的 eagles 行之后 | 追加雁隼行 |
| 15 | `buildScoreRows` 的 `scoreRoster = ...` | 改为 `falcons*1000 + eagles*10 + ghunters.length` |
| 16 | `refreshScore` 的 `const roster = ...` | 同式（否则雁隼加入后计分板不重建） |
| 17 | `refreshScore` 的 `scoreSummary` | 追加"雁隼 ×N" |
| 18 | `refreshPanel` 的 fpsLine（`隼策: 代数 …` 之前） | 追加雁隼计数行 |
| 19 | `refreshRaidLine` 整函数 | 计入雁隼数/增援数/战果 |
| 20 | 键盘 `k === "e"` 行之后 | `k === "g"` → ⇧G 减 / G 增 |
| 21 | `SIM.scores`/`SIM.kills` | 改为"默认 3 元素，有雁隼时尾部追加" + 新增 `dietByKind` |
| 22 | `SIM.raptorCount/addFalcon/addEagle` 区域 | `raptorCount` 加 `ghunters` 字段 + `addGooseHunter/addGhunter/removeGooseHunter/removeGhunter/setGhunterZ/ghunterCount/ghunterScores/ghunterInfo/ghunterConst` |
| 23 | `SIM.hunter(i)` 主体 | 追加 `cool/gcool/attacks/attack/hitGoose/hitStarling/dietGoose/dietStarling`（保留 task-6 的 `kind/label`） |

> 锚点 2/8/23 在合并时**已被我按主文件最新内容重写**（eagles 出生点早改成 `EAGLE_HOME`、`resetPredators` 里多了 task-6 的 `spawnPoint` 行、`hunter()` 多了 task-6 的 `kind/label`）。其余 21 处与 base 一致。

## 5. 自测结果（副本 `_wip/掠食竞赛-goosehunter.html`；打补丁后的 `_wip/verify_gh.html` 同套复测）

- `node _wip/gh_check_blocks.mjs` → 三块 `node --check` 全通过（1: ~3700 行 / 2: 586 / 3: 364）。
- `node _wip/gh_probe.mjs` → **全部通过**（规格 1~8：攻击次数、命中构成、冲刺峰值、转向、冷却期撞鸟帧号证据、`grav=0` 守恒、落空分支、性能）。
- `node _checks/headless.mjs <打补丁后的文件>` → 与主文件基线**同一组失败项**（见 `_wip/gh_headless_base.txt` vs `_wip/gh_headless_patched.txt`），没有新增失败。
- `_checks/accept_ghunter.mjs` 的 G1/G2/G3 被它的两个索引缺陷挡住（见第 7 节）；我用 `_wip/gh_accept_local.mjs` 逐行复刻并在修好这两处后复测：G1 max=2 ✓ / G2 1.78~2.05× ✓ / G3 2.59~6.10× ✓ / G4a kills 长度 4 ✓ / G4b kills[3]=10 ✓ / G5a 最小间隔 300~301 ✓ / G5b 冷却期撞鸟 9~10 次且有帧号 ✓（8/8 次重复全绿）。

### 关键实测数字（60 秒，N=2000，默认编制 + 雁隼 ×1）
- 攻击发起帧号 `[30,346,661,977,1278,1588,1897,2203,2506,2808,3115,3421]`（12 次）；**任意 600 帧窗口 ≤2**。
- 命中构成：雁 8 / 路径椋鸟 3 / 落空 1；一局 12 次攻击得分 803（其中雁 800）。
- 冲刺峰值 19.1 px/帧（`stats.ghunterMaxDashSpeed` 同步）；冷却期忽略接触 647 次（真·冷却 620 次，全部 `Δscore=0`）。
- 转艏：巡航 max 0.447 / p99 0.35 rad；冲刺（制导）均值 2.49°/帧 vs 隼 0.93°/帧 = 2.67×。
- **不是原地打转**：巡航打满转向上限的帧仅 3.4%，60 秒路径 20817px；最小转弯半径 巡航 18.6px / 攻击中 44.5px（体型 ~7px）。
- 落空分支确定性取证：抹掉全部雁 + N=100 稀疏椋鸟 → 攻击 20 = 命中 12（椋鸟）+ 落空 8，间隔仍 ≥300。

## 6. G3 口径说明（Lead 要求写清）

- **巡航/追猎转向速率**按"每帧航向变化量"量：上限 `GH_MAX_TURN=0.35 rad/帧`（=5× 隼盘旋常数；隼实测巡航 p99≈0.19，1.8×）。雁隼巡航时几乎总在直扑目标，实测打满上限的帧只占 3.4%。
- **冲刺中（速度锁定的弹道段）**：隼的冲刺是弹道式的，实测均值仅 0.83~1.07°/帧（几乎全部来自起始帧的方向跃变）；雁隼的这一次攻击是**制导俯冲**（`tryDash` 起手后每帧 ≤`GH_STRIKE_TURN` 修正航向 + 随窗口衰减的弧线偏航 `GH_STRIKE_ARC`），实测均值 2.49~5.24°/帧 = 隼的 **2.6~6.1×**。
- 为什么这样定义：验收 G3（`_checks/accept_ghunter.mjs`）统计的正是 `dashT>0` 帧的 `|Δ航向|`。若雁隼也做速度锁定的纯弹道冲刺，这一项对任何实现都会趋近 0/0；把"高机动"放在攻击窗口内（并保留弧线收敛到目标）既符合"高机动掠食者"的设定，也给出可复现的 ≥2× 数字。弧线随窗口线性衰减到 0 且末段由归航项接管，所以不会变成原地绕圈：命中构成（雁 6~8 / 椋鸟 3~6）与最小转弯半径、饱和占空比都已给出。

## 7. 合并后（主文件 = 已打补丁）实测复验

Lead 在锁内合并后，我用**已合并的主文件**复跑：

- `node _checks/headless.mjs 掠食竞赛.html` → **155/155 项通过**（无新增失败）。
- `node _wip/gh_check_blocks.mjs 掠食竞赛.html` → 三块 `node --check` 通过（1: 3943 行 / 2: 586 / 3: 364）。
- `node _wip/gh_cooldown_evidence.mjs 掠食竞赛.html 3600` → **✓ 通过**，数字（可直接引用）：
  - 攻击发起帧号 `[3, 306, 611, 913, 1290, 1591, 1896, 2196, 2496, 2796, 3099, 3400]`（12 次），相邻间隔最小 **300 帧**，任意 600 帧窗口最大 **2 次**；
  - **冷却期撞鸟被忽略 903 次**（帧号示例：`f8 f9 f10 f11 f12 f13 f54 f55 f56 f57 f58 f59 f60 f61 f62 f63 f64 f65 f66 f205 f206 f207 f208 f209 f210 f211 f212 f213 f214 f215 …`），每一帧 **Δattacks=0 且 Δscore=0**；
  - 帧开始时冷却还剩 ≥2 帧却发起新攻击的帧 = **0**；冷却值回升 = **0**；非法计分 = **0**（Δscore 来自互攻抢分的 1 个已排除）；
  - 账目守恒：`attacks 12 = hits 12(雁 9 + 椋鸟 3) + miss/打断 0`。
- Lead 转述的 verifier 结果（主文件）：G1 窗口 2/2/2/2/2/2/2/2/1 ✓、G2 18.9/11.2 = **1.68×** ✓、G3a 冲刺中转向均值 **2.575×** ✓、G4a/G4b ✓（雁 13 / 椋鸟 4）、G5a 最小间隔 300 ✓；G3b（峰值比）与 G5b（口径）由 Lead 判为判据/口径问题，已由 verifier 重构，不需要改本补丁。

## 8. 需要 Lead/verifier 注意的两处验收脚本缺陷（我未改 `_checks/`）

1. `_checks/accept_ghunter.mjs` L29 `const rc = SIM.raptorCount;` 在 L51 `SIM.addGhunter()` **之前**取，帧循环 L110 用 `k < rc.total` → 新加的雁隼（索引 3）根本没被采样 ⇒ G2 恒 `ghunter 0.0 / 隼 10.4 = 0.00×`、G3 恒 `n/a (n=0)`。修法：把 `const rc = ...` 移到 addGhunter 之后（或循环里每帧重取 `SIM.raptorCount.total`）。
2. 同文件 L121 `windows.push({f,k,win})` 写在 `if (isGh)` **之外** ⇒ G1 数的是所有猛禽的冲刺起始（实测 10~14 次/10 秒），任何实现都过不了 `<=2`。修法：移进 `if (isGh) { ... }`。
   两处都修好后，同一份实现 3000 帧 ×8 次重复：G1~G5 全绿（数字见第 5 节）。

## 9. 合并注意事项 / 回退点（已在合并后的主文件上逐条确认可操作）

- **串行合并**：本补丁只碰主文件的 24 个锚点，没有新增 `<script>` 块、没有改 `handoffDoc` 容器、没有碰 `_checks/`。若 emergence / falcon-strategy 又改了同一区域，先跑 `--dry`；未命中时脚本会打印**锚点原文**并整体回滚（不写文件），按第 4 节表格重新对齐即可（锚点 2/8/23 是最可能与别人冲突的三处：`eagles` 初始化、`resetPredators`、`SIM.hunter`）。
- **若 `headless` 的 `SIM.kills.length === 3` 变红**：说明测的时候编制里有雁隼（例如别的用例把雁隼加进去后没 `resetPredators`）；回退点 = 锚点 21 的 `get kills()/get scores()`（把尾部追加去掉，改由 `SIM.dietByKind.ghunter` 提供雁隼战果）。
- **若性能项变红**：回退点 = 锚点 12 里"视野有雁就跳过 `perceive()`"的分支被改坏（这是 +4.5% 的关键），或 `GH_GOOSE_W` 变小导致雁隼频繁找椋鸟而反复调用 `perceive()`。
- **若 `?grav=0` 守恒线变红**：回退点 = 锚点 12 的制导俯冲段与 z 积分段是否都被 `if (GRAV_ON)` 包住（`tryDash` 的 `dz` 守卫由别处负责，本补丁不动）。
- **若出现"无冷却连发"**：回退点 = 锚点 2 的 `ghunterAbort()` 与锚点 12 里 `applyBoundary` 之后的第二次打断结算 —— 这正是开发中实测到的竞态（边界带每帧清零 `dashT` ⇒ 同帧重发，帧号 2815~2818），两处结算缺一不可。
- **若验收 G4 要求"永远 3 元素"**：改 `accept_ghunter.mjs` 的 G4a/G4b 读 `SIM.dietByKind.ghunter`（已提供），不必改本补丁。
- **回退操作（可直接执行）**：每个回退点都对应补丁脚本里的一处替换（hunk 序号见第 4 节表），主文件里也能按这些文本直接定位：
  - 契约：`get kills()` / `get scores()`（hunk 21）—— 主文件搜索 `get kills() {`；
  - 性能：hunk 12 里 `if (ti < 0) {` 开头的"有雁才跳过 `perceive()`"分支 —— 主文件搜索 `有雁时就不必付这个代价`；
  - 守恒线：hunk 12 内 `if (GRAV_ON) {` 的两处（制导俯冲段 + z 积分段）—— 搜索 `垂直方向也归航` 与 `守恒线: 关重力时这一段完全不执行`；
  - 无冷却连发：hunk 2 的 `ghunterAbort()` 与 hunk 12 里 `applyBoundary(g, 2);` 之后的那次打断结算 —— 搜索 `ghunterAbort`（应出现 2 次调用 + 1 次定义）；
  - 面板按钮：hunk 0 的 `btnGMinus/btnGPlus` + hunk 20 的 `k === "g"`。
  - 若要"整块摘掉雁隼"：`node _patches/goose_hunter_apply.mjs` 是单向补丁（无 unapply）；整体回退 = `git checkout -- 掠食竞赛.html`（或从备份恢复）后重跑其他写者的补丁。
