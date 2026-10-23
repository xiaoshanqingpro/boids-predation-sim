# 掠食竞赛-3d 合并施工 Prompt（转交实现 Agent）

## 0. 任务定义

- **交付物（源）**：`掠食竞赛-3d.html` —— 在"第 7 轮 掠食竞赛.html"（含 WebGPU 计算后端原型、加入鹰/隼按钮、个体收小）之上完成的三维化改造，三个 <script> 块已通过 node --check。
- **目标**：把这份改造**整合进你手上的版本**。若你的版本已有新变更，**以你的版本为基线**，按下述清单把改造按子系统移植过去；若你的版本就是第 7 轮原样，直接采用交付物即可，重点跑第 5 节验收。
- **铁律**：先完整读源文件和本 prompt 再动手；禁止重开炉灶；禁止"整体替换文件"式合并（见第 4 节）。

## 1. 核心架构（不可违背的三条）

1. **xy 不动、z 分裂**：P/V/ACC/PV 保持每只 2 个 float 的交错布局一行不改；z 轴走独立数组（椋鸟 `Z/VZ: Float32Array(MAXN)`，雁 `Z2/VZ2: Float32Array(M)`）。网格哈希、perceive 捞勺、WebGPU 计算后端（只算 xy 力）、2D 俯视渲染、golden 物理哈希因此全部原样保留。
2. **守恒验收线**：`GRAV_ON=false` 且俯视视图时，**与改造前逐位一致**。任何合并损伤了这条，就是合并错了。
3. **渲染三路径共存**：GL3D（WebGL2 透视+深度+雾）/ CPU 软投影兜底 / 旧 2D 全路径（?view=top、?render=2d 仍可用）。3D 模式**不用** ping-pong 屏幕残影（相机转动会糊片）。

## 2. 改造清单（按子系统，源文件中均有"第 8 轮"注释锚点）

| # | 子系统 | 改动 |
|---|---|---|
| 1 | 参数区 | `Z_INIT/Z_SPREAD/G_GRAV/ALT_SPRING/FLOOR_Z/FLOOR_PUSH/CLIMB_RATE/DIVE_RATE/DIVE_BOOST/GROUND_MARGIN` 常量 + `GRAV_ON` 开关 + `zMeanLive` |
| 2 | 状态 | Z/VZ/Z2/VZ2 数组；尸体池（CORPSE_CAP=384 环形，cX..cT）；`trailBuf` 升 3 分量，`trailPush(o,x,y,z)` |
| 3 | 工厂/初始化 | makeFalcon/makeEagle 加 `z/vz/targetZ(-1=保持)`；initStarlings/initGeese/resetPredators 补 z 初值；spawnRaptor 随机高度 |
| 4 | 椋鸟物理 | stepRest 开头算群体均高（O(N)）；6.4 加 `az`（逃逸垂直分量：高于猛禽往上、低于往下）→ z 积分（重力−均高弹簧+近地推升）；EAT 判 3D 球；被吃 spawnCorpse；`stepCorpses()` 挂 6.4 之后 |
| 5 | 雁物理 | 最近猛禽记 `nz`；`gooseFleeZ()`（混乱/让位两处复用）；z 积分（重力×0.8 + 朝领队层弱弹簧）；EAT 3D |
| 6 | 感知/决策 | perceive 累加 `sumZ` → `PC.z`（视野均高）；`tryDash(f,tx,ty,lockIdx,tz)` 升 3D（重力版航向夹角，不传 tz 时 dz=0 与旧 2D 等价）；`inCone3()` 锥轴随领队垂直速度倾角（失血/能耗用 3D 锥；perceive 打分仍用 2D 近似——已知取舍，保留注释） |
| 7 | 鹰（6.6） | 动作选目标同时选 `tzp`（雁 z/pc.z/对手 z）；冲刺起跳带垂直初速；冲刺中受重力+俯冲红利+近地拉起；非冲刺 z 转向（爬升慢/俯冲快）；trailPush 传 z |
| 8 | 隼（6.8） | perceive 后 `f.targetZ=pc.z`；冲刺 `effDash=DASH_SPEED+max(0,-vz)·DIVE_BOOST`；三处 tryDash 调用传 `pc.z/rv.z`；非冲刺 z 转向；trailPush 传 z |
| 9 | 相机/投影 | `perspM/lookAtM/mulM`（column-major）+ `updateCamera()`（目标平滑跟随质心+均高，auto 公转）+ `project()`（俯视退化为恒等；输出 x,y,s 近大远小,f 雾,ok 视锥）+ `camInput`（拖拽/滚轮）+ `toggleView()`；`VIEW3D`（?view=top 可关） |
| 10 | 叠加层 | drawHunter 整体重写为投影版（返回 {x,y,s,f} 或 null）；renderOverlay 整体重写（威慑锥扇形投影、编队线投影、涟漪投影、**尸体 3D 点**、标签/能量条按 s 缩放、f 调透明度）；新增 `renderSoft3D()` 兜底；`render()` 改按 VIEW3D 分发，`ovClear` 控制叠加层是否清屏 |
| 11 | GL 后端 | 新增 VS_BIRD3/FS_BIRD3（实例=pos+vel，速度建正交基定向，vFog 距离雾）；初始化 3D 资产（prog3/fbo3+DEPTH_COMPONENT16/instVBO3/star3Buf）；`has3D()`/`draw3D(s,vpM)` 方法；**context opts depth:true**；**2D draw() 每帧重设 aUnit 指针**；draw3D 收尾 disable A3 三个属性槽（防与 2D 程序槽位冲突） |
| 12 | 面板/按键 | 开关区加 重力(cbGravity)/自动环绕(cbAuto)；控制区加 隼±/鹰±（⇧F/⇧E）、切换俯视(T)/复位视角；T/⇧F/⇧E 键；鹰可减到 0（refreshPanel/renderQ/SIM 全部守卫，Q 表画"无鹰"） |
| 13 | SIM | `view3D/setView3D/gravity/setGravity/removeFalcon/removeEagle/corpses/cam`；starling/goose/hunter/leader 返回值加 z/vz |

## 3. 合并顺序（不可交换）

1. 参数与状态层 → 2. 物理层（椋鸟→雁→猛禽）→ 3. 感知/锥/tryDash → 4. 相机投影层 → 5. 渲染层（drawHunter→overlay→render）→ 6. GL 后端 3D → 7. 面板/按键/SIM → 8. 交接说明。

**理由**：物理层不依赖渲染，先合完 1–3 即可用 golden 验收守恒线；GL 放最后，因为属性槽位冲突这类坑必须在 2D 路径稳定后再接。每步合并后跑 `node --check`，别攒到最后。

## 4. 冲突高发点（按此处理，不许擅自取舍）

1. **整体重写的三个函数**（drawHunter/renderOverlay/render）：若你的版本改过它们（新增可视化/新实体），把新增内容**移植进投影版**（套 project() + s/f 缩放），禁止用旧版反向覆盖。
2. **GLBackend 是对象字面量**：方法级合并（插入 has3D/draw3D + init 内 3D 资产块），禁止整 IIFE 替换。
3. **keydown/refreshPanel 多分支**：逐条并入，注意 ⇧F/⇧E 与旧 F/E 的分支结构。
4. **若你的版本 xy 数组已不是 2-stride**（例如已做过别的升维）：**停下来报告**，给出你的存储布局 + 两套映射方案，等决策，禁止硬套本改造。
5. 你的版本若改了 perceive 签名或 stepRest 结构：先适配适配层再移植第 6/7/8 项，冲突语义写进交付摘要。

## 5. 验收（逐条在浏览器实跑，附控制台证据）

1. `node --check` 三个 script 块全过。
2. 默认 3D 视角：三维鸟群渲染、拖拽/滚轮/自动环绕生效，雾效可见。
3. **守恒线**：关重力 + T 切俯视，行为与改造前一致（有 _checks 就跑 golden，物理哈希必须不变）。
4. 重力开：隼俯冲时冲刺速度 > 8.5（stoop 红利）；尸体下坠落地消散；椋鸟群悬浮不落地；雁保持分层。
5. 编制：隼减到 1、鹰减到 0 时面板不崩、Q 表显示"无鹰"、`SIM.scores` 对缺员返回 0；⇧F/⇧E 与面板四键等价。
6. `?view=top` 与 `?render=2d` 两种兼容模式正常；WebGPU 计算（?compute=gpu）自检仍通过（xy-only，3D 视角下可用）。
7. SIM 钩子逐试：`setGravity/setView3D/removeFalcon/removeEagle/cam/corpses`，`hunter(i).z` 有值。

## 6. 防赖账条款

- 第 5 节每项都必须实跑；没验的项明确写**"未验证"+原因**，禁止默认证过。
- 合并中出现语义冲突（你的新功能 × 本改造），停下手，列冲突点 + 两个候选方案，**不擅自取舍**。
- 已知取舍必须原样保留并在交接说明里写明：3D 无群体残影拖尾；威慑锥打分 2D 近似（失血判定 3D）；环面模式仍是 2D 语义（z 不穿屏）。
- 最终交付：合并后的单文件 + 变更摘要（哪些直接搬运 / 哪些人工合并 / 冲突如何处理 / 验收证据）。摘要里禁止出现"应该没问题"。
