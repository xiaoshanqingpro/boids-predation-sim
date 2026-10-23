
"use strict";

/* ============================================================================
 * 掠食竞赛 —— 两个版本的整合体
 * ----------------------------------------------------------------------------
 * 种群(4 方, 各有各的"智能"层次):
 *   1. 椋鸟 N 只:  拓扑 boids —— 每只只与最近的 K 只互动(不是半径内全部),
 *                  凝聚/对齐/分离 + 逃逸, 没有领头的, 秩序纯靠局部规则涌现。
 *   2. 雁群 M 只:  领队制 V 编队, 每只有固定槽位(角色记忆); 危险时编队让位
 *                  给逃逸, 危险过后自动重组。椋鸟的对照组。
 *   3. 隼 ×2:      本能 + 协作。能量轮换(一只追猎、一只设伏), 设伏方高速赶往
 *                  "拦截位", 冲刺受 ±60° 航向约束。
 *   4. 鹰 ×1:      Q-learning 在线学猎物偏好(追椋鸟 / 追雁 / 游荡伏击 /
 *                  攻击竞争者), 巡航比隼快、冲刺比隼弱。
 *   计分: 椋鸟 +1, 雁 +100, 三方竞赛。猛禽之间还会互攻驱遂(见 6.9)。
 *
 * 反制机制(第 2 轮新增): 空冲刺扣分(A) · 代谢成本(B) · 椋鸟围攻 mobbing(C)
 *   · 冲刺锁定/迷惑(D) · 鹰隼互攻(E) —— 让"一头扎进鸟群"不再是免费午餐。
 * 第 4 轮: 猛禽改用采样目标获取(80 个极坐标候选点 + 方向滞后 + LOCK_R 锁定);
 *   雁群中心化重构(领队智能/轮值 apex/幼雁内道/威慑锥/斩首混乱);
 *   隼的 (1+1)-ES 在线策略进化(与鹰的 Q-learning 并存); 雁借椋鸟惊飞网预警。
 *   细节与常量表见文末交接说明的"第 4 轮之一~之五"五节。
 *
 * 几何(两版整合的关键取舍, 可用「环面」开关切换):
 *   默认 = 开阔世界: 视口 1280×720 之外还有 170px 缓冲带, 出界只受柔和的
 *          边界力, 没有穿屏瞬移 —— 鸟能飞出画面、猛禽会跟丢。
 *   可选 = 环面 torus: 世界就是视口大小, 四周穿屏, 所有相对向量走 minImage。
 *   两种模式下几何运算统一走 wrapX/wrapY/minImageX/minImageY, 互不干扰。
 *
 * 感知: 猛禽没有全局视野。perceive() 只统计视野半径内的椋鸟(网格桶预筛 +
 *       逐只精确判距)与最近的雁; 视野空时靠成员记忆(freshMem)继续搜索。
 *
 * 每帧顺序: 网格 -> 椋鸟力扫描 -> 迁徙 -> 椋鸟积分/被捕食/逃逸/围攻 -> 雁 ->
 *           鹰(Q-learning) -> 隼(能量轮换) -> 自动补充 -> 鹰隼互攻 -> 渲染。
 * ========================================================================== */

/* ------------------------------ 0. 世界与几何 ------------------------------ */

const VIEW_W = 1280, VIEW_H = 720;   // 视口(画布)尺寸 —— 只管画布/投影, 与"世界"无关
// 【第 8 轮修正⑥】世界尺寸与视口**解耦**: 鸟的活动范围不再是"视口 ± 缓冲带", 而是整个世界。
// 边界不是墙, 是一圈"厌恶值": 进入 BOUND_R 带内就开始自主转向远离, 越近越强(二次增长),
// 因此个体永远不会被硬夹在边上(wrapX/wrapY 里原来的 clamp 已经删掉)。
const W = 3200, H = 2200;            // 世界尺寸(≈2.5×2.9 个视口)
const BOUND_R = 420;                 // 边界厌恶半径(进入这个带内开始转向)
const PAD_OPEN = 170;                // 网格额外边距(不再代表世界边界)
const MAXN = 20000;               // 椋鸟数组预分配上限(任务0 基准要跑到 N=20000)
let   N = 2000;                   // 当前椋鸟数
const M = 60;                     // 雁数(须为偶数, V 形左右臂对称)
let   PAD = PAD_OPEN;             // 当前缓冲带(环面模式为 0)
let   TORUS = false;              // false = 开阔世界(软边界), true = 环面(穿屏)
let   GW = 1, GH = 1;             // 网格桶数量

/* ------------------------------ 1. 参数区 ------------------------------ */

const TAU = Math.PI * 2;

// ---- 椋鸟: 拓扑 boids ----
// G: 收紧鸟群 —— 凝聚压过对齐(COHESION 2.0 > ALIGNMENT 1.2), 允许更近身位
//    (SEP 20), 转向更有力(MAX_FORCE 0.15), 感知/网格桶缩到 50。K 仍为 7。
// 第 7 轮: 再收紧两档 —— 分离半径 20->11, 感知/桶 50->36(候选数不会因变密而爆炸), 
//    个体体积同步缩小(见 BODY 常量), 于是"鸟与鸟之间"看起来近了一倍。
const PERCEPTION = 36.0;                 // 候选收集半径(再从中取最近 K 只)
const PERCEPTION_R2 = PERCEPTION * PERCEPTION;
const CELL = PERCEPTION;                 // 网格桶边长(recomputeGridSize 自动跟随)
let   topoK = 7;                         // 拓扑邻居数 K(滑杆可调, 上限 TOPO_MAX)
const TOPO_MAX = 16;
const SEP_R2 = 11.0 * 11.0;              // 分离触发半径(第 7 轮: 20 -> 14 -> 11)
const SEP_GAIN = 4.0;                    // 距离加权分离: 越近推得越狠
const MAX_SPEED = 3.6;
const MAX_FORCE = 0.15;
const COHESION_W = 2.0, ALIGNMENT_W = 1.2;
const CENTROID_FORCE = 0.015;            // 极弱质心引力, 防永久碎裂(散得太开时提到 0.025)
const MIGRATE_FORCE = 0.06;              // 迁徙倾向, 把群体拉成流动飘带
const ALERT_TRIG = 0.5;
const REFRACT = 30;
const CONT_W = 4;
const RELAY_MIN = 0.15;
const ALERT_FRAMES = 12;
const ALIGN2_W = 0;
const ANISO = 0;

/* ---- 第 7 轮: 个体体积再收小一档(2D 与 WebGL 两条渲染路径共用同一组数字) ----
 * drawArrow(x, y, vx, vy, 尖端, 尾长, 翼展); GL 那边用 glScene.shapes 的同一组值。 */
const BODY_S = [1.6, 1.0, 1.0];          // 椋鸟(原 2.2 / 1.4 / 1.4)
const BODY_G = [2.1, 1.2, 1.3];          // 雁  (原 3.2 / 1.8 / 2.0)
const BODY_F = [4.8, 4.0, 2.6];          // 隼  (原 6.5 / 5.5 / 3.6)
const BODY_E = [5.5, 4.4, 3.0];          // 鹰  (原 7.5 / 6.0 / 4.2)
/* ---- 【task-6 W1b】边界厌恶: 饱和 + 平滑 + "削朝外速度"为主 -------------------
 * 实测问题: 旧式 F = BOUND_FORCE·k·pen²·9 (猛禽 k=2, pen=1.10 时峰值 5.9 px/帧², 而椋鸟
 * MAX_FORCE 只有 0.15) —— 个体在边界附近被"弹开", 观感是软墙, 不是自主转向。
 * 现在: ① 力饱和到 ≤ BOUND_F_MAX(px/帧²), 二次 ramp 平滑趋近上限;
 *       ② 主手段改成"削掉朝外速度分量": 比例从 BOUND_CUT_LO 升到 1.0(贴边时朝外分量
 *          被完全削掉 -> 沿边切向滑走), 力只负责柔和转向;
 *       ③ 冲刺期速度锁定, 削速度也改不了航向 -> 用边界预测(boundPredOut)在发起前否掉、
 *          在冲刺中提前收势;
 *       ④ 数值兜底收紧到"世界外 BOUND_FALLBACK", 触发即计入 boundClamp 供验收。 */
const BOUND_FORCE = 0.30;                // 边界厌恶力系数(pen² 的系数, 未饱和)
const BOUND_F_MAX = 0.60;                // 厌恶力饱和上限(px/帧²) —— 硬上限, 防"软墙"
const BOUND_CUT_LO = 0.35;               // 朝外速度削减比例下限(pen→0)
const BOUND_CUT_K = 2.0;                 // 削减比例的 ramp 倍率: pen ≥ 1/K(离边 210px) 时饱和到 1.0
const DASH_BOUND_LOOK = 45;              // 冲刺边界预测帧数上限
const DASH_BOUND_MARGIN = 90;            // 预测预警余量(px): 冲刺整条直线路径都留在世界边内这么多
const BOUND_FALLBACK = 60;               // 数值兜底: 真的跑到世界外这么多才硬夹(触发即计数)

// ---- 捕食与计分 ----
// F: 个体与判定一起缩小 —— 视觉尺寸, 判定圈同步收(9/12 而非 12/15)
const EAT_R2_S = 9 * 9;                  // 椋鸟被吃半径
const EAT_R2_G = 12 * 12;                // 雁被吃半径
const SCORE_STARLING = 1, SCORE_GOOSE = 100;

// ---- 逃逸(鸟对猛禽) ----
const FLEE_R2 = 110.0 * 110.0;
const FLEE_FORCE = 0.45, FLEE_W = 2.2;

// ---- 隼: 能量轮换 + 拦截位 ----
const CIRCLE_SPEED = 5.0;                // 盘旋速度
const DASH_SPEED = 8.5;                  // 冲刺速度(爆发型)
const REST_SPEED = 7.5;                  // 设伏方赶路速度(快于盘旋, 保证赶到)
const CIRCLE_FRAMES = 110;               // 两次冲刺间至少盘旋的帧数
const CIRCLE_TURN = 0.07;                // 盘旋时每帧转向角
const DASH_EXTRA = 180.0;                // 冲刺时长 = (距离+余量)/速度
const DASH_MAX_DIST = 500;               // 冲刺距离上限(防止横穿整个世界)
const DASH_MAX_ANGLE = Math.PI / 3;      // 冲刺方向与当前航向最大夹角 60°
/* ---- task-3: 冲刺瞄准与俯冲放宽 -------------------------------------------
 * 实测(5000 帧 / N=2000 / 无补充 / 关补充): 隼冲刺 57 次, 其中 dashEats=0 的 54 次(96%) ——
 * 冲刺几乎抓不到东西, 账面"每次冲刺捕获 1.9 只"其实全是巡航时撞进鸟云被动吃到的。
 * 原因: D 锁定后"冲刺期间只吃得到被锁定那一只", 而瞄的是**捞勺中心的当前**位置。
 * 试过三种"更聪明"的瞄准(瞄锁定个体当前位置 / 一阶比例导引前置解 / 拦截解), 3 种子 5000 帧下
 * 冲刺内吃到东西的比例 0.19 -> 0.13 -> 0.12/0.06, 全部更差, 已回退; 也试过"出手距离门限"
 * (锁定目标 >300px 不出手), 空冲刺次数 -12% 但命中率与捕获数无改善, 一并回退。
 * 结论: 冲刺命中率低不是瞄准问题, 是"D 锁定 + 9px 吃判 + 直线冲刺"的结构问题(见交接说明的
 * 待决项: 扫掠吃判 / 冲刺途中制导), 不在本轮写域内。 */
/* ---- task-3: 冲刺后的恢复期(节奏) —— 测过, 不需要改 -------------------------
 * 疑点: 每次冲刺结束都 f.circleT = CIRCLE_FRAMES = 110 定值, 会不会形成"冲刺→盘旋→再冲刺"
 * 的机械节律? 实测(5 种子 × 5000 帧, 池化 253 个间隔): mean=187.8 sd=98.7 CV=0.53 ——
 * 间隔早就不是定值: 110 只是下限, 上面还叠了冲刺时长、夹角不合格的 8 帧重试、接棒/眩晕。
 * 也试过给恢复期加"私有 LCG 抖动 + 疲劳项"(不碰全局随机流): 池化 CV 0.53 -> 0.52, 没有改善;
 * 按"落回 100~180 帧旧节拍带的比例"看 70% -> 41% 确实松了, 但 CV 被长尾主导, 指标不动。
 * 数据不支持, 已回退 —— 本轮不动 CIRCLE_FRAMES 与能量代谢参数(它们在 2D 路径上也会生效,
 * 保住守恒线不变更划算)。 */
const ENERGY_MAX = 100;
const DASH_DRAIN = 0.55;
const ACTIVE_REGEN = 0.40;
const REST_REGEN = 0.90;
const ENERGY_LOW = 25;                   // 低于此值退出追猎, 交棒
const DASH_MIN = 35;                     // 发起冲刺所需最低能量
const DOUBLE_TEAM_E = 85;                // 设伏方能量高于此且距密集点近 -> 偶发双打
const INTERCEPT_GAIN = 0.35;             // 向拦截位靠拢的力度(转向上限)
const INTERCEPT_MIN = 90;                // 距拦截位小于此值则原地绕圈等待
const INTERCEPT_AHEAD = 0.55;            // 拦截位 = 质心沿"远离追猎方"方向外推的比例
const VIEW_FALCON = 420.0;
const VIEW_FALCON_R2 = VIEW_FALCON * VIEW_FALCON;

// ---- 鹰: 体格 + Q-learning ----
const EAGLE_CRUISE = 5.8;                // 巡航比隼快: 耐力型, 靠长距离追猎耗死雁
const EAGLE_DASH = 7.2;                  // 冲刺比隼弱(隼 8.5)
const EAGLE_DASH_FRAMES = 18;
const EAGLE_DASH_CD = 60;
const EAGLE_DASH_TRIGGER = 140;
const AMBUSH_LEAD = 45;                  // 伏击点沿群体行进方向外推的帧数
// 决策纪元: 选定的动作保持这么多帧再重抽(1 = 逐帧重抽, 与原行为完全一致)。
// 试过 =20: 能让"追雁"这种要几百帧的动作真正被执行, 个别种子上 Q 表能拉开差距
// (例如 雁近行 11.5 vs 3.7), 但 4 粒种子的通过率没有改善(2/4 -> 2/4), 因为
// 逐帧探索噪声虽多, 却补偿了决策数; 默认回到 1, 想试就改成 20。
const EAGLE_DECIDE_EVERY = 1;
const VIEW_EAGLE = 520.0;                // 鹰飞得高看得远
const VIEW_EAGLE_R2 = VIEW_EAGLE * VIEW_EAGLE;
const Q_ALPHA = 0.1, Q_GAMMA = 0.995;    // 学习率 / 折扣因子(每帧)
// 注意 Q_GAMMA 是"每帧"折扣: 追一次雁要几百帧, 所以必须接近 1(0.995 -> 半衰期
// 约 140 帧)。原版用 0.95(半衰期 14 帧), 信用在几步内就衰减光了, 长程追猎
// 根本学不出来, Q 表退化成噪声 —— 这是整合时修掉的一个真问题。
const EPS0 = 0.3, EPS_MIN = 0.08, EPS_DECAY = 0.9995;
// 状态 = (猎物类型 0椋鸟/1雁) × (距离档 0近/1中/2远) = 6 态, 加 1 个"视野全空"态
const STATE_NONE = 6;
const N_STATES = 7, N_ACTIONS = 4;
// E: 动作表扩到 4 —— 0追椋鸟密集处 1追最近雁 2游荡伏击 3攻击竞争者(最近的隼)
//    Q 索引用 state*N_ACTIONS+a, 切忌再写字面量 *3。

// ---- 雁群: 领队制 V 编队 ----
const MAX_SPEED_G = 4.4;                 // 雁比椋鸟快: 靠速度 + 编队 + 预警自保
const LEADER_SPEED = 4.0;
const SLOT_SPACING = 15;
const SLOT_FORCE = 0.14;
const FORMATION_BREAK = 150.0;           // 猛禽接近到此距离, 编队解散逃逸
const GSEP_R2 = 10 * 10;

/* ---- 新增机制常量(本次 A~E) ----------------------------------------
 * 惩罚/代谢、围攻、迷惑、互攻四套机制共用; 只扣 score, 不动 kills/diet。 */
// A: 空冲刺扣分 —— 冲刺一下什么也没吃到就罚分(隼重、鹰轻)
const MISS_PENALTY_FALCON = 4;
const MISS_PENALTY_EAGLE = 2;            // 学习被新机制淹没 -> 按规格建议从 3 降到 2
// B: 代谢成本(每帧) —— 盘旋/冲刺/鹰巡航都要烧能量, 让"不动的伏击"也有代价
const METAB_CIRCLE = 0.002;
const METAB_DASH = 0.010;
const METAB_EAGLE = 0.003;
// C: 围攻(mobbing) —— 一部分椋鸟是"围攻者", 靠近猛禽就结成骚扰环
const MOB_FRACTION = 0.08;               // 椋鸟里围攻者的比例
const MOB_R = 170;                       // 围攻者的响应半径
const MOB_HARASS = 55;                   // 骚扰环半径: 环外逼近、环内推开
const MOB_MAX = 0.05;                    // 骚扰转向力上限
const MOB_DRAIN_PER = 0.04;              // 每只围攻者让冲刺能耗增加的比例
const MOB_PENALTY_N = 25;                // 同一帧内围攻者数 >= 此值 -> 冲刺被硬生生打断
const MOB_SLOW_FALCON = 0.6;             // 非冲刺速度下限(隼)
const MOB_SLOW_EAGLE = 0.7;              // 非冲刺速度下限(鹰)
// D: 迷惑效应 —— 冲刺锁定单个目标, 冲刺期间只吃得到"被锁定那一只"
const DASH_LOCK = true;
// E: 鹰隼互攻(驱逐制) —— 靠太近就分胜负, 输的眩晕/被击退/扣分并被抢分
const CLASH_R = 34;                      // 触发互攻的距离
const CLASH_STUN = 90;                   // 败方眩晕帧数
const CLASH_KNOCK = 11;                  // 败方被击退的距离
const CLASH_COST = 10;                   // 败方扣分
const STEAL_FRAC = 0.2;                  // 胜方抢走败方剩余分数的比例
const CLASH_CD = 45;                     // 同一对猛禽的互攻冷却(否则会逐帧连环扣分)
const RIVAL_R = 150;                     // 隼启动"驱逐冲刺"的对手距离

/* ---- 第 4 轮新增常量 --------------------------------------------------
 * 第一部分: 猛禽采样目标获取(极坐标捞勺) · 第二部分: 雁群中心化重构
 * 第三部分: 隼的 (1+1)-ES 策略进化 · 第四部分: 雁借用椋鸟网的惊飞预警 */

// 1. 采样目标获取: 以猛禽为原点的极坐标候选点, 统计每个点"捞勺"里的鸟数
const SAMPLE_RADII = [80, 160, 240, 320, 400];   // 采样环半径
const SAMPLE_ANGLES = 16;                        // 每环角度数(共 5×16 = 80 个候选)
const SCOOP_R = 60;                              // 捞勺半径: 候选点周围多少 px 内的鸟被计入
const SCOOP_R2 = SCOOP_R * SCOOP_R;
const LOCK_R = 40;                               // 锁定半径: 冲刺中心这么多 px 内最近的鸟被锁
const LOCK_R2 = LOCK_R * LOCK_R;
const DIR_LAG = 0.3;                             // 方向滞后: score *= 1 + DIR_LAG·cos(候选方向, 当前航向)
const N_CAND = SAMPLE_RADII.length * SAMPLE_ANGLES;

// 2. 雁群中心化重构
const LEADER_SENSE_R = 400;                      // 领队感知猛禽的半径
const LEADER_MAX_TURN = 0.04;                    // 领队转向限速(弧度/帧)
const ESCAPE_HUSTLE = 1.15;                      // 威胁 250px 内领队速度倍率
const LEADER_PANIC_R = 250;
const GOOSE_MAX_TURN = 0.06;                     // 每只雁的转向限速(弧度/帧, 压坡惯性)
const ROTATE_FRAMES = 1200;                      // 轮值领队周期(20 秒)
const JUVENILE_FRAC = 0.25;                      // 幼雁比例(固定占内道槽位)
const JUVENILE_DEBUFF_FRAMES = 1800;             // 幼雁死亡后的沮丧期
const DEBUFF_FACTOR = 0.7;                       // 沮丧期内全体归位力倍率
const CONE_R = 180;                              // 威慑锥半径(V 尖为顶点)
const CONE_HALF_ANGLE = Math.PI / 3;             // 威慑锥半角 60°(正面 120°)
const CONE_COS = Math.cos(CONE_HALF_ANGLE);
const CONE_SCORE_FACTOR = 0.25;                  // 锥内候选点打分乘项(选目标自己绕开正面)
const CONE_FALCON_DASH_MULT = 2;                 // 锥内隼的冲刺能耗倍率
const CONE_EAGLE_DRAIN = 0.01;                   // 锥内鹰每帧 pending 失血
const DISARRAY_FRAMES = 90;                      // 斩首后的混乱期(槽位力关闭)

// 3. 隼的 (1+1)-ES 在线进化
const ES_EVAL_FRAMES = 3600;                     // 一个评估期 60 秒(适应度噪声大, 期长配对比较)
const ES_SIGMA = 0.1;                            // 候选参数 = 当前 + N(0, σ), 截断到 [0,1]
const ES_MISS_WEIGHT = 2;                        // 适应度里落空罚款的权重
const ES_METAB_WEIGHT = 5;                       // 适应度里代谢成本的权重
const P_DASH_MIN = [20, 60, 35];                 // p1 出手能量阈值 [下界, 上界, 默认]
const P_ENERGY_LOW = [10, 40, 25];               // p2 交棒能量阈值
const P_DOUBLE_TEAM = [60, 95, 85];              // p3 双打能量阈值
const P_INTERCEPT = [0.3, 0.8, 0.55];            // p4 拦截位外推比例
const P_MOB_TOL = [0, 2, 1.0];                   // p5 mob 容忍(乘在 DASH_DRAIN 的 mob 项上)
const ES_NP = 5;                                 // 可学习参数个数(p6 线性冲刺策略留作扩展位, 见交接说明)

// 4. 雁借用椋鸟网的惊飞预警
const PV_ALERT_COS = 0.5;                        // 惊飞判据: 相邻两帧速度夹角 > 60°(cos<0.5)
const ALERT_R = 140;                             // 雁查惊飞椋鸟的半径
const ALERT_R2 = ALERT_R * ALERT_R;
const ALERT_N = 3;                               // 半径内惊飞椋鸟 >= 3 -> 视同猛禽逼近
const ALERT_FALSE_R = 400;                       // 判定"误报"的半径(最近猛禽比这还远)

// ---- 感知记忆 / 自动补充 / 拖尾 ----
/* ---- 第 8 轮: 三维化 + 重力 ----
 * 架构: xy 保持现有交错数组(P/V/ACC/PV 每只 2 个 float)一行不动 —— 网格/perceive/
 * WebGPU 计算/2D 俯视/golden 哈希全部原样保留; z 轴独立数组(Z/VZ), 重力与定高弹簧
 * 只作用于 z。2D 俯视(GRAV_ON 关掉时)与旧版逐位一致, 3D 只是渲染+z 动力学的增量。 */
const Z_INIT = 170;                    // 初始飞行高度
const Z_SPREAD = 150;                  // 初始高度散布(云团厚度; 第 8 轮调大 -> Z 变化更明显)
const G_GRAV = 0.060;                  // 重力 px/帧²(椋鸟/雁由定高弹簧对抗; 猛禽俯冲吃红利)
const ALT_SPRING = 0.011;              // 定高弹簧: 朝个人飞行层的回复力, 与重力平衡 -> 悬浮云团
const ALT_DAMP = 0.90;                 // 垂向阻尼(第 8 轮修正): 没有它 vz 会无阻尼振荡 -> 上下波动
const ZT_SPREAD_K = 0.45;              // 个人飞行层散布 = Z_SPREAD × 该系数(云团厚度靠它永久保留)
const FALCON_LAYER_OFF = 110;          // 隼巡航时高于鸟群均高多少(俯冲时才下到猎物层)
/* ---- task-3: 隼的巡航/进猎高度策略 ---------------------------------------
 * 原写法 f.targetZ = pc.lockZ + 110·clamp((dPrey-200)/300) 与紧随其后的"压机头"互为反号命令:
 * 只要高过 lockZ+40, stoopT 就**每帧都被重置成 10**(压机头永不结束), 于是一路俯冲到 lockZ;
 * 落进 40px 内后 stoopT 才衰减, targetZ 又要爬回 lockZ+110 —— 形成 30 帧级的上下极限环
 * (实测: 巡航 |Δz|/帧=0.80、vz 反向 64.5 次/千帧、z-鸟群均高的方差 1207)。
 * 修法: ① 把"要去的层"做成一阶低通, lockZ 抖动与层间跳变被时间常数吸收;
 *       ② 俯冲相只在"确实比目标层高出 FALCON_STOOP_DZ"时点一次火, 不再逐帧续期。 */
const FALCON_HUNT_R = 200;             // 水平距离小于此值 -> 层差开始衰减(回到猎物层)
const FALCON_LAYER_RAMP = 300;         // 层差从 0 涨满所需的额外水平距离(200 -> 500px)
const FALCON_ALT_SLEW = 0.06;          // 目标层一阶低通系数(时间常数 ≈ 17 帧)
const FALCON_STOOP_DZ = 55;            // 高于目标层这么多 -> 触发一次俯冲相(压机头 10 帧)
const FALCON_ALT_LEAD = 12;            // 垂向控制器的前瞻帧数(用 z + LEAD·vz 做被控量, 消掉欠阻尼振荡)
const EAGLE_LAYER_OFF = 80;            // 鹰巡航空层差
// 【第 8 轮修正③】吃判是否用 3D 球。默认 false(只按水平面判定):
// 2D 版是靠"水平面上的高密度"撞鸟的(冲刺扫过 9px 管道, 密集鸟群里必中);
// 云团一厚 250px, 同样管道里的鸟就少约 4 倍 —— 实测总捕获 77 -> 19, 比例正好对上。
// 置 true 恢复"3D 球"(更真实, 捕食率掉到约 1/4)。面板勾选或 SIM.setEat3D(on) 可切。
let   EAT_3D = false;
const Z_CEIL = Z_INIT + Z_SPREAD * 1.4;   // 鸟能主动爬到的高度上限(个人飞行层的活动范围)
const FLOOR_Z = 0;                     // 地面
const FLOOR_PUSH = 0.35;               // 近地推升力(活鸟不落地, 尸体除外)
const CLIMB_RATE = 0.14, DIVE_RATE = 0.26;   // 猛禽垂直速率限幅(爬升慢/俯冲快)
const DIVE_BOOST = 0.16;               // 俯冲红利: 冲刺速度 += max(0,-vz)·DIVE_BOOST(游隼 stoop)
const GROUND_MARGIN = 30;              // 猛禽近地拉起高度(不许俯冲撞地)
const GOOSE_LAYER = 280;               // 雁的绝对稳定层(z) —— 明显高于椋鸟云团(≈Z_INIT)
// 第 8 轮调优: 三维里按世界单位画 1.6px 的鸟在 950px 视距下只有零点几像素 -> 看不见。
// 这里把三维体积放大, 并给"远处不再变小"的最小像素保护; 只影响渲染, 不动物理。
let   SIZE3D_MUL = 4.0;                // 三维体积倍数(SIM.setSize3D 可调)
const SIZE3D_MINPX = 1.15;             // 远处最小像素保护阈值
// 第 8 轮之三: 三维鸟拖尾(速度拖尾条, 不是历史点折线 —— 更省且转向不糊)
let   TRAIL3_ON = true;                // 开关(面板勾选 / SIM.setTrail3)
let   TRAIL3_LEN = 6.5;                // 拖尾长度 = 速度 × 该系数(帧)
let   TRAIL3_W = 0.5;                  // 拖尾横向宽度相对体型
let   TRAIL3_ALPHA = 0.42;             // 头部透明度(尾部渐隐到 0)
let   GRAV_ON = true;                  // 重力总开关(面板勾选, 关掉即退化为旧 2D 行为)
try { if (/[?&]grav=0/.test(window.location.search)) GRAV_ON = false; } catch (e) { /* headless */ }   // 守恒线: 必须在首次初始化前就能关重力
let   zMeanLive = Z_INIT;              // 群体实时均高(相机跟踪用)
let   zLowLive = FLOOR_Z, zHighLive = Z_INIT + Z_SPREAD;   // 高度范围(三维亮度映射用)

const MEM_FRAMES = 300;                  // 看不见猎物时, 记忆点有效期(帧)
const REFILL_RATIO = 0.35;               // 椋鸟存活低于此比例 -> 补一波
const REFILL_G_RATIO = 0.5;              // 雁存活低于此比例 -> 补回编队
const REFILL_CHECK = 300;                // 每多少帧检查一次
const TRAIL_LEN = 50;

/* ------------------------------ 2. 工具函数 ------------------------------ */

const clamp = (x, lo, hi) => x < lo ? lo : (x > hi ? hi : x);

// 环面最小像: 开阔世界里是恒等映射, 环面时把相对坐标折回 [-W/2, W/2]
const minImageX = d => TORUS ? d - W * Math.round(d / W) : d;
const minImageY = d => TORUS ? d - H * Math.round(d / H) : d;
  // 位置收拢: 环面取模; 开阔世界**不再夹取** —— 边界由 applyBoundary 的厌恶力处理,
  // 位置本身保持自由(网格索引在 cellOf 里夹取, 越界也不会越数组)。
  const wrapX = x => TORUS ? ((x % W) + W) % W : x;
  const wrapY = y => TORUS ? ((y % H) + H) % H : y;

const angDiff = (a, b) => {
  let d = (a - b + Math.PI) % TAU;
  if (d < 0) d += TAU;
  return d - Math.PI;
};

// Box-Muller 高斯采样, 让初始群体成团而非均匀撒布
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function recomputeGridSize() {
  GW = Math.max(1, Math.ceil((W + 2 * PAD) / CELL));
  GH = Math.max(1, Math.ceil((H + 2 * PAD) / CELL));
  allocGrid();
}

/* 【第 8 轮修正⑥ + task-6 W1b】边界 = 厌恶值(不是墙), 三件事拆开做:
 *   ① boundAversion(): 内向单位法线 n + 侵入度 pen(1 - 最近边距/BOUND_R, 世界外时 >1) +
 *      **饱和**后的力 F ≤ BOUND_F_MAX·k(二次 ramp: BOUND_FORCE·k·pen², 到顶就平) +
 *      "朝外速度削减比例" cut ∈ [BOUND_CUT_LO, 1](削速度是主手段, 力只管柔和转向);
 *   ② applyBoundary(o,k): 对象版(猛禽) —— 先削朝外分量、再加力, 然后做**冲刺边界预测**
 *      (冲刺期速度锁定, 力/削减都改不了航向: 预测会出界就把 dashT 收到 1, 下一帧走正常
 *       的"冲刺结束"流程, 不破坏落空罚款/锁定解除等既有账目);
 *   ③ boundAccel(): 数组版(椋鸟/雁) —— 返回 [nx, ny, F, cut], 调用方自己作用。
 * 数值兜底收紧到"世界外 BOUND_FALLBACK(60px)", 触发即计入 boundClamp; 出生点已保证在
 * 世界内, 正常永不触发。所有个体都是"自己转开", 不会贴边/撞边。 */
let boundClamp = 0, boundPeak = 0, boundMinEdge = Infinity;

// 边界厌恶核心: 返回 [nx, ny, F, cut]; null = 不在厌恶带内。k = 力倍率(椋鸟/雁 1, 猛禽 2)
function boundAversion(x, y, k) {
  if (TORUS) return null;
  const dl = x, dr = W - x, dt = y, db = H - y;
  let nX = 0, nY = 0, pen = 0;
  if (dl < BOUND_R) { const u = 1 - dl / BOUND_R; nX += u; if (u > pen) pen = u; }
  if (dr < BOUND_R) { const u = 1 - dr / BOUND_R; nX -= u; if (u > pen) pen = u; }
  if (dt < BOUND_R) { const u = 1 - dt / BOUND_R; nY += u; if (u > pen) pen = u; }
  if (db < BOUND_R) { const u = 1 - db / BOUND_R; nY -= u; if (u > pen) pen = u; }
  const e = Math.min(dl, dr, dt, db);
  if (e < boundMinEdge) boundMinEdge = e;
  if (pen <= 0) return null;
  if (pen > boundPeak) boundPeak = pen;
  const m = Math.hypot(nX, nY) || 1;
  const p = Math.min(pen, 1);                                     // pen>1(世界外)时不再加码
  const F = Math.min(BOUND_F_MAX * k, BOUND_FORCE * k * p * p);   // 二次 ramp + 饱和
  const pc = Math.min(p * BOUND_CUT_K, 1);                        // 削减比例: pen ≥ 0.5 起恒为 1.0
  return [nX / m, nY / m, F, BOUND_CUT_LO + (1 - BOUND_CUT_LO) * pc];
}

/* 【task-6】边界预测: 按 (vx,vy) 直行 look 帧后是否冲进"世界内 LR 余量"的带内/带外。
 * 冲刺速度每帧被重设(锁定), 力与削速度都改不了航向 -> 必须在发起前否掉, 或冲刺中提前收势。 */
function boundPredOut(x, y, vx, vy, look, LR) {
  if (TORUS || !(look > 0)) return false;
  const x1 = x + vx * look, y1 = y + vy * look;
  return x1 < LR || x1 > W - LR || y1 < LR || y1 > H - LR;
}

function applyBoundary(o, k) {
  if (TORUS) return;
  const av = boundAversion(o.x, o.y, k);
  if (av) {
    const nX = av[0], nY = av[1];
    const vOut = o.vx * nX + o.vy * nY;             // <0 = 正在朝外飞
    if (vOut < 0) { const cut = -vOut * av[3]; o.vx += nX * cut; o.vy += nY * cut; }
    o.vx += nX * av[2]; o.vy += nY * av[2];         // 削减为主, 力只补柔和转向
  }
  if (o.dashT > 0) {                                // 冲刺边界预测: 会出界 -> 提前收势
    const L = Math.min(o.dashT, DASH_BOUND_LOOK);
    if (boundPredOut(o.x, o.y, o.vx, o.vy, L, DASH_BOUND_MARGIN)) o.dashT = Math.min(o.dashT, 1);
  }
  // 数值兜底: 只有真的跑到世界外 BOUND_FALLBACK 才硬夹(出生点修好后正常永不发生)
  if (o.x < -BOUND_FALLBACK || o.x > W + BOUND_FALLBACK || o.y < -BOUND_FALLBACK || o.y > H + BOUND_FALLBACK) {
    o.x = clamp(o.x, -BOUND_FALLBACK, W + BOUND_FALLBACK);
    o.y = clamp(o.y, -BOUND_FALLBACK, H + BOUND_FALLBACK);
    boundClamp++;
  }
}

// 数组版(椋鸟/雁): 返回 [nx, ny, F, cut], 调用方自己作用到加速度/速度上
function boundAccel(x, y, k) { return boundAversion(x, y, k || 1); }

const freshMem = o => frame - o.memT < MEM_FRAMES;

/* --------------------- 3. 种群状态与初始化 --------------------- */

// ---- 椋鸟: 紧凑数组布局(预分配到 MAXN, 滑杆改 N 不需要重新分配) ----
const P = new Float32Array(MAXN * 2);
const V = new Float32Array(MAXN * 2);
const ACC = new Float32Array(MAXN * 2);
const alive = new Uint8Array(MAXN);
const isMobber = new Uint8Array(MAXN);    // C: 该鸟是不是"围攻者"(开局按概率抽取)
const PV = new Float32Array(MAXN * 2);    // P4: 上一帧速度(惊飞判据用)
const startled = new Uint8Array(MAXN);    // P4: 本帧是否惊飞(必须在覆盖 PV 之前算出来)
const Z = new Float32Array(MAXN);         // 第 8 轮: 高度(z 轴, 与 xy 解耦)
const VZ = new Float32Array(MAXN);        // 第 8 轮: 垂直速度
const ZT = new Float32Array(MAXN);        // 第 8 轮修正: 每只鸟的"个人飞行层"(初值抽一次, 让云团有厚度)
let aliveCount = 0;
// 死亡涟漪: 定容环形池(旧版是数组 push + render 里 splice, 每帧都在挪内存)
const DEATH_CAP = 512;
const deathX = new Float32Array(DEATH_CAP), deathY = new Float32Array(DEATH_CAP), deathT = new Float32Array(DEATH_CAP);
let deathCursor = 0;
function addDeath(x, y) {
  deathX[deathCursor] = x; deathY[deathCursor] = y; deathT[deathCursor] = 1;
  deathCursor = (deathCursor + 1) % DEATH_CAP;
}

// ---- 雁 ----
const P2 = new Float32Array(M * 2);
const V2 = new Float32Array(M * 2);
const Z2 = new Float32Array(M);           // 第 8 轮: 雁的高度
const VZ2 = new Float32Array(M);
const galive = new Uint8Array(M);
let galiveCount = M;
let leaderAng = 0, Lx = 0, Ly = 0;        // 虚拟领队(位置 = 当前 apex 雁的位置)
// P2: 中心化秩序的状态
let gooseShift = 0;                       // 槽位序号平移量: slot(i) = (i + gooseShift) % M
let leaderIdx = 0;                        // 当前 apex 雁(轮值领队)
let disarray = 0;                         // 斩首混乱期剩余帧数
let gooseDebuff = 0;                      // 幼雁死亡后的沮丧期剩余帧数
const slotRank = new Int16Array(M);       // 槽位 -> 排号(0 = apex)
const slotArm = new Int8Array(M);         // 槽位 -> ±1(左右臂)
let juvCount = 0;                         // 幼雁只数(固定个体: i % 4 === 0)
function isJuvenile(i) { return i % 4 === 0; }   // 25%(M=60 -> 15 只)

// ---- 网格哈希(每帧重建): 经典链表池化, 零分配 ----
// 旧版是 Map<key, number[]> + 每帧新建数百个小数组 -> GC 锯齿。
// 现在: head = Int32Array(GW*GH) 每帧只 fill(-1), next = Int32Array(MAXN) 存同桶后继;
// 插桶 O(1), 遍历走 next 链, 全程定型数组, 没有任何堆分配。
const gridNext = new Int32Array(MAXN);
let gridHead = new Int32Array(1);
let cellOrder = new Int32Array(1), cellOrderN = 0;   // 桶的"首次出现顺序"(= 旧 Map 的插入顺序)
let chainBuf = new Int32Array(MAXN);                 // 逆链成升序用
function allocGrid() {
  const n = Math.max(1, GW * GH);
  gridHead = new Int32Array(n);
  cellOrder = new Int32Array(n);
}
const cellOf = (x, y) =>
  clamp(Math.floor((y + PAD) / CELL), 0, GH - 1) * GW +
  clamp(Math.floor((x + PAD) / CELL), 0, GW - 1);

// ---- 拓扑邻居复用的临时数组(避免每帧分配) ----
const KD = new Float64Array(TOPO_MAX);
const KX = new Float64Array(TOPO_MAX), KY = new Float64Array(TOPO_MAX);
const KJ = new Int32Array(TOPO_MAX);

// ---- 猛禽 ----
// mem: 最后一次"看到猎物"的位置(帧号), 用于开阔世界里继续搜索
// dashEats: 本次冲刺吃到几只(A: 冲刺结束仍为 0 -> 空冲刺罚款)
// mob: 本帧被几只围攻者围住(C)  stun: 互攻败北后的眩晕帧数(E)
// lockIdx: 冲刺锁定的鸟索引(D: 迷惑效应), -1 = 未锁定
// policy: P3 的 (1+1)-ES 策略参数(归一化 [0,1] 存储), 见 esTick()
function makePolicy() {
  return {
    p: new Float64Array([norm(P_DASH_MIN), norm(P_ENERGY_LOW), norm(P_DOUBLE_TEAM),
                         norm(P_INTERCEPT), norm(P_MOB_TOL)]),   // 当前生效参数
    evalP: null,          // 本评估期实际在跑的参数
    isCand: false,        // 本期跑的是候选吗
    baseFit: -Infinity,   // 期初基准适应度(上一期的净值)
    lastFit: 0,           // 最近一次评估期的适应度
    t: 0,                 // 期内已跑帧数
    gen: 0,               // 成功采纳的次数(策略代数)
    periods: 0,
    // 期内累加量(算适应度用)
    score0: 0, miss: 0, metab: 0,
  };
}
function norm(spec) { return (spec[2] - spec[0]) / (spec[1] - spec[0]); }
function denorm(spec, u) { return spec[0] + clamp(u, 0, 1) * (spec[1] - spec[0]); }
// 归一化参数 -> 实际使用值(写进复用对象, 避免每只隼每帧一个对象字面量)
const PVV = { dashMin: 0, energyLow: 0, doubleTeam: 0, interceptAhead: 0, mobTol: 0 };
function policyVals(f) {
  const p = f.policy.evalP || f.policy.p;
  PVV.dashMin = denorm(P_DASH_MIN, p[0]);
  PVV.energyLow = denorm(P_ENERGY_LOW, p[1]);
  PVV.doubleTeam = denorm(P_DOUBLE_TEAM, p[2]);
  PVV.interceptAhead = denorm(P_INTERCEPT, p[3]);
  PVV.mobTol = denorm(P_MOB_TOL, p[4]);
  return PVV;
}
function makeFalcon(color, label, x, y, vx, vy, circleT) {
  return { x, y, vx, vy, z: 140, vz: 0, targetZ: -1, color, label, kind: "falcon",
           energy: ENERGY_MAX, dashT: 0, circleT, dashEats: 0, lockIdx: -1, stoopT: 0,
           mob: 0, stun: 0, clashCd: 0,
           policy: makePolicy(),
           trailBuf: new Float32Array(TRAIL_LEN * 3), trailN: 0, trailHead: 0,   // 第 8 轮: 3D 拖尾
           shock: null, seeing: false,
           memX: x, memY: y, memT: -1e9, score: 0, kills: 0, pending: 0 };
}
/* 第 7 轮: 鹰也变成工厂 + 数组, 这样"加入鹰"按钮可以随时增援(每只鹰有自己独立的 Q 表) */
function makeEagle(x, y, label) {
  return { x, y, vx: 0, vy: 0, z: Z_INIT, vz: 0, targetZ: -1, kind: "eagle",
           color: "255,190,60", label: label || "鹰 EAGLE",
           score: 0, kills: 0, pending: 0, seeing: false,
           dietStarling: 0, dietGoose: 0,
           eps: EPS0, Q: new Float32Array(N_STATES * N_ACTIONS),
           lastState: 0, lastAction: 0, curState: STATE_NONE, curAction: 2,
           hold: 0, holdState: STATE_NONE, holdAction: 2,
           dashT: 0, cool: 0, dashEats: 0, lockIdx: -1, stoopT: 0,
           mob: 0, stun: 0, clashCd: 0,
           trailBuf: new Float32Array(TRAIL_LEN * 3), trailN: 0, trailHead: 0,   // 第 8 轮: 3D 拖尾
           shock: null,
           memX: x, memY: y, memT: -1e9 };
}
/* 【task-6】出生点: 以"当前鸟群质心"为基准的极坐标方位, 并保证完全落在世界内。
 * W1 把世界与视口解耦(1280×720 -> 3200×2200)之后, 旧代码的 W/2、-40、H+40、W*0.7
 * 这些"旧世界边角"假设会让猛禽出生在离鸟群 ~1100px 的世界边缘(甚至世界外 35px):
 * 视野只有 420px 的隼根本找不到猎物, 生态被打断(实测总捕获 0)。
 * 现在: 质心 ±300px 的错开方位(隼①正上 / 隼②正下 / 鹰斜向 / 雁另一侧), 出生即在视野内。
 * 注意 flockCenter() 在模块求值期(椋鸟还没出生)会退化成世界中心, 开局由 resetPredators()
 * 用真实质心再摆一次位。 */
const SPAWN_MARGIN = 130;                      // 出生点离世界四边至少留这么多(> DASH_BOUND_MARGIN)
function flockCenter() {
  let sx = 0, sy = 0, c = 0;
  for (let i = 0; i < N; i++) if (alive[i]) { sx += P[2*i]; sy += P[2*i+1]; c++; }
  return c ? { x: sx / c, y: sy / c } : { x: W / 2, y: H / 2 };
}
// 质心为原点、方位角 ang、半径 r 的点(先夹到世界内, 环面模式再取模)
function spawnPoint(ang, r) {
  const c = flockCenter();
  return { x: wrapX(clamp(c.x + Math.cos(ang) * r, SPAWN_MARGIN, W - SPAWN_MARGIN)),
           y: wrapY(clamp(c.y + Math.sin(ang) * r, SPAWN_MARGIN, H - SPAWN_MARGIN)) };
}
const FALCON_HOME_A = -Math.PI / 2, FALCON_HOME_B = Math.PI / 2;   // 隼① 正上 / 隼② 正下
const EAGLE_HOME_A  = Math.PI * 0.28;                             // 鹰: 斜向, 与两只隼错开
const GOOSE_HOME_A  = Math.PI * 1.15;                             // 雁群: 另一侧, 免得开局就撞上猛禽
const RAPTOR_HOME_R = 300, GOOSE_HOME_R = 300;                    // 离质心的距离(隼视野 420px)
const F0_HOME = spawnPoint(FALCON_HOME_A, RAPTOR_HOME_R);
const F1_HOME = spawnPoint(FALCON_HOME_B, RAPTOR_HOME_R);
const falcons = [
  makeFalcon("235,70,70",  "隼① FALCON",   F0_HOME.x, F0_HOME.y, 0,  CIRCLE_SPEED, 30),
  makeFalcon("70,150,255", "隼② FALCON-2", F1_HOME.x, F1_HOME.y, 0, -CIRCLE_SPEED, 200),
];
let activeId = 0;                          // 当前追猎方; 其他人设伏 + 恢复

// 鹰: Q 表在线学习猎物偏好; pending 累积"本帧吃到的分", 帧末回流给 Q 更新
// (eagles[0] 就是原来的"鹰", 面板 Q 表热力图与 SIM.Q/eps 都指向它, 保证既有契约不变)
const EAGLE_HOME = spawnPoint(EAGLE_HOME_A, RAPTOR_HOME_R);
const eagles = [makeEagle(EAGLE_HOME.x, EAGLE_HOME.y, "鹰 EAGLE")];
let eagle = eagles[0] || null;                 // 【第 8 轮修正】原为 const 别名: 鹰减到 0 再补一只后,
                                               // 它仍指向"已被移除的那只", 于是 Q 表热力图/部分钩子读到死对象。
function syncRaptorRefs() {
  eagle = eagles[0] || null;                   // 让别名始终指向当前第一只鹰
  falcons.forEach((f, i) => f.label = "隼" + (CN_NUM[i] || ("#" + (i + 1))) + " FALCON" + (i > 0 ? "-" + (i + 1) : ""));
  eagles.forEach((E, i) => E.label = "鹰" + (CN_NUM[i] || ("#" + (i + 1))) + " EAGLE" + (i > 0 ? "-" + (i + 1) : ""));
}

const raptors = [...falcons, ...eagles];   // E: 猛禽之间会互攻(驱遂制)
const threats = raptors;                   // 鸟的逃逸与被捕食判定对同一批对象生效

/* ---- 第 7 轮: 随时增援猛禽(按钮"加入鹰/隼"与 SIM.addFalcon/addEagle 都走这里) ---- */
const FALCON_COLORS = ["235,70,70", "70,150,255", "240,140,60", "180,90,230", "90,220,180", "230,120,190"];
const CN_NUM = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
function spawnRaptor(kind) {
  // 在鸟群质心附近的一个固定半径环上入场(质心由 6.1/6.2 每帧更新)
  const ang = Math.random() * TAU, r = 260 + Math.random() * 160;
  const x = wrapX(cxmI + Math.cos(ang) * r), y = wrapY(cymI + Math.sin(ang) * r);
  let r2;
  if (kind === "eagle") {
    const k = eagles.length;
    r2 = makeEagle(x, y, "鹰" + (CN_NUM[k] || ("#" + (k + 1))) + " EAGLE");
    eagles.push(r2);
  } else {
    const k = falcons.length;
    r2 = makeFalcon(FALCON_COLORS[k % FALCON_COLORS.length],
                    "隼" + (CN_NUM[k] || ("#" + (k + 1))) + " FALCON",
                    x, y, 0, 0, Math.floor(Math.random() * CIRCLE_FRAMES));
    falcons.push(r2);
  }
  r2.z = 120 + Math.random() * 100;        // 第 8 轮: 增援从不同高度入场
  r2.targetZ = -1;
  raptors.push(r2);                        // threats 与 raptors 是同一个数组对象
  syncRaptorRefs();                        // 新个体入场后同步鹰别名与编号
  logDec(6, raptors.length - 1, "增援入场: " + r2.label + "(现有隼 " + falcons.length + " 只 / 鹰 " + eagles.length + " 只)");
  refreshRaidLine();                       // 无论从按钮还是 SIM 接口调用, 面板编制行立刻同步
  return r2;
}

/* 第 8 轮: 一键减员(面板按钮 / Shift+F / Shift+E)。隼至少留 1 只(轮换制度需要),
 * 鹰可以减到 0(此时面板 Q 表与鹰食谱行留空显示)。 */
function removeRaptor(kind) {
  if (kind === "falcon" && falcons.length > 0) {        // 【第 8 轮修正④】允许减到 0 只(纯鸟群观察)
    const g = falcons.pop();
    const at = raptors.indexOf(g); if (at >= 0) raptors.splice(at, 1);
    activeId = falcons.length ? (activeId % falcons.length) : 0;
  } else if (kind === "eagle" && eagles.length > 0) {
    const g = eagles.pop();
    const at = raptors.indexOf(g); if (at >= 0) raptors.splice(at, 1);
  }
  syncRaptorRefs();                       // 【第 8 轮修正】减员后同步鹰别名与编号(否则 Q 表读死对象)
  refreshRaidLine();
}

const stats = { steps: 0, kills: 0, wave: 0,
                missFalcon: 0, missEagle: 0,     // A: 空冲刺惩罚次数
                mobInterrupts: 0,                // C: 被围攻打断的冲刺次数
                lockedDashes: 0,                 // D: 带锁定的冲刺次数
                clashes: 0, steals: 0,           // E: 互攻/抢分次数
                // 第 4 轮
                dashEnds: 0, dashEndBirds: 0,    // P1: 冲刺结束时终点 80px 内的可见鸟数
                dashMaxEats: 0,                  // P1: 单次冲刺最多吃几只椋鸟
                dashMaxEatsLocked: 0,            // P1: 锁定冲刺(捕猎)单次最多吃几只(应 <= 1)
                dashMaxEatsFree: 0,              // P1: 未锁定冲刺(驱逐/追雁)单次最多吃几只
                dashEndInCone: 0,                // P2D: 冲刺终点落在威慑锥内的次数
                dashEndApexSum: 0, dashEndApexNear: 0,   // P2D: 终点到 V 尖的距离(和 / <200px 次数)
                apexDistSum: 0, apexDistSamples: 0, apexClose: 0,  // P2A: 雁尖与最近隼的距离采样
                noLockAborts: 0,                 // P1: 采样到目标但 40px 内无鸟 -> 放弃冲刺
                gooseAlerts: 0, gooseFalseAlerts: 0,  // P4: 借网预警 / 其中无猛禽在 400px 内的误报
                gooseDisarray: 0,                // P2E: 斩首混乱次数
                juvenileLost: 0,                 // P2C: 幼雁死亡次数
                coneFalconFrames: 0, coneEagleDrain: 0,  // P2D: 锥内失血帧数
                esAdopt: 0, esPeriods: 0 };      // P3: 隼策略采纳次数 / 评估期数
let frame = 0;
let esEvalOverride = 0;                          // 仅调试用: 缩短 ES 评估期(0 = 用 ES_EVAL_FRAMES)

/* ---- 第 8 轮: 猛禽决策日志(定容环形池) ----
 * 记录: 鹰的状态/动作决策、发起冲刺、冲刺落空、空冲刺罚款、互攻判胜、ES 采纳、编制增减。
 * 用途: 面板最后几行 + console(?log=1) + SIM.log()/SIM.logTail(n) 供脚本验收取证。
 * 注意: 热路径里只写定容数组(无新对象); 只有被读出来时才建小对象。 */
const DEC_CAP = 400;
const decT = new Int32Array(DEC_CAP);       // 帧号
const decKind = new Uint8Array(DEC_CAP);    // 类别
const decWho = new Uint8Array(DEC_CAP);     // 猛禽下标(255 = 非个体)
const decMsg = new Array(DEC_CAP).fill(""); // 文本
let decN = 0, decHead = 0, decSeq = 0;
let decLogOn = false;
try { decLogOn = /[?&]log=1/.test(window.location.search); } catch (e) { /* headless */ }
const DEC_KIND = ["鹰决策", "发起冲刺", "冲刺落空", "空冲刺罚款", "互攻", "ES采纳", "编制"];
function decWhoName(who) {
  if (who === 255) return "-";
  if (who < falcons.length) return falcons[who].label.split(" ")[0];
  const ei = who - falcons.length;
  return ei < eagles.length ? eagles[ei].label.split(" ")[0] : ("#" + who);
}
function logDec(kind, who, msg) {
  const i = decHead;
  decT[i] = frame; decKind[i] = kind; decWho[i] = who; decMsg[i] = msg;
  decHead = (decHead + 1) % DEC_CAP;
  if (decN < DEC_CAP) decN++;
  decSeq++;
  if (decLogOn) console.info("[DEC f" + frame + " " + DEC_KIND[kind] + " " + decWhoName(who) + "] " + msg);
}
function decTail(n) {                       // 取最近 n 条(旧 -> 新)
  const out = [];
  const k = Math.min(n, decN);
  for (let j = 0; j < k; j++) {
    const i = (decHead - k + j + 2 * DEC_CAP) % DEC_CAP;
    out.push({ frame: decT[i], kind: DEC_KIND[decKind[i]], who: decWhoName(decWho[i]), msg: decMsg[i] });
  }
  return out;
}

/* ---- 初始化 ---- */

function initStarlings() {
  alive.fill(0);
  isMobber.fill(0);
  startled.fill(0);
  PV.fill(0);
  for (let i = 0; i < N; i++) {
    alive[i] = 1;
    isMobber[i] = Math.random() < MOB_FRACTION ? 1 : 0;   // C: 重抽围攻者身份
    P[2*i]   = wrapX(W / 2 + randn() * 200);
    P[2*i+1] = wrapY(H / 2 + randn() * 200);
    if (GRAV_ON) {                                       // 守恒线修补: 关重力时不消耗随机数
      ZT[i] = Z_INIT + randn() * Z_SPREAD * ZT_SPREAD_K;   // 个人飞行层(决定云团厚度)
      Z[i] = Math.max(FLOOR_Z + 20, ZT[i]);   // 第 8 轮: 初始云团高度
      VZ[i] = (Math.random() - 0.5) * 0.6;
    } else { Z[i] = 0; VZ[i] = 0; }
    const a = Math.random() * TAU;
    V[2*i]   = Math.cos(a) * MAX_SPEED * 0.5;
    V[2*i+1] = Math.sin(a) * MAX_SPEED * 0.5;
    PV[2*i]   = V[2*i];                     // P4: 上一帧速度初始化, 避免开局全体误报惊飞
    PV[2*i+1] = V[2*i+1];
  }
  aliveCount = N;
  deathT.fill(0); deathCursor = 0;
  migAng = Math.random() * TAU;
}

/* ---- P2: 雁群的槽位几何与轮值 ------------------------------------------
 * 槽位编号 slot(i) = (i + gooseShift) % M; 槽位 0 恒为 apex(V 尖)。
 * 排号/左右臂由槽位索引决定, 但**幼雁的内道优先**靠"残类"实现:
 * 幼雁是固定个体(i%4===0, 25%), 平移量按 M=60 取模, 而 4 | 60, 所以
 * "i%4===0 的雁" 永远落在槽位残类 (gooseShift%4) 里 —— 把这一残类的槽位
 * 排成内道(小排号), 幼雁就永远在内道, 换岗也不会换出内道。 */
function rebuildFormation() {
  const juvRes = ((gooseShift % 4) + 4) % 4;
  const inner = [], outer = [];
  for (let s = 0; s < M; s++) {
    if (s === 0) continue;                  // 0 号槽固定是 apex
    if (s % 4 === juvRes) inner.push(s); else outer.push(s);
  }
  slotRank[0] = 0; slotArm[0] = 1;
  let rank = 1;
  for (let k = 0; k < inner.length; k += 2) {          // 内道: 幼雁
    slotRank[inner[k]] = rank; slotArm[inner[k]] = 1;
    if (k + 1 < inner.length) { slotRank[inner[k + 1]] = rank; slotArm[inner[k + 1]] = -1; }
    rank++;
  }
  for (let k = 0; k < outer.length; k += 2) {          // 外道: 成雁
    slotRank[outer[k]] = rank; slotArm[outer[k]] = 1;
    if (k + 1 < outer.length) { slotRank[outer[k + 1]] = rank; slotArm[outer[k + 1]] = -1; }
    rank++;
  }
}

// 雁 i 的目标槽位坐标(apex = (Lx,Ly), 航向 leaderAng)
function gooseSlot(i) {
  const s = (i + gooseShift) % M;
  const rank = slotRank[s], arm = slotArm[s];
  const back = rank * SLOT_SPACING;
  const side = arm * rank * SLOT_SPACING * 0.36;
  const hx = Math.cos(leaderAng), hy = Math.sin(leaderAng);
  return { x: wrapX(Lx - hx * back - hy * side), y: wrapY(Ly - hy * back + hx * side) };
}

// 威慑锥判定(2D, perceive 打分用 —— 近似: 只看的水平面投影)
function inCone(px, py) {
  const dx = minImageX(px - Lx), dy = minImageY(py - Ly);
  const d2 = dx * dx + dy * dy;
  if (d2 > CONE_R * CONE_R) return false;
  const d = Math.sqrt(d2) || 1;
  return (dx / d) * Math.cos(leaderAng) + (dy / d) * Math.sin(leaderAng) > CONE_COS;
}

// 第 8 轮: 威慑锥 3D 版(失血/能耗判定用)。轴 = (领队航向, 领队垂直速度的 1/4 倾角),
// 半角/半径不变 —— 雁抬头爬升时锥向上翘, 俯冲时向下扣。
function inCone3(px, py, pz) {
  const dx = minImageX(px - Lx), dy = minImageY(py - Ly), dz = GRAV_ON ? pz - Z2[leaderIdx] : 0;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > CONE_R * CONE_R) return false;
  const d = Math.sqrt(d2) || 1;
  const az2 = clamp(VZ2[leaderIdx] * 0.25, -0.45, 0.45);
  const al = Math.hypot(1, az2);
  return (dx * Math.cos(leaderAng) + dy * Math.sin(leaderAng) + dz * az2) / (d * al) > CONE_COS;
}

// 雁 i 的死亡流程: 幼雁 -> 全体沮丧期(P2C); apex -> 斩首混乱期(P2E)。
// 被吃与调试钩子(SIM.killGoose)共用同一条路径, 保证测试测的就是真实行为。
function gooseDies(i) {
  if (!galive[i]) return;
  addDeath(P2[2*i], P2[2*i+1]);
  galive[i] = 0; galiveCount--;
  if (isJuvenile(i)) { gooseDebuff = JUVENILE_DEBUFF_FRAMES; stats.juvenileLost++; }
  if (i === leaderIdx) {
    disarray = DISARRAY_FRAMES;
    stats.gooseDisarray++;
    rotateLeader();                            // 先认一个新 apex, 混乱结束后按它重建
  }
}

// 把 apex 换到下一只活雁(轮值 / 混乱后重建); 返回是否成功。
// 不变式: slot(leaderIdx) = (leaderIdx + gooseShift) % M = 0。
// 要把 apex 前进 k 只, 平移量必须**减** k(因为 leaderIdx = -gooseShift mod M)。
function rotateLeader() {
  for (let k = 1; k <= M; k++) {
    const cand = (leaderIdx + k) % M;
    if (galive[cand]) {
      gooseShift = ((gooseShift - k) % M + M) % M;   // 槽位序号平移
      leaderIdx = cand;
      rebuildFormation();
      return true;
    }
  }
  return false;
}

function initGeese() {
  galive.fill(1); galiveCount = M;
  leaderAng = Math.random() * TAU;
  // 【task-6】雁群领队出生点: 也放到鸟群质心附近(旧值 W*0.3/H*0.3 离质心 780px, 在
  // 3200×2200 的世界里是偏僻角落, 雁群与椋鸟群会长期分离)
  const gHome = spawnPoint(GOOSE_HOME_A, GOOSE_HOME_R);
  Lx = gHome.x; Ly = gHome.y;
  gooseShift = 0; leaderIdx = 0; disarray = 0; gooseDebuff = 0;
  juvCount = 0;
  for (let i = 0; i < M; i++) if (isJuvenile(i)) juvCount++;
  rebuildFormation();
  for (let i = 0; i < M; i++) { Z2[i] = GOOSE_LAYER + (i % 5) * 6; VZ2[i] = 0; }   // 第 8 轮: 雁在明显更高的稳定层(分层可见)
  const hx = Math.cos(leaderAng), hy = Math.sin(leaderAng);
  for (let i = 0; i < M; i++) {
    const s = gooseSlot(i);
    P2[2*i] = s.x; P2[2*i+1] = s.y;
    V2[2*i] = hx * LEADER_SPEED; V2[2*i+1] = hy * LEADER_SPEED;
  }
  Lx = P2[2*leaderIdx]; Ly = P2[2*leaderIdx+1];   // 虚拟领队 = apex 雁当前位置
}

function resetFlocks() { initStarlings(); initGeese(); }

// 猛禽回到起始状态(位置/能量/记忆/拖尾), 计分保留。
// 第 7 轮: "重置猛禽"同时把增援解散 —— 回到默认编制(2 隼 + 1 鹰), 这样按钮可逆。
function resetPredators() {
  const inOpen = !TORUS;
  // 解散增援: 只保留 falcons[0..1] 与 eagles[0], 并从 raptors 里摘掉多余的
  while (falcons.length > 2) { const gone = falcons.pop(); const at = raptors.indexOf(gone); if (at >= 0) raptors.splice(at, 1); }
  while (eagles.length > 1)  { const gone = eagles.pop();  const at = raptors.indexOf(gone); if (at >= 0) raptors.splice(at, 1); }
  // 【第 8 轮修正④】"重置猛禽" = 回到默认编制: 被减掉的隼/鹰要重建回来(隼可减到 0 之后必须)
  // 【task-6】出生点 = 鸟群质心附近 ±300px 的错开方位(必须在世界内, 且进隼的 420px 视野)
  const base = flockCenter();
  const home0 = spawnPoint(FALCON_HOME_A, RAPTOR_HOME_R);
  const home1 = spawnPoint(FALCON_HOME_B, RAPTOR_HOME_R);
  const homeE = spawnPoint(EAGLE_HOME_A, RAPTOR_HOME_R);
  while (falcons.length < 2) {
    const k = falcons.length;
    const hm = k ? home1 : home0;
    const nf = makeFalcon(FALCON_COLORS[k % FALCON_COLORS.length],
      "隼" + (CN_NUM[k] || ("#" + (k + 1))) + " FALCON" + (k > 0 ? "-" + (k + 1) : ""),
      hm.x, hm.y, 0, k ? -CIRCLE_SPEED : CIRCLE_SPEED, k ? 200 : 30);
    falcons.push(nf); raptors.push(nf);
  }
  while (eagles.length < 1) { const ne = makeEagle(homeE.x, homeE.y, "鹰① EAGLE"); eagles.push(ne); raptors.push(ne); }
  const f0 = falcons[0], f1 = falcons[1];
  f0.x = home0.x; f0.y = home0.y; f0.vx = 0; f0.vy = CIRCLE_SPEED; f0.circleT = 30;
  f1.x = home1.x; f1.y = home1.y; f1.vx = 0; f1.vy = -CIRCLE_SPEED; f1.circleT = 200;
  for (const f of falcons) {
    f.energy = ENERGY_MAX; f.dashT = 0; f.trailN = 0; f.trailHead = 0; f.shock = null;
    f.memX = base.x; f.memY = base.y; f.memT = -1e9; f.seeing = false;   // 【task-6】记忆点=鸟群质心
    f.dashEats = 0; f.lockIdx = -1; f.mob = 0; f.stun = 0; f.clashCd = 0;
    f.z = 140; f.vz = 0; f.targetZ = -1;                              // 第 8 轮
  }
  activeId = 0;
  syncRaptorRefs();
  for (let i = 0; i < eagles.length; i++) {
    const E = eagles[i];
    E.x = homeE.x; E.y = homeE.y; E.vx = 0; E.vy = 0;   // 【task-6】世界内的鸟群质心附近
    E.dashT = 0; E.cool = 0; E.trailN = 0; E.trailHead = 0; E.shock = null;
    E.memX = base.x; E.memY = base.y; E.memT = -1e9; E.seeing = false;   // 【task-6】记忆点=鸟群质心
    E.lastState = 0; E.lastAction = 0; E.pending = 0;
    E.dashEats = 0; E.lockIdx = -1; E.mob = 0; E.stun = 0; E.clashCd = 0;
    E.hold = 0; E.holdState = STATE_NONE; E.holdAction = 2;
    E.z = Z_INIT; E.vz = 0; E.targetZ = -1;                           // 第 8 轮
  }
}

// 几何切换: 改世界尺寸 + 重置位置(否则鸟会落在新的墙外)
function setGeometry(torus) {
  TORUS = !!torus;
  PAD = TORUS ? 0 : PAD_OPEN;
  recomputeGridSize();
  resetFlocks();
  resetPredators();
}

function setN(v) {
  N = clamp(Math.round(v), 100, MAXN);
  initStarlings();
}

/* --------------------- 4. 自动补充猎物 --------------------- */

// 四个补充方向(常量, 避免每次补充时新建对象字面量数组)
// 【task-6】补充点必须落在**世界内**: 旧式 -PAD-20 / W+PAD+20 是"视口±缓冲带"时代的边角
// (世界 1280×720 时它们刚好在世界外一点, 是有意的"从外面补进来"); 世界解耦到 3200×2200
// 后, 这四点仍在 (0,0) 附近算, 全部落在世界外 190px —— 补进来的鸟一出生就越界。
const FILL_INSET = 120;                  // 补充点离世界边的距离(> 个体一帧最大位移)
const REFILL_SIDES = [
  { x: FILL_INSET, y: H / 2, inx: 1, iny: 0 },
  { x: W - FILL_INSET, y: H / 2, inx: -1, iny: 0 },
  { x: W / 2, y: FILL_INSET, inx: 0, iny: 1 },
  { x: W / 2, y: H - FILL_INSET, inx: 0, iny: -1 },
];

// 死亡太多时, 从离猛禽最远的一侧补一波: 让竞赛能长时间看下去。
// 两趟扫描(先挑边, 再就地安置), 不再收集 dead 索引数组。
function refillStarlings() {
  let deadCount = 0;
  for (let i = 0; i < N; i++) if (!alive[i]) deadCount++;
  if (deadCount === 0) return;

  let best = REFILL_SIDES[0], bestD = -1;
  for (let s = 0; s < REFILL_SIDES.length; s++) {
    const sd = REFILL_SIDES[s];
    let dmin = 1e18;
    for (const f of threats) {
      const dx = minImageX(sd.x - f.x), dy = minImageY(sd.y - f.y);
      dmin = Math.min(dmin, dx * dx + dy * dy);
    }
    if (dmin > bestD) { bestD = dmin; best = sd; }
  }

  for (let i = 0; i < N; i++) {
    if (alive[i]) continue;
    const jx = best.inx !== 0 ? randn() * 25 : randn() * 200;
    const jy = best.iny !== 0 ? randn() * 25 : randn() * 200;
    P[2*i]   = wrapX(best.x + jx);
    P[2*i+1] = wrapY(best.y + jy);
    const vx = best.inx * MAX_SPEED * 0.6 + (Math.random() - 0.5) * 0.6;
    const vy = best.iny * MAX_SPEED * 0.6 + (Math.random() - 0.5) * 0.6;
    const vs = Math.hypot(vx, vy) || 1;
    V[2*i]   = vx / vs * MAX_SPEED * 0.6;
    V[2*i+1] = vy / vs * MAX_SPEED * 0.6;
    PV[2*i] = V[2*i]; PV[2*i+1] = V[2*i+1];
    startled[i] = 0;
    alive[i] = 1;
  }
  aliveCount += deadCount;
  stats.wave++;
}

function refillGeese() {
  const hx = Math.cos(leaderAng), hy = Math.sin(leaderAng);
  let added = 0;
  for (let i = 0; i < M; i++) {
    if (galive[i]) continue;
    const s = gooseSlot(i);
    P2[2*i] = s.x; P2[2*i+1] = s.y;
    V2[2*i] = hx * LEADER_SPEED; V2[2*i+1] = hy * LEADER_SPEED;
    galive[i] = 1; added++;
  }
  galiveCount += added;
}

function maybeRefill() {
  if (!refillOn) return;
  if (aliveCount < N * REFILL_RATIO) refillStarlings();
  if (galiveCount < M * REFILL_G_RATIO) refillGeese();
}

/* --------------------- 5. 猛禽感知与采样目标获取(无全局视野) --------------------- */

// 采样目标获取(P1)用的预计算量与复用缓冲
const CANDX = new Float64Array(N_CAND), CANDY = new Float64Array(N_CAND);
const CAND_R = new Float64Array(N_CAND);
for (let r = 0, k = 0; r < SAMPLE_RADII.length; r++) {
  for (let a = 0; a < SAMPLE_ANGLES; a++, k++) {
    const ang = a / SAMPLE_ANGLES * TAU;
    CANDX[k] = Math.cos(ang) * SAMPLE_RADII[r];
    CANDY[k] = Math.sin(ang) * SAMPLE_RADII[r];
    CAND_R[k] = SAMPLE_RADII[r];
  }
}
const candScore = new Float64Array(N_CAND);
const VIS = new Int32Array(MAXN);          // 视野内可见椋鸟索引(复用)
const ANG_BIN = TAU / SAMPLE_ANGLES;       // 每个候选角度占的弧度
// 每个环的"角度窗"半宽(单位: 角度槽数), 取 bd=ring 时的最坏情况:
//   Δθ_max = 2·asin(SCOOP_R / (2·ring)), 槽数 = ceil(Δθ_max / ANG_BIN)
// 这样内层循环里不用再做 asin/sqrt, 只需 1 次 atan2(每只鸟)+ 若干平方比较。
const CAND_W = new Int32Array(SAMPLE_RADII.length);
const CAND_LO2 = new Float64Array(SAMPLE_RADII.length), CAND_HI2 = new Float64Array(SAMPLE_RADII.length);
for (let r = 0; r < SAMPLE_RADII.length; r++) {
  const rad = SAMPLE_RADII[r];
  const half = 2 * Math.asin(Math.min(1, SCOOP_R / (2 * rad)));
  CAND_W[r] = Math.min(Math.max(1, Math.ceil(half / ANG_BIN)), SAMPLE_ANGLES >> 1);
  const lo = Math.max(0, rad - SCOOP_R), hi = rad + SCOOP_R;
  CAND_LO2[r] = lo * lo; CAND_HI2[r] = hi * hi;
}

// perceive: 视野内的椋鸟统计 + 采样目标获取。
//   1) 沿用桶心粗筛 + 逐只精确判距, 收集全部可见椋鸟(质心 x,y / 数量 n 照旧);
//   2) 每只鸟累加进"距离 < SCOOP_R 的所有候选点"(80 个极坐标候选), 得到
//      "哪个位置一小勺能捞到最多鸟";
//   3) 打分 = 捞到的鸟数 ×(1 + DIR_LAG·cos(候选方向, 当前航向)) —— 方向滞后防抖动;
//      // 扩展位: 雁权重 / 威慑锥扣分 / mob 扣分 都可以在这里乘上 (P2D 已接锥)
//   4) argmax 候选点 = 冲刺中心 (cx,cy); lockIdx = 中心 LOCK_R 内最近的鸟,
//      40px 内没鸟则视为"目标不可用"(caller 会放弃这次冲刺)。
// bi 语义改为"中心附近那只代表鸟"(= lockIdx), 供伏击按它的速度外推。
// 复用的返回对象(每帧被猛禽调用 3 次 + 冲刺收尾 1 次): 不再每次分配对象字面量
const PC = { x: 0, y: 0, n: 0, bi: -1, cx: -1, cy: -1, lockIdx: -1, score: 0, z: Z_INIT };

function perceive(px, py, vx, vy, viewR2) {
  const cellR = Math.sqrt(viewR2) + CELL * 0.75, cellR2 = cellR * cellR;
  const maxCandR = Math.sqrt(viewR2) - SCOOP_R;     // 捞勺伸出视野的候选点直接不要
  let cnt = 0, nVis = 0;
  let sumX = 0, sumY = 0, sumZ = 0, scx = 0, ssx = 0, scy = 0, ssy = 0;   // 第 8 轮: sumZ
  candScore.fill(0);

  // 按"桶首次出现顺序"遍历(位级等价于旧版的 Map.forEach), 桶内逆链成升序
  for (let oi = 0; oi < cellOrderN; oi++) {
    const c = cellOrder[oi];
    const cx = c % GW, cy = (c / GW) | 0;
    const bx = -PAD + (cx + 0.5) * CELL, by = -PAD + (cy + 0.5) * CELL;
    const dx = minImageX(bx - px), dy = minImageY(by - py);
    if (dx * dx + dy * dy > cellR2) continue;
    let m = 0;
    for (let j = gridHead[c]; j !== -1; j = gridNext[j]) chainBuf[m++] = j;   // 降序收集
    for (let q = m - 1; q >= 0; q--) {                                        // 升序遍历
      const j = chainBuf[q];
      const ex = minImageX(P[2*j] - px), ey = minImageY(P[2*j+1] - py);
      const d2 = ex * ex + ey * ey;
      if (d2 > viewR2) continue;
      cnt++;
      if (nVis < MAXN) VIS[nVis++] = j;
      if (TORUS) {
        const ta = P[2*j] / W * TAU, tb = P[2*j+1] / H * TAU;
        scx += Math.cos(ta); ssx += Math.sin(ta);
        scy += Math.cos(tb); ssy += Math.sin(tb);
      } else { sumX += P[2*j]; sumY += P[2*j+1]; sumZ += Z[j]; }   // 第 8 轮

      // 这只鸟能被哪些候选点"捞"到? 两层预筛把 80 个候选砍到 5~10 个:
      //   1) 半径: |ring - bd| < SCOOP_R(用平方比较, 不 sqrt);
      //   2) 角度: 只试最近角度槽 ±CAND_W[ring] 个(最坏情况窗, 预计算)。
      const bang = Math.atan2(ey, ex);
      const c0 = Math.round(bang / ANG_BIN);
      for (let r = 0, k = 0; r < SAMPLE_RADII.length; r++, k += SAMPLE_ANGLES) {
        if (SAMPLE_RADII[r] > maxCandR || d2 < CAND_LO2[r] || d2 > CAND_HI2[r]) continue;
        const w = CAND_W[r];
        for (let o = -w; o <= w; o++) {
          let ai = (c0 + o) % SAMPLE_ANGLES; if (ai < 0) ai += SAMPLE_ANGLES;
          const kk = k + ai;
          const ddx = ex - CANDX[kk], ddy = ey - CANDY[kk];
          if (ddx * ddx + ddy * ddy < SCOOP_R2) candScore[kk] += 1;
        }
      }
    }
  }

  if (cnt === 0) return null;
  const mx = TORUS ? wrapX(Math.atan2(ssx, scx) / TAU * W) : sumX / cnt;
  const my = TORUS ? wrapY(Math.atan2(ssy, scy) / TAU * H) : sumY / cnt;

  // 打分: 方向滞后 + 威慑锥乘项(P2D: 让选目标自己绕开雁群正面, 不写躲避硬编码)
  const sp = Math.sqrt(vx * vx + vy * vy) || 1;
  const ux = vx / sp, uy = vy / sp;
  const coneOn = galiveCount > 0;
  let bestS = 0, bestK = -1;
  for (let k = 0; k < N_CAND; k++) {
    const base = candScore[k];
    if (base <= 0 || CAND_R[k] > maxCandR) continue;
    const d = CAND_R[k] || 1;
    let sc = base * (1 + DIR_LAG * ((CANDX[k] / d) * ux + (CANDY[k] / d) * uy));
    // 扩展位: 雁权重 / 威慑锥扣分 / mob 扣分
    if (coneOn && inCone(px + CANDX[k], py + CANDY[k])) sc *= CONE_SCORE_FACTOR;
    if (sc > bestS) { bestS = sc; bestK = k; }
  }

  let cxT = -1, cyT = -1, lockIdx = -1;
  if (bestK >= 0) {
    cxT = px + CANDX[bestK]; cyT = py + CANDY[bestK];
    let bestD = LOCK_R2;                     // 中心附近最近的鸟: 冲刺途中只吃它
    for (let v = 0; v < nVis; v++) {
      const j = VIS[v];
      const dx = minImageX(P[2*j] - cxT), dy = minImageY(P[2*j+1] - cyT);
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; lockIdx = j; }
    }
    if (lockIdx < 0) { cxT = -1; cyT = -1; } // 40px 内无鸟 -> 本次放弃
  }
  PC.x = mx; PC.y = my; PC.n = cnt; PC.bi = lockIdx;
  PC.cx = cxT; PC.cy = cyT; PC.lockIdx = lockIdx; PC.score = bestS;
  PC.z = cnt ? sumZ / cnt : Z_INIT;          // 视野内鸟群的平均高度(参考)
  // 【第 8 轮修正③】云团厚 250px 时, 按"平均高度"俯冲几乎撞不上(吃判是 9px 的 3D 球)。
  // 真实猛禽是锁定**某一只**再俯冲, 所以这里额外给出锁定个体的高度; 冲刺/巡航都优先用它。
  PC.lockZ = (lockIdx >= 0) ? Z[lockIdx] : PC.z;
  return PC;
}

// tryDash: 发起冲刺。带 ±60° 方向约束 —— 目标必须在当前航向 60° 以内,
// 否则放弃并返回 false(盘旋转向会逐渐对齐, 这是特性不是 bug)。
// lockIdx: D 的迷惑效应 —— 冲刺锁定的椋鸟索引(雁/对手传 -1, 不算锁定)。
function tryDash(f, tx, ty, lockIdx, tz) {       // 第 8 轮: 升维成 3D(重力版航向夹角)
  const dx = minImageX(tx - f.x), dy = minImageY(ty - f.y);
  const dz = GRAV_ON ? ((tz === undefined ? f.z : tz) - f.z) : 0;   // 守恒线修补: 关重力必须退化为 2D(dz=0)
  const n = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (n <= 1) return false;
  const cvx = f.vx, cvy = f.vy, cvz = GRAV_ON ? f.vz : 0;
  const cn = Math.sqrt(cvx * cvx + cvy * cvy + cvz * cvz) || 1;
  const cosA = (cvx * dx + cvy * dy + cvz * dz) / (cn * n);
  // 【task-3】三维航向判定保持 2D 语义(±60°)。试过给"目标在下方"额外放宽到 80°, 结果:
  // 多放进来 ~8 次/5000 帧的陡冲, 但冲刺内吃到东西的比例从 0.19/次掉到 0.05/次(3 种子),
  // 而且这些陡冲的落点没人验证过 —— 数据不支持, 已回退。俯冲的"压机头"由 6.8 的俯冲相负责。
  if (cosA < Math.cos(DASH_MAX_ANGLE)) return false;   // 等价于 2D 的 ±60° 判定
  const dashFrames = Math.floor((Math.min(n, DASH_MAX_DIST) + DASH_EXTRA) / DASH_SPEED);
  // 【task-6】边界预测: 冲刺期速度锁定 -> 按本次冲刺方向直行会冲出世界就不发起(此时还没改速度)
  if (boundPredOut(f.x, f.y, dx / n * DASH_SPEED, dy / n * DASH_SPEED, dashFrames, DASH_BOUND_MARGIN)) return false;
  f.vx = dx / n * DASH_SPEED;
  f.vy = dy / n * DASH_SPEED;
  f.vz = dz / n * DASH_SPEED;
  f.dashT = dashFrames;
  f.shock = { x: tx, y: ty, z: f.z, t: 0 };      // 冲刺瞬间的冲击波(带高度)
  f.dashEats = 0;                                // A: 本次冲刺的猎物计数清零
  f.dashS = 0;                                   // P1: 本次冲刺吃到的椋鸟数(验收用)
  f.lockIdx = (DASH_LOCK && lockIdx !== undefined) ? lockIdx : -1;
  if (f.lockIdx >= 0) stats.lockedDashes++;
  return true;
}
/* task-3: 冲刺瞄准(实测结论) —— 试过"瞄锁定个体的当前/前置位置", 结果反而更差:
 * 3 种子 5000 帧下, 冲刺内吃到东西的比例 原版(瞄捞勺中心) 0.19/次 -> 瞄个体当前位置 0.13/次
 * -> 瞄个体+拦截前置解 0.06/次。原因: 锁定个体是"离捞勺中心最近的那只", 它一被锁就向外逃,
 * 而捞勺中心是重叠鸟群里被邻居挤住的位置, 直线冲过去反而更容易逮到; 前置解把落点推到它
 * 逃逸的前方, 但它被鸟群拖着转向, 于是打空。数据不支持这个"更聪明"的瞄准, 已回退。
 */


/* ------------------------------ 6. 仿真 step ------------------------------ */

let migAng = Math.random() * TAU;          // 群体迁徙方向(缓慢随机游动)

/* ---- W2 惊飞波状态(定型数组, 零分配) ----
 * W2_ALERT: >0 = 正在急转(警报剩余帧), <0 = 不应期, = -REFRACT = 待命;
 * W2_TURN : 上一帧的带符号转向(弧度/帧), 给接力提供方向;
 * W2_PV   : 上一帧末的速度副本 —— 自己记一份而不是用现成的 PV, 因为
 *           SIM.setStarlingVel() 注入惊飞时会同时写 V 和 PV(相当于"抹掉"这一次突变),
 *           用 PV 就看不见注入的急转, 波源也就点不着。 */
const W2_ALERT = new Float32Array(MAXN).fill(-REFRACT);
const W2_TURN  = new Float32Array(MAXN);
const W2_PV    = new Float32Array(MAXN * 2);

/* step():
 *   6.1+6.2 网格与拓扑邻居(可选 GPU —— 见文件末尾 WebGPU 计算后端)
 *   + 6.3~6.10 其余系统(永久留 CPU: 雁/猛禽/学习/事件)
 * CPU 路径与旧版逐行同构(位级一致, 见 _checks/golden.mjs)。 */
let cxmI = W / 2, cymI = H / 2;              // 6.1/6.2 产出的全局质心, 供 6.3/6.4 用
function step() {
  frame++; stats.steps++;
  const tor = TORUS;                         // 每步取一次, 热循环里不再反复查全局
  cpuGridAndForces(tor);                     // 6.1 + 6.2(CPU 参考实现)
  stepRest(tor);                             // 6.3 ~ 6.10
}

/* ---- 6.1 + 6.2(CPU 参考实现; GPU 版见文末 ComputeBackend 的同构 WGSL) ---- */
function cpuGridAndForces(tor) {
  /* ---- 6.1 重建网格(只装活椋鸟; 链表池化, 零分配) ----
   * 链表是头插法(桶内降序), 但**遍历顺序必须与旧版逐位一致**, 否则浮点求和
   * 顺序变了、混沌系统会放大成完全不同的轨迹: 所以额外记住"桶的首次出现顺序"
   * (cellOrder)并在遍历时把链逆成升序(chainBuf) —— 位级复现旧 Map+数组的行为。 */
  gridHead.fill(-1);
  cellOrderN = 0;
  for (let i = 0; i < N; i++) {
    if (!alive[i]) continue;
    const c = cellOf(P[2*i], P[2*i+1]);
    if (gridHead[c] === -1) cellOrder[cellOrderN++] = c;
    gridNext[i] = gridHead[c];               // 头插法: i 成为该桶新的链头
    gridHead[c] = i;
  }
  for (const f of threats) f.mob = 0;        // C: 围攻计数每帧清零, 本帧重新统计

  /* ---- 6.2 椋鸟: 拓扑邻居扫描(只算力) + 全局质心累加 ---- */
  let sumX = 0, sumY = 0, cntAlive = 0;
  let sXc = 0, cXc = 0, sYc = 0, cYc = 0;

  for (let i = 0; i < N; i++) {
    if (!alive[i]) continue;
    const xi = P[2*i], yi = P[2*i+1];
    const cx = clamp(Math.floor((xi + PAD) / CELL), 0, GW - 1);
    const cy = clamp(Math.floor((yi + PAD) / CELL), 0, GH - 1);

    // 收集候选, 只保留最近的 topoK 只(拓扑邻居; A 版的核心)。
    // 槽位按距离升序维护: 比"每次重扫最远槽"少一个 O(K) 内层循环,
    // 大多数候选只需一次比较 KD[kn-1] 就被丢掉。
    let kn = 0;
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++) {
        let gx = cx + ox, gy = cy + oy;
        if (tor) { gx = ((gx % GW) + GW) % GW; gy = ((gy % GH) + GH) % GH; }
        else if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) continue;
        for (let j = gridHead[gy * GW + gx]; j !== -1; j = gridNext[j]) {
          if (j === i) continue;
          const dx = tor ? minImageX(P[2*j] - xi) : P[2*j] - xi;
          const dy = tor ? minImageY(P[2*j+1] - yi) : P[2*j+1] - yi;
          const d2 = dx * dx + dy * dy;
          if (d2 > PERCEPTION_R2) continue;
          let p;
          if (kn < topoK) p = kn++;            // 先填满 K 个槽
          else if (d2 < KD[kn-1]) p = kn - 1;  // 比当前最远的还近 -> 顶掉它
          else continue;
          while (p > 0 && KD[p-1] > d2) {      // 冒泡到正确位置, 维持升序
            KD[p] = KD[p-1]; KX[p] = KX[p-1]; KY[p] = KY[p-1]; KJ[p] = KJ[p-1];
            p--;
          }
          KD[p] = d2; KX[p] = dx; KY[p] = dy; KJ[p] = j;
        }
      }

    let ax = 0, ay = 0;
    let relay = 0;   // W2: 邻居"急转"的带符号和(惊飞波方向)
    if (kn > 0) {
      let psx = 0, psy = 0, vsx = 0, vsy = 0, sepx = 0, sepy = 0;
      for (let m = 0; m < kn; m++) {
        psx += KX[m]; psy += KY[m];
        vsx += V[2*KJ[m]]; vsy += V[2*KJ[m]+1];
        if (KD[m] < SEP_R2) {                  // 距离加权分离: 越近推得越狠
          const w = 1 / Math.max(KD[m], 1);
          sepx -= KX[m] * w; sepy -= KY[m] * w;
        }
      }
      const mx = COHESION_W * psx / kn + ALIGNMENT_W * vsx / kn;
      const my = COHESION_W * psy / kn + ALIGNMENT_W * vsy / kn;
      const nn = Math.hypot(mx, my);
      if (nn > 1e-9) {
        ax += clamp(mx / nn * MAX_SPEED - V[2*i],   -MAX_FORCE, MAX_FORCE);
        ay += clamp(my / nn * MAX_SPEED - V[2*i+1], -MAX_FORCE, MAX_FORCE);
      }
      ax += clamp(sepx * SEP_GAIN, -2 * MAX_FORCE, 2 * MAX_FORCE);
      ay += clamp(sepy * SEP_GAIN, -2 * MAX_FORCE, 2 * MAX_FORCE);
      /* ---- W2 叠加 ①: 独立预算的对齐力 ----
       * 旧式把 凝聚(位置和) 与 对齐(速度和) 先混成一个方向再归一化 —— 邻居越密, 凝聚矢量越大,
       * 对齐的实际权重被挤掉; 于是一个局部扰动会被"共识"拉平, 传不过几个身位。
       * 这里用**邻居单位航向的平均**(不受邻居快慢影响)单独成力, 先限幅到 MAX_FORCE 再乘 ALIGN2_W。 */
      {
        if (ALIGN2_W > 0) {
          let axn = 0, ayn = 0;
          for (let m = 0; m < kn; m++) {
            const j = KJ[m];
            const vjx = V[2*j], vjy = V[2*j+1];
            const spj = Math.sqrt(vjx * vjx + vjy * vjy);
            if (spj > 1e-9) { axn += vjx / spj; ayn += vjy / spj; }
          }
          const an = Math.sqrt(axn * axn + ayn * ayn);
          if (an > 1e-9) {
            ax += clamp(axn / an * MAX_SPEED - V[2*i],   -MAX_FORCE, MAX_FORCE) * ALIGN2_W;
            ay += clamp(ayn / an * MAX_SPEED - V[2*i+1], -MAX_FORCE, MAX_FORCE) * ALIGN2_W;
          }
        }
        for (let m = 0; m < kn; m++) {                    // 惊飞波: 邻居"急转"的带符号和
          const j = KJ[m];
          relay += (W2_ALERT[j] > 0.5) ? W2_TURN[j] : 0;
        }
        /* ---- W2 叠加: 惊飞波传染 ----
         * 邻居正在急转 -> 我朝**同一方向**急转(照抄动作)。真实椋鸟的惊飞波就是这个:
         * 只靠对齐是均值回归, 被吓到的个体很快被邻居拉回共识, 波传不过几个身位。
         * 只对"自己不在警报/不应期"的个体生效, 否则两只鸟会互相接力, 整群永久打转。 */
        if (Math.abs(relay) > RELAY_MIN) {
          const spx = V[2*i], spy = V[2*i+1];
          const sp2 = Math.sqrt(spx * spx + spy * spy);
          if (sp2 > 1e-6) {                                    // 警报期内一直照抄邻居的转向
            const s = relay > 0 ? 1 : -1;
            const mag = Math.min(1, Math.abs(relay)) * CONT_W * MAX_FORCE;
            ax += -s * spy / sp2 * mag;                        // 左转 = 速度逆时针 90°(-vy, +vx)
            ay += s * spx / sp2 * mag;
          }
        }
      }
    }
    /* 传染状态机: a>0 警报中(急转接力窗口); a<0 不应期; a=-REFRACT 待命。 */
    { const a0 = W2_ALERT[i];
      if (a0 > 0) W2_ALERT[i] = a0 - 1;
      else if (a0 <= -REFRACT && Math.abs(relay) > RELAY_MIN) W2_ALERT[i] = ALERT_FRAMES;
      else if (a0 > -REFRACT) W2_ALERT[i] = a0 - 1; }

    ACC[2*i] = ax; ACC[2*i+1] = ay;

    sumX += xi; sumY += yi; cntAlive++;
    if (tor) {                                 // 环面质心走圆均值
      sXc += Math.sin(xi / W * TAU); cXc += Math.cos(xi / W * TAU);
      sYc += Math.sin(yi / H * TAU); cYc += Math.cos(yi / H * TAU);
    }
  }

  cxmI = cntAlive === 0 ? W / 2
       : (tor ? wrapX(Math.atan2(sXc, cXc) / TAU * W) : sumX / cntAlive);
  cymI = cntAlive === 0 ? H / 2
       : (tor ? wrapY(Math.atan2(sYc, cYc) / TAU * H) : sumY / cntAlive);
}

/* ---- 只算全局质心(GPU 路径下 6.1/6.2 在 GPU 上跑, 但 6.3/6.4 仍需要质心) ----
 * 与 cpuGridAndForces 里那段累加完全同序(逐鸟 i 升序), 所以结果逐位一致。 */
function cpuCentroidOnly(tor) {
  let sumX = 0, sumY = 0, cnt = 0, sXc = 0, cXc = 0, sYc = 0, cYc = 0;
  for (let i = 0; i < N; i++) {
    if (!alive[i]) continue;
    const xi = P[2*i], yi = P[2*i+1];
    sumX += xi; sumY += yi; cnt++;
    if (tor) {
      sXc += Math.sin(xi / W * TAU); cXc += Math.cos(xi / W * TAU);
      sYc += Math.sin(yi / H * TAU); cYc += Math.cos(yi / H * TAU);
    }
  }
  cxmI = cnt === 0 ? W / 2 : (tor ? wrapX(Math.atan2(sXc, cXc) / TAU * W) : sumX / cnt);
  cymI = cnt === 0 ? H / 2 : (tor ? wrapY(Math.atan2(sYc, cYc) / TAU * H) : sumY / cnt);
}

/* ---- 6.3 ~ 6.10(永久留 CPU) ---- */
function stepRest(tor) {
  /* 第 8 轮: 群体均高(定高弹簧用, O(N) 一遍过; 与 xy 完全解耦 -> 2D 轨迹逐位不变) */
  let zSum = 0, zCnt = 0, zLo = 1e9, zHi = -1e9;
  for (let i = 0; i < N; i++) if (alive[i]) {
    zSum += Z[i]; zCnt++;
    if (Z[i] < zLo) zLo = Z[i];
    if (Z[i] > zHi) zHi = Z[i];
  }
  const zMean = zCnt ? zSum / zCnt : Z_INIT;
  zMeanLive = zMean;
  if (zCnt) { zLowLive = zLo; zHighLive = Math.max(zHi, zLo + 30); }   // 三维亮度映射用

  /* ---- 6.3 迁徙方向: 随机游动 + 离屏太远就掰回来 ---- */
  migAng += (Math.random() - 0.5) * 0.025;
  const offX = tor ? minImageX(W / 2 - cxmI) : W / 2 - cxmI;
  const offY = tor ? minImageY(H / 2 - cymI) : H / 2 - cymI;
  if (Math.sqrt(offX * offX + offY * offY) > 150) {
    migAng += angDiff(Math.atan2(offY, offX), migAng) * 0.02;
  }
  const migX = Math.cos(migAng) * MIGRATE_FORCE;
  const migY = Math.sin(migAng) * MIGRATE_FORCE;

  /* ---- 6.4 椋鸟: 积分(质心引力 + 迁徙 + 边界 + 被捕食 + 逃逸) ---- */
  for (let i = 0; i < N; i++) {
    if (!alive[i]) continue;
    const xi = P[2*i], yi = P[2*i+1];
    const vi = 2 * i;
    let ax = ACC[vi], ay = ACC[vi+1];
    let az = 0;                            // 第 8 轮: 垂直方向力(逃逸/弹簧/重力)

    const dcx = tor ? minImageX(cxmI - xi) : cxmI - xi;
    const dcy = tor ? minImageY(cymI - yi) : cymI - yi;
    const dn = Math.sqrt(dcx * dcx + dcy * dcy);   // 弱质心引力, 只防永久碎裂
    if (dn > 1e-9) { ax += dcx / dn * CENTROID_FORCE; ay += dcy / dn * CENTROID_FORCE; }

    ax += migX; ay += migY;

    if (!tor) {                                // 【第 8 轮修正⑥ / task-6】边界厌恶(不是墙)
      const bd = boundAccel(xi, yi);
      if (bd) {
        const vOut = V[vi] * bd[0] + V[vi + 1] * bd[1];
        if (vOut < 0) { const cut = -vOut * bd[3]; ax += bd[0] * cut; ay += bd[1] * cut; }
        ax += bd[0] * bd[2]; ay += bd[1] * bd[2];
      }
    }

    let eaten = false;                         // 被捕食: 撞上任意猛禽即消失
    for (let t = 0; t < threats.length; t++) {
      const f = threats[t];
      // D 迷惑效应: 冲刺锁定某只鸟时, 冲刺期间只吃得到被锁定的那一只
      if (f.dashT > 0 && f.lockIdx >= 0 && f.lockIdx !== i) continue;
      const ex = tor ? minImageX(xi - f.x) : xi - f.x;
      const ey = tor ? minImageY(yi - f.y) : yi - f.y;
      const ez = (GRAV_ON && EAT_3D) ? Z[i] - f.z : 0;                  // 第 8 轮: 3D 判定球
      if (ex * ex + ey * ey + ez * ez < EAT_R2_S) {
        f.score += SCORE_STARLING; f.pending += SCORE_STARLING; f.kills++;
        if (f.dashT > 0) { f.dashEats++; f.dashS++; }   // A: 吃到东西 / P1 验收只数椋鸟
        if (f.kind === "eagle") f.dietStarling++;
        stats.kills++;
        alive[i] = 0; aliveCount--;
        addDeath(xi, yi);
        if (GRAV_ON) spawnCorpse(xi, yi, Z[i], V[vi], V[vi+1], VZ[i]);   // 第 8 轮: 尸体下坠
        eaten = true;
        break;
      }
    }
    if (eaten) continue;

    for (let t = 0; t < threats.length; t++) {  // 逃逸: 视野内所有猛禽都生效
      const f = threats[t];
      const dpx = tor ? minImageX(xi - f.x) : xi - f.x;
      const dpy = tor ? minImageY(yi - f.y) : yi - f.y;
      const dp2 = dpx * dpx + dpy * dpy;
      if (dp2 < FLEE_R2 && dp2 > 0) {
        const dp = Math.sqrt(dp2);
        W2_ALERT[i] = ALERT_FRAMES;                  // W2 惊飞波源: 视野里有猛禽 = 拉响警报
        ax += FLEE_W * clamp(dpx / dp * MAX_SPEED - V[vi],   -FLEE_FORCE, FLEE_FORCE);
        ay += FLEE_W * clamp(dpy / dp * MAX_SPEED - V[vi+1], -FLEE_FORCE, FLEE_FORCE);
        if (GRAV_ON) {                       // 第 8 轮: 三维逃逸 —— 高于猛禽往上飞, 低于往下钻
          const dz2 = Z[i] - f.z;
          az += clamp(-dz2 / dp * 1.6 - VZ[i], -0.35, 0.35);
        }
      }
    }

    // C 围攻: 围攻者逼近猛禽到骚扰环 —— 环外往里压, 环内往外推, 鸟群围着猛禽转
    if (isMobber[i]) {
      let mf = null, md2 = 1e18, mdx = 0, mdy = 0;
      for (let t = 0; t < threats.length; t++) {
        const f = threats[t];
        const dx = tor ? minImageX(xi - f.x) : xi - f.x;
        const dy = tor ? minImageY(yi - f.y) : yi - f.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < md2) { md2 = d2; mf = f; mdx = dx; mdy = dy; }
      }
      const md = Math.sqrt(md2);
      if (mf && md < MOB_R && md > 1e-6) {
        mf.mob++;                              // 本帧被这只鸟围住
        const ux = mdx / md, uy = mdy / md;    // u = "猛禽指向鸟"的单位向量
        const push = (md - MOB_HARASS) / MOB_HARASS;
        const tx2 = -ux * push * MAX_SPEED * 1.5;
        const ty2 = -uy * push * MAX_SPEED * 1.5;
        ax += clamp(tx2 - V[vi],   -MOB_MAX, MOB_MAX);
        ay += clamp(ty2 - V[vi+1], -MOB_MAX, MOB_MAX);
      }
    }

    let vx = V[vi] + ax, vy = V[vi+1] + ay;
    const sp = Math.sqrt(vx * vx + vy * vy);
    if (sp > MAX_SPEED) { vx = vx / sp * MAX_SPEED; vy = vy / sp * MAX_SPEED; }
    V[vi] = vx; V[vi+1] = vy;
    P[vi]   = wrapX(xi + vx);
    P[vi+1] = wrapY(yi + vy);

    // 第 8 轮 z 轴: 重力 - 定高弹簧(朝个人飞行层) + 近地推升 + 逃逸垂直分量 + 阻尼。
    // xy 动力学不受影响 -> 重力关掉时与旧版逐位一致。
    if (GRAV_ON) {
      // 【第 8 轮修正】原来弹簧朝"共享的群体均高"且无阻尼, 造成两个可见毛病:
      //   ① 均值回归把相对偏差吃掉 -> 云团慢慢塌成一层(实测 z 标准差 21 -> 4, 看起来"全在一个平面");
      //   ② vz 无阻尼 -> 每只鸟上下无休止振荡(实测 |vz| 一直维持 0.6px/帧)。
      // 现在: 每只鸟有自己的飞行层 ZT[i](厚度永久保留) + 弱群体耦合(整团仍一致)
      //       + 垂向阻尼 ALT_DAMP(把振荡压掉)。
      // 【第 8 轮修正②】鸟要能"主动"改变高度, 不然只是被重力/弹簧摆布, 看起来不会爬升:
      //   ① 个人飞行层缓慢游走(每只鸟自己挑高度, 上下范围 FLOOR+70 ~ Z_CEIL);
      //   ② 惊飞瞬间向上窜(受惊的椋鸟是往上炸开的)。
      ZT[i] = clamp(ZT[i] + (Math.random() - 0.5) * 0.12, FLOOR_Z + 70, Z_CEIL);
      if (startled[i] && VZ[i] < 1.2) VZ[i] += 0.55;
      let az2 = az - G_GRAV + (ZT[i] - Z[i]) * ALT_SPRING + (zMean - Z[i]) * ALT_SPRING * 0.25;
      if (Z[i] < FLOOR_Z + 50) az2 += FLOOR_PUSH;
      VZ[i] = clamp(VZ[i] * ALT_DAMP + az2, -3.2, 3.2);
      Z[i] = Math.max(FLOOR_Z, Z[i] + VZ[i]);
    }

    // P4 惊飞判据: **必须放在这里** —— 位置/速度已经更新, 还没覆盖 PV。
    // 判据是"相邻两帧速度夹角 > 60°"(急转, 不是快慢: 椋鸟平时也贴满速)。
    // 顺序错一帧(先覆盖 PV 再比)会让全体互相拿自己比, 全员误报。
    const pvx = PV[vi], pvy = PV[vi+1];
    const np = Math.sqrt(pvx * pvx + pvy * pvy);
    if (np > 1e-6 && sp > 1e-6) {
      startled[i] = ((vx * pvx + vy * pvy) / (sp * np) < PV_ALERT_COS) ? 1 : 0;
    } else startled[i] = 0;
    {   // W2 惊飞波: 记下本帧"带符号"的转向 —— 波沿群体传播靠的是照抄邻居的转向,
      // 不是靠向邻居的平均航向收敛(后者是均值回归, 会把扰动拉平)。
      const ox = W2_PV[vi], oy = W2_PV[vi+1];
      W2_PV[vi] = vx; W2_PV[vi+1] = vy;
      const so = Math.sqrt(ox * ox + oy * oy);
      if (so > 1e-6 && sp > 1e-6) {
        const tOld = Math.atan2(oy, ox), tNew = Math.atan2(vy, vx);
        let dA = tNew - tOld;
        while (dA > Math.PI) dA -= TAU;
        while (dA < -Math.PI) dA += TAU;
        W2_TURN[i] = (sp > 0.75 * MAX_SPEED) ? dA : 0;   // 慢速(被顶到失速)的航向是噪声
        // 波源②: 全速下急转 >= ALERT_TRIG(28.6°/帧) —— 巡航期全速口径 P99.9 只有 ~12°/帧,
        // 所以这个门限不会误报; 被猛禽吓到(≥60°/帧)与外部注入的惊飞都走这条路。
        if (Math.abs(dA) > ALERT_TRIG && sp > 0.75 * MAX_SPEED) W2_ALERT[i] = ALERT_FRAMES;
      } else W2_TURN[i] = 0;
    }
    PV[vi] = vx; PV[vi+1] = vy;
  }

  stepCorpses();                             // 第 8 轮: 尸体下坠(与鸟/雁无关, O(常量))

  /* ---- 6.5 雁群: 中心化秩序(领队智能 / 轮值 / 幼雁内道 / 威慑锥 / 斩首混乱)
   *   + 第四部分: 借椋鸟群的惊飞网提前预警 ---- */

  // --- 轮值领队: 每 ROTATE_FRAMES 换一次 apex; 虚拟领队位置 = apex 雁当前位置(不瞬移)
  if (frame % ROTATE_FRAMES === 0) rotateLeader();
  if (disarray > 0) disarray--;
  if (gooseDebuff > 0) gooseDebuff--;
  Lx = P2[2*leaderIdx]; Ly = P2[2*leaderIdx+1];       // apex 自己就是 V 尖

  // --- 领队智能(A): 感知 400px 内最近猛禽 -> 限速转向远离; 无威胁时随机游动 + 向心
  let leaderHustle = 1;
  {
    let ld = 1e18, lx = 0, ly = 0;
    for (let t = 0; t < threats.length; t++) {
      const f = threats[t];
      const dx = minImageX(Lx - f.x), dy = minImageY(Ly - f.y);
      const d2 = dx * dx + dy * dy;
      if (d2 < ld) { ld = d2; lx = dx; ly = dy; }
    }
    const ld2 = Math.sqrt(ld);
    if (ld2 < LEADER_SENSE_R && ld2 > 1e-6) {
      const away = Math.atan2(ly, lx);                 // 远离猛禽的方向
      leaderAng += clamp(angDiff(away, leaderAng), -LEADER_MAX_TURN, LEADER_MAX_TURN);
    } else {
      leaderAng += (Math.random() - 0.5) * 0.02;       // 随机游动
      const ox = minImageX(W / 2 - Lx), oy = minImageY(H / 2 - Ly);
      if (Math.hypot(ox, oy) > 300) leaderAng += angDiff(Math.atan2(oy, ox), leaderAng) * 0.015;
    }
    // 威胁很近了: 领队带头加速(队形不变, 只是整体提速)
    if (ld2 < LEADER_PANIC_R) leaderHustle = ESCAPE_HUSTLE;
  }
  const lhx = Math.cos(leaderAng), lhy = Math.sin(leaderAng);
  const slotScale = (gooseDebuff > 0 ? DEBUFF_FACTOR : 1);

  // P2A 验收取样(每 30 帧): 雁尖与最近隼的距离 —— 领队智能有没有把队形带开
  if (frame % 30 === 0 && galiveCount > 0) {
    let bd = 1e18;
    for (const f of falcons) {
      const dx = minImageX(Lx - f.x), dy = minImageY(Ly - f.y);
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) bd = d2;
    }
    bd = Math.sqrt(bd);
    stats.apexDistSum += bd; stats.apexDistSamples++;
    if (bd < 300) stats.apexClose++;
  }

  for (let i = 0; i < M; i++) {
    if (!galive[i]) continue;
    const xi = P2[2*i], yi = P2[2*i+1];

    let nd = 1e18, nx = 0, ny = 0, nz = 0;     // 最近的猛禽(含鹰)
    for (const f of threats) {
      const dx = minImageX(xi - f.x), dy = minImageY(yi - f.y);
      const d2 = dx * dx + dy * dy;
      if (d2 < nd) { nd = d2; nx = dx; ny = dy; nz = GRAV_ON ? f.z : 0; }
    }
    const d = Math.sqrt(nd);
    const raptorNear = d < FORMATION_BREAK && d > 0;
    const gooseFleeZ = () => {                 // 第 8 轮: 三维逃逸的垂直分量(混乱/让位两处复用)
      if (GRAV_ON) VZ2[i] += clamp((Z2[i] - nz) / Math.max(1, d) * 1.5 - VZ2[i], -0.25, 0.25);
    };

    // --- P4 借网预警: 查周边 3×3 桶里 140px 内的惊飞椋鸟, >=3 只视同猛禽逼近
    let alert = false, alx = 0, aly = 0, aln = 0;
    {
      const cx = clamp(Math.floor((xi + PAD) / CELL), 0, GW - 1);
      const cy = clamp(Math.floor((yi + PAD) / CELL), 0, GH - 1);
        for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          let gx = cx + ox, gy = cy + oy;
          if (TORUS) { gx = ((gx % GW) + GW) % GW; gy = ((gy % GH) + GH) % GH; }
          else if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) continue;
          const c2 = gy * GW + gx;
          let m = 0;                                          // 逆链成升序(与旧版同序)
          for (let j = gridHead[c2]; j !== -1; j = gridNext[j]) chainBuf[m++] = j;
          for (let q = m - 1; q >= 0; q--) {
            const j = chainBuf[q];
            if (!startled[j]) continue;
            const dx = minImageX(P[2*j] - xi), dy = minImageY(P[2*j+1] - yi);
            if (dx * dx + dy * dy > ALERT_R2) continue;
            aln++; alx += V[2*j]; aly += V[2*j+1];      // 跟流: 惊飞鸟的平均速度方向
          }
        }
      if (aln >= ALERT_N) {
        alert = true;
        stats.gooseAlerts++;
        // 附近 400px 内没有猛禽却报警 = 误报(涌现代价: 椋鸟翻滚也会触发)
        if (d > ALERT_FALSE_R) stats.gooseFalseAlerts++;
      }
    }

    let ax = 0, ay = 0;
    if (disarray > 0) {
      gooseFleeZ();                            // 第 8 轮
      // E 斩首混乱期: 槽位力关闭, 全体退化为个体径向逃逸(复用逃逸路径)
      if (d > 1e-6) {
        ax += FLEE_W * 1.2 * clamp(nx / d * MAX_SPEED_G - V2[2*i],   -FLEE_FORCE, FLEE_FORCE);
        ay += FLEE_W * 1.2 * clamp(ny / d * MAX_SPEED_G - V2[2*i+1], -FLEE_FORCE, FLEE_FORCE);
      }
    } else if (raptorNear) {
      gooseFleeZ();                            // 第 8 轮
      // 编队让位: 逃逸优先, V 形暂时解散(雁的"配合"在此刻让位于保命)
      ax += FLEE_W * 1.2 * clamp(nx / d * MAX_SPEED_G - V2[2*i],   -FLEE_FORCE, FLEE_FORCE);
      ay += FLEE_W * 1.2 * clamp(ny / d * MAX_SPEED_G - V2[2*i+1], -FLEE_FORCE, FLEE_FORCE);
    } else if (alert) {
      // 借网预警: 不靠自己的眼睛, 直接跟着惊飞椋鸟的流向走(它们逃向 = 远离猛禽)
      const an = Math.hypot(alx, aly) || 1;
      const tx2 = alx / an * MAX_SPEED_G, ty2 = aly / an * MAX_SPEED_G;
      ax += FLEE_W * 1.2 * clamp(tx2 - V2[2*i],   -FLEE_FORCE, FLEE_FORCE);
      ay += FLEE_W * 1.2 * clamp(ty2 - V2[2*i+1], -FLEE_FORCE, FLEE_FORCE);
    } else {
      // 归位: 朝自己的槽位飞(槽位由轮值平移 + 幼雁内道决定)。
      // 内联槽位计算(原 gooseSlot(i) 每帧给 60 只雁各分配一个 {x,y} 对象);
      // 注意必须与旧版逐位一致: wrapX/wrapY 先收拢槽位坐标, 再算最小像差。
      const sl = (i + gooseShift) % M;
      const rk = slotRank[sl], side = slotArm[sl] * rk * SLOT_SPACING * 0.36;
      const back = rk * SLOT_SPACING;
      const sxT = wrapX(Lx - lhx * back - lhy * side);
      const syT = wrapY(Ly - lhy * back + lhx * side);
      const gx2 = minImageX(sxT - xi), gy2 = minImageY(syT - yi);
      const gd = Math.hypot(gx2, gy2);
      if (gd > 4) {
        ax += slotScale * clamp(gx2 / gd * LEADER_SPEED - V2[2*i],   -SLOT_FORCE, SLOT_FORCE);
        ay += slotScale * clamp(gy2 / gd * LEADER_SPEED - V2[2*i+1], -SLOT_FORCE, SLOT_FORCE);
      }
      ax += 0.5 * clamp(lhx * LEADER_SPEED - V2[2*i],   -MAX_FORCE, MAX_FORCE);
      ay += 0.5 * clamp(lhy * LEADER_SPEED - V2[2*i+1], -MAX_FORCE, MAX_FORCE);
    }

    for (let j = 0; j < M; j++) {              // 雁间弱分离(O(M²), M 小无所谓)
      if (j === i || !galive[j]) continue;
      const dx = minImageX(xi - P2[2*j]), dy = minImageY(yi - P2[2*j+1]);
      const d2 = dx * dx + dy * dy;
      if (d2 < GSEP_R2 && d2 > 0) {
        const dd = Math.sqrt(d2);
        ax += dx / dd * 0.05; ay += dy / dd * 0.05;
      }
    }

    if (!TORUS) {
      if (xi < -PAD) ax += BOUND_FORCE;
      else if (xi > W + PAD) ax -= BOUND_FORCE;
      if (yi < -PAD) ay += BOUND_FORCE;
      else if (yi > H + PAD) ay -= BOUND_FORCE;
    }

    let eaten = false;                         // 猛禽顺路捕食: 雁值 100 分
    for (const f of threats) {
      const ex = minImageX(xi - f.x), ey = minImageY(yi - f.y);
      const ez = (GRAV_ON && EAT_3D) ? Z2[i] - f.z : 0;                     // 第 8 轮: 3D 判定
      if (ex * ex + ey * ey + ez * ez < EAT_R2_G) {
        f.score += SCORE_GOOSE; f.pending += SCORE_GOOSE; f.kills++;
        if (f.dashT > 0) f.dashEats++;         // A: 这次冲刺确实吃到了东西(雁也算)
        if (f.kind === "eagle") f.dietGoose++;
        stats.kills++;
        gooseDies(i);                          // 死亡流程(幼雁沮丧 / apex 斩首混乱)
        eaten = true;
        break;
      }
    }
    if (eaten) continue;

    let vx = V2[2*i] + ax, vy = V2[2*i+1] + ay;
    const sp = Math.hypot(vx, vy);
    if (sp > MAX_SPEED_G * leaderHustle) {
      const lim = MAX_SPEED_G * leaderHustle;
      vx = vx / sp * lim; vy = vy / sp * lim;
    }
    // 每只雁的转向限速(压坡惯性): 速度方向每帧最多转 GOOSE_MAX_TURN
    const curA = Math.atan2(V2[2*i+1], V2[2*i]);
    const newA = Math.atan2(vy, vx);
    const turn = clamp(angDiff(newA, curA), -GOOSE_MAX_TURN, GOOSE_MAX_TURN);
    const fA = curA + turn;
    const fSp = Math.hypot(vx, vy);
    V2[2*i] = Math.cos(fA) * fSp; V2[2*i+1] = Math.sin(fA) * fSp;
    P2[2*i]   = wrapX(xi + V2[2*i]);
    P2[2*i+1] = wrapY(yi + V2[2*i+1]);
    if (!TORUS) {                              // 【第 8 轮修正⑥ / task-6】雁也要"厌恶边界"
      const bd = boundAccel(xi, yi);
      if (bd) {
        const vOut = V2[2*i] * bd[0] + V2[2*i+1] * bd[1];
        if (vOut < 0) { const cut = -vOut * bd[3]; V2[2*i] += bd[0] * cut; V2[2*i+1] += bd[1] * cut; }
        V2[2*i] += bd[0] * bd[2]; V2[2*i+1] += bd[1] * bd[2];
      }
    }
    // 第 8 轮 z 轴: 重力 + 朝领队层的弱弹簧(雁群保持稳定的分层, 不散乱)
    if (GRAV_ON) {
      // 雁的分层: 形状弹簧(朝领队层) + 绝对层锚(把领队层拉回 GOOSE_LAYER)。
      // 【修 bug】原式是 (Z2[leaderIdx] + 6 - Z2[i]): 对领队而言目标就是它自己, 净力恒为正
      // -> 整群以 2.5px/帧无限爬升(实测 1500 帧 +3799px)。现在领队被绝对层锚住, 其余雁跟随。
      const az2 = -G_GRAV * 0.8 + (Z2[leaderIdx] - Z2[i]) * ALT_SPRING
                + (GOOSE_LAYER - Z2[leaderIdx]) * ALT_SPRING * 0.8;
      VZ2[i] = clamp(VZ2[i] * ALT_DAMP + az2, -2.5, 2.5);   // 第 8 轮修正: 同样加垂向阻尼
      Z2[i] = Math.max(FLOOR_Z, Z2[i] + VZ2[i]);
    }
  }

  /* ---- 6.6 鹰: Q-learning 决策 ----
   * 状态: 视野内(雁更近? 椋鸟更近?) × (距离近/中/远), 全空 = STATE_NONE
   * 动作: 0 追椋鸟密集处(会冲刺) / 1 追最近的雁(会冲刺)
   *       2 游荡伏击(前移拦截点, 不冲刺) / 3 攻击竞争者(最近的隼, 会冲刺)
   * 奖励: 本帧吃到的分(pending) - 代谢成本(每帧), 帧末按 (s,a)->s' 回流更新
   * 视野内什么都没有时, 先飞向记忆点, 记忆过期才原地盘旋搜索。 */
  for (let ei = 0; ei < eagles.length; ei++) {
    const E = eagles[ei];
    if (E.stun > 0) E.stun--;                  // E: 眩晕每帧递减(在动作之前)
    const pc = E.dashT > 0 ? null : perceive(E.x, E.y, E.vx, E.vy, VIEW_EAGLE_R2);
    E.seeing = !!pc;
    if (pc) { E.memX = pc.x; E.memY = pc.y; E.memT = frame; }
    // P2D 威慑锥: 锥内持续失血 —— 走 pending, 让 Q 表把"别闯雁群正面"学进去
    if (inCone3(E.x, E.y, E.z)) { E.pending -= CONE_EAGLE_DRAIN; stats.coneEagleDrain++; }   // 第 8 轮: 3D 锥

    let gi = -1, gd2 = 1e18;                   // 视野内最近的雁
    for (let j = 0; j < M; j++) {
      if (!galive[j]) continue;
      const dx = minImageX(P2[2*j] - E.x), dy = minImageY(P2[2*j+1] - E.y);
      const d2 = dx * dx + dy * dy;
      if (d2 < gd2) { gd2 = d2; gi = j; }
    }
    const gDist = gi >= 0 ? Math.sqrt(gd2) : 1e9;
    const sDist = pc ? Math.hypot(minImageX(pc.x - E.x), minImageY(pc.y - E.y)) : 1e9;

    let ri = -1, rd2 = 1e18;                   // E: 最近的竞争者(隼), 动作 3 的目标
    for (let k = 0; k < falcons.length; k++) {
      const dx = minImageX(falcons[k].x - E.x), dy = minImageY(falcons[k].y - E.y);
      const d2 = dx * dx + dy * dy;
      if (d2 < rd2) { rd2 = d2; ri = k; }
    }

    let state;
    if (gDist === 1e9 && sDist === 1e9) state = STATE_NONE;
    else {
      const prey = (gDist < sDist) ? 1 : 0;
      const dd = Math.min(gDist, sDist);
      const bin = dd < 200 ? 0 : (dd < 500 ? 1 : 2);
      state = prey * 3 + bin;
    }

    let a = 2;                                 // ε-greedy; 无目标时只能游荡
    if (state === STATE_NONE) {
      E.hold = 0;
    } else if (E.hold > 0 && state === E.holdState) {
      a = E.holdAction; E.hold--;              // 决策纪元内保持同一动作
    } else {
      if (Math.random() < E.eps) a = (Math.random() * N_ACTIONS) | 0;
      else {
        a = 0;
        for (let k = 1; k < N_ACTIONS; k++)
          if (E.Q[state*N_ACTIONS+k] > E.Q[state*N_ACTIONS+a]) a = k;
      }
      E.hold = EAGLE_DECIDE_EVERY - 1;
      E.holdState = state;
    }
    E.holdAction = a;
    if (E.curAction !== a || E.curState !== state) {     // 只在决策变化时记 -> 不刷屏
      const ACT = ["追椋鸟", "追雁", "游荡伏击", "攻击竞争者"];
      logDec(0, falcons.length + ei, "状态 s" + state + " -> " + ACT[a] +
             "(雁距 " + (gDist === 1e9 ? "-" : gDist.toFixed(0)) + ", 鸟距 " + (sDist === 1e9 ? "-" : sDist.toFixed(0)) +
             ", Q " + E.Q[state * N_ACTIONS + a].toFixed(2) + ")");
    }
    E.curState = state; E.curAction = a;

    let txp = 0, typ = 0, tzp = E.z, hasT = false;   // 第 8 轮: tzp = 目标高度(默认保持)
    if (a === 1 && gi >= 0)      { txp = P2[2*gi];   typ = P2[2*gi+1]; tzp = Z2[gi]; hasT = true; }
    else if (a === 0 && pc && pc.lockIdx >= 0) {   // P1: 采样出的"捞勺中心"
      txp = pc.cx; typ = pc.cy; tzp = pc.z + EAGLE_LAYER_OFF; hasT = true;   // 第 8 轮修正: 巡航高于鸟群
    }
    else if (a === 2 && pc) {
      // 游荡伏击: 不直线冲进群体, 而是飞到"群体行进方向前方的拦截点"等着。
      // 中心仍来自采样(P1), 用中心附近代表鸟的速度外推 AMBUSH_LEAD 帧; 伏击不冲刺。
      let lvx = 0, lvy = 0;
      if (pc.bi >= 0) { lvx = V[2*pc.bi]; lvy = V[2*pc.bi+1]; }
      txp = wrapX(pc.cx + lvx * AMBUSH_LEAD);
      typ = wrapY(pc.cy + lvy * AMBUSH_LEAD);
      tzp = pc.z + EAGLE_LAYER_OFF; hasT = true;   // 第 8 轮修正: 游荡伏击站高一层
    }
    else if (a === 3 && ri >= 0) { txp = falcons[ri].x; typ = falcons[ri].y; tzp = falcons[ri].z; hasT = true; }
    else if (freshMem(E))        { txp = E.memX;     typ = E.memY;     hasT = true; }

    const dx = hasT ? minImageX(txp - E.x) : 0;
    const dy = hasT ? minImageY(typ - E.y) : 0;
    const dth = hasT ? Math.hypot(dx, dy) : 0;

    if (E.cool > 0) E.cool--;
    if (E.dashT > 0) {                         // 冲刺惯性: 期间不转向
      E.dashT--;
      if (E.dashT === 0) {                     // 冲刺结束
        if (E.dashEats === 0) {                // A: 空冲刺: 扣分并流进 Q 学习
          E.score -= MISS_PENALTY_EAGLE;
          E.pending -= MISS_PENALTY_EAGLE;
          stats.missEagle++;
        }
        E.lockIdx = -1;                        // D: 解除锁定
      }
    }
    else if (E.stun <= 0 && a !== 2 && hasT && dth < EAGLE_DASH_TRIGGER && dth > 1 && E.cool === 0) {
      const curA = Math.atan2(E.vy, E.vx), tgtA = Math.atan2(dy, dx);
      // 【task-6】边界预测: 冲刺期速度锁定 -> 预计会冲出世界就不发起这次冲刺
      if (Math.abs(angDiff(tgtA, curA)) <= DASH_MAX_ANGLE &&
          !boundPredOut(E.x, E.y, dx / dth * EAGLE_DASH, dy / dth * EAGLE_DASH, EAGLE_DASH_FRAMES, DASH_BOUND_MARGIN)) {
        E.dashT = EAGLE_DASH_FRAMES; E.cool = EAGLE_DASH_CD;
        E.dashEats = 0;
        E.vz = clamp((tzp - E.z) * 0.04, -2.5, 2.5);   // 第 8 轮: 冲刺带垂直初速(俯冲/爬升)
        // D: 只有"追椋鸟"才是锁定式迷惑(P1: 锁采样中心那 40px 内最近的那只);
        //    追雁/攻隼不锁(雁大不存在迷惑, 对手不是"吓懵"的对象)
        E.lockIdx = (DASH_LOCK && a === 0 && pc && pc.lockIdx >= 0) ? pc.lockIdx : -1;
        if (E.lockIdx >= 0) stats.lockedDashes++;
      }
    }
    // 第 8 轮: 冲刺中受重力 —— 俯冲加速(游隼 stoop), 近地拉起不许撞地
    if (GRAV_ON && E.dashT > 0) {
      E.vz -= G_GRAV * 0.7;
      if (E.z < GROUND_MARGIN && E.vz < 0.3) E.vz = 0.3;
    }
    // C: 被围攻拖慢 + E: 眩晕减速(都只作用于非冲刺状态)
    const slow = Math.max(MOB_SLOW_EAGLE, 1 - E.mob * 0.005) * (E.stun > 0 ? 0.65 : 1);
    const spd = E.dashT > 0 ? EAGLE_DASH + (GRAV_ON ? Math.max(0, -E.vz) * DIVE_BOOST : 0) : EAGLE_CRUISE * slow;
    if (E.dashT === 0) {
      if (hasT && dth > 1) { E.vx += dx / dth * 0.25; E.vy += dy / dth * 0.25; }
      else {                                   // 纯搜索: 缓慢转向, 画大圈找人
        const ca = Math.cos(0.05), sa = Math.sin(0.05);
        const nvx = E.vx * ca + E.vy * sa, nvy = -E.vx * sa + E.vy * ca;
        E.vx = nvx; E.vy = nvy;
      }
    }
    applyBoundary(E, 2);                       // 开阔世界别飞丢了
    const vs = Math.hypot(E.vx, E.vy) || 1;
    E.vx = E.vx / vs * spd; E.vy = E.vy / vs * spd;
    E.x = wrapX(E.x + E.vx); E.y = wrapY(E.y + E.vy);
    // 第 8 轮 z 轴: 非冲刺时朝目标高度爬升/俯冲(爬升慢俯冲快), 巡航定高; 近地拉起
    if (GRAV_ON) {
      if (E.dashT === 0) {
        // 【第 8 轮修正②】鹰的俯冲相: 有目标且明显高于它时先压机头, 再冲刺(同隼的理由)
      if (hasT && E.dashT === 0 && E.z - tzp > 40) E.stoopT = 10;
      if (E.stoopT > 0) E.stoopT--;
      const dzT = tzp - E.z;
        const des = clamp(dzT / 100, -1, 1) * (dzT > 0 ? 2.6 : 4.2);
        E.vz += clamp(des - E.vz, -DIVE_RATE, CLIMB_RATE);
      }
      if (E.z < GROUND_MARGIN && E.vz < 0.3) E.vz = 0.3;
      E.z = Math.max(3, E.z + E.vz);
    }
    trailPush(E, E.x, E.y, GRAV_ON ? E.z : Z_INIT);

    // Q 更新: 把本帧吃到的分记到上一步 (状态, 动作) 头上
    E.pending -= METAB_EAGLE;                  // B: 代谢成本先进 pending, 学的才是净期望
    const reward = E.pending; E.pending = 0;
    if (reward < -1.5) logDec(3, falcons.length + ei, "净奖励 " + reward.toFixed(2) + "(含空冲刺/锥内失血/代谢)");
    let bn = E.Q[state*N_ACTIONS];
    for (let k = 1; k < N_ACTIONS; k++)
      if (E.Q[state*N_ACTIONS+k] > bn) bn = E.Q[state*N_ACTIONS+k];
    const q = E.lastState * N_ACTIONS + E.lastAction;
    E.Q[q] += Q_ALPHA * (reward + Q_GAMMA * bn - E.Q[q]);
    E.lastState = state; E.lastAction = a;
    E.eps = Math.max(EPS_MIN, E.eps * EPS_DECAY);
  }

  /* ---- 6.7 隼的策略进化: (1+1)-ES 期界结算(在隼行动之前跑, 新期参数当帧生效) ----
   * 原则: 制度(能量轮换/拦截位/交棒/驱逐)不学, 学的是制度内的操作参数 ——
   * 鹰学价值(Q-learning), 隼学策略(进化), 两种学习哲学同框。
   * 双缓冲: periods 为偶数的期评估"当前参数", 奇数的期评估"当前 + N(0,σ) 截断"的候选;
   * 期末配对比较(期长 3600 帧, 因为适应度噪声大), 候选更好就采纳(p=cand, gen++),
   * 否则回滚。适应度 = 期内净得分:
   *     fit = Δscore - ES_MISS_WEIGHT·Σ落空罚款 - ES_METAB_WEIGHT·Σ代谢成本
   * 无价值函数、无状态抽象, 纯爬山 —— 允许学成"永不出手"的局部最优(适应度≈0),
   * 那是诚实的失败模式, 不是 bug。p6 线性冲刺策略留作扩展位(见交接说明)。 */
  for (let fi = 0; fi < falcons.length; fi++) {
    const f = falcons[fi], pol = f.policy;
    if (pol.t === 0) {                           // 期初: 选这一期跑谁
      if (pol.periods % 2 === 1) {
        const c = new Float64Array(ES_NP);
        for (let k = 0; k < ES_NP; k++) c[k] = clamp(pol.p[k] + randn() * ES_SIGMA, 0, 1);
        pol.evalP = c; pol.isCand = true;        // 候选(每只隼各抽各的, 随机源不共享)
      } else {
        pol.evalP = pol.p; pol.isCand = false;   // 保留当前参数
      }
      pol.score0 = f.score; pol.miss = 0; pol.metab = 0;
    }
    pol.t++;
    if (pol.t >= (esEvalOverride || ES_EVAL_FRAMES)) {   // 期末: 配对比较 + 采纳/回滚
      const fit = (f.score - pol.score0) - ES_MISS_WEIGHT * pol.miss - ES_METAB_WEIGHT * pol.metab;
      pol.lastFit = fit;
      if (pol.isCand) {
        if (fit > pol.baseFit) { pol.p.set(pol.evalP); pol.gen++; stats.esAdopt++; logDec(5, fi, "第 " + pol.gen + " 代策略被采纳(适应度 " + fit.toFixed(1) + ")"); }
      } else {
        pol.baseFit = fit;
      }
      pol.periods++; stats.esPeriods++;
      pol.t = 0; pol.evalP = null;
    }
  }

  /* ---- 6.8 隼: 能量轮换 + 拦截位配合 + (围攻/眩晕/驱逐) + 策略参数(P3) ---- */
  for (let fi = 0; fi < falcons.length; fi++) {
    const f = falcons[fi];
    const isActive = fi === activeId;
    if (f.stun > 0) f.stun--;                  // E: 眩晕每帧递减
    if (f.clashCd > 0) f.clashCd--;
    const PV_ = policyVals(f);                 // P3: 本评估期生效的策略参数
    const coneHit = inCone3(f.x, f.y, f.z);    // P2D/第 8 轮: 闯进雁群正面 -> 失血(3D 锥)
    if (coneHit) stats.coneFalconFrames++;

    const pc = f.dashT > 0 ? null : perceive(f.x, f.y, f.vx, f.vy, VIEW_FALCON_R2);
    f.seeing = !!pc;
    if (pc) {
      f.memX = pc.x; f.memY = pc.y; f.memT = frame;
      // 【第 8 轮修正 / task-3 重做】巡航层高于鸟群, 但接近时必须下沉回猎物层: tryDash 要求冲刺方向与当前速度
      // 夹角 <= 60°, 若始终停在猎物正上方水平巡航, 俯冲角接近 90° 会被判不合格 -> 实测总捕获 77->20。
      // 层差按水平距离衰减(远在高处巡, 近回猎物层), 但输出走一阶低通:
      // 原写法(直接把 want 写进 targetZ)会与下面的压机头形成 30 帧级上下极限环, 详见常量注释。
      const dPrey = Math.hypot(minImageX(pc.x - f.x), minImageY(pc.y - f.y));
      // task-3: 参照仍是"锁定个体的高度 pc.lockZ"(第 8 轮修正③的原意: 云团厚 250px 时按
      // 平均高度俯冲撞不上), 但输出走一阶低通 —— 原写法(直接把 want 写进 targetZ)会与下面的
      // 压机头形成 30 帧级上下极限环, 详见常量注释。试过换成"视野均高 pc.z": 巡航更稳一点点,
      // 但冲刺内吃到东西的比例从 0.19/次掉到 0.05/次(3 种子), 已回退。
      const wantZ = pc.lockZ + FALCON_LAYER_OFF * clamp((dPrey - FALCON_HUNT_R) / FALCON_LAYER_RAMP, 0, 1);
      f.targetZ = (f.targetZ < 0) ? wantZ : f.targetZ + (wantZ - f.targetZ) * FALCON_ALT_SLEW;
      // 【第 8 轮修正②】高空锁定 -> 俯冲相: tryDash 的 60° 约束是对**三维速度**算的,
      // 所以"停在猎物正上方"是冲不下去的。真实猛禽也是先压机头再俯冲: 这里让它在
      // 目标位于下方且水平距离够近时进入短暂俯冲相(压机头), 速度一旦朝下, 冲刺判定自然通过。
      // 【task-3】只在"确实比目标层高出 FALCON_STOOP_DZ"时点**一次**火: 原写法 f.stoopT = 10
      // 不带条件, 于是只要还在高处就每帧续期, 压机头永不结束, 与 targetZ 的上摆命令互相打架。
      if (f.stoopT === 0 && f.z - f.targetZ > FALCON_STOOP_DZ && dPrey < 460 && f.energy >= PV_.dashMin) {
        logDec(1, fi, "高空锁定 -> 俯冲相(高于目标层 " + (f.z - f.targetZ).toFixed(0) + "px, 水平 " + dPrey.toFixed(0) + "px)");
        f.stoopT = 10;
      }
      // task-3: 俯冲相期间把目标层一并压到猎物层 —— "承诺式下潜", 10 帧结束后不会再回弹到巡航层
      if (f.stoopT > 0) f.targetZ = pc.lockZ;
    }
    if (f.stoopT > 0) f.stoopT--;

    if (f.dashT > 0) {
      // 冲刺: 速度锁定不调整; B 代谢 + C 围攻者越多烧得越快(容忍度 p5 由 ES 学)
      f.dashT--;
      const coneMult = coneHit ? CONE_FALCON_DASH_MULT : 1;      // P2D: 锥内冲刺能耗 ×2
      const drain = (DASH_DRAIN * (1 + f.mob * MOB_DRAIN_PER * PV_.mobTol) + METAB_DASH) * coneMult;
      f.energy = Math.max(0, f.energy - drain);
      f.policy.metab += drain;                 // P3: 代谢成本计入适应度
      applyBoundary(f, 2);
      // 第 8 轮: 冲刺中受重力 —— 俯冲加速(stoop), 近地拉起
      if (GRAV_ON) {
        f.vz -= G_GRAV * 0.7;
        if (f.z < GROUND_MARGIN && f.vz < 0.3) f.vz = 0.3;
      }
      // C: 被围到临界值 -> 冲刺被硬生生打断, 走下面正常的落空罚款流程
      if (f.mob >= MOB_PENALTY_N) { f.dashT = 0; stats.mobInterrupts++; }
      const effDash = DASH_SPEED + (GRAV_ON ? Math.max(0, -f.vz) * DIVE_BOOST : 0);
      const ps = Math.hypot(f.vx, f.vy);
      if (ps > 1e-9) { f.vx = f.vx / ps * effDash; f.vy = f.vy / ps * effDash; }
      if (f.dashT === 0) {                     // 冲刺结束
        if (f.dashEats === 0) {                // A: 空冲刺扣分
          f.score -= MISS_PENALTY_FALCON;
          f.policy.miss += MISS_PENALTY_FALCON;   // P3: 落空罚款计入适应度
          stats.missFalcon++;
        }
        // P1 验收取样: 冲刺终点 80px 内还有多少可见鸟(拣软处下口是否自发产生)
        const pe = perceive(f.x, f.y, f.vx, f.vy, 80 * 80);
        stats.dashEnds++;
        stats.dashEndBirds += pe ? pe.n : 0;
        if (f.dashS > stats.dashMaxEats) stats.dashMaxEats = f.dashS;
        if (f.lockIdx >= 0) {                  // 锁定冲刺(捕猎)
          if (f.dashS > stats.dashMaxEatsLocked) stats.dashMaxEatsLocked = f.dashS;
        } else if (f.dashS > stats.dashMaxEatsFree) stats.dashMaxEatsFree = f.dashS;
        // P2D 验收: 终点与 V 尖的关系(锥是否真的把冲刺挤开了)
        if (galiveCount > 0) {
          const dA = Math.hypot(minImageX(f.x - Lx), minImageY(f.y - Ly));
          stats.dashEndApexSum += dA;
          if (dA < 200) stats.dashEndApexNear++;
          if (inCone3(f.x, f.y, f.z)) stats.dashEndInCone++;      // 第 8 轮: 3D 锥
        }
        f.circleT = CIRCLE_FRAMES;
        f.lockIdx = -1;                        // D: 解除锁定
      }
    } else {
      // C 围攻 + E 眩晕: 都只拖慢非冲刺状态
      const slow = Math.max(MOB_SLOW_FALCON, 1 - f.mob * 0.01) * (f.stun > 0 ? 0.6 : 1);

      // 盘旋: 缓慢绕圈(所有非冲刺状态都叠这一层转向)
      const ca = Math.cos(CIRCLE_TURN), sa = Math.sin(CIRCLE_TURN);
      const nvx = f.vx * ca + f.vy * sa;
      const nvy = -f.vx * sa + f.vy * ca;
      f.vx = nvx; f.vy = nvy;

      if (isActive) {
        // 追猎方: 视野内朝群体质心修正, 看不见就飞向记忆点
        if (pc) {
          const dfx = minImageX(pc.x - f.x), dfy = minImageY(pc.y - f.y);
          const df = Math.hypot(dfx, dfy);
          if (df > 200) { f.vx += dfx / df * 0.6; f.vy += dfy / df * 0.6; }
        } else if (freshMem(f)) {
          const mx = minImageX(f.memX - f.x), my = minImageY(f.memY - f.y);
          const md = Math.hypot(mx, my);
          if (md > 1) { f.vx += mx / md * 0.6; f.vy += my / md * 0.6; }
        }
        applyBoundary(f, 2);
        const ps = Math.hypot(f.vx, f.vy);
        const cspd = CIRCLE_SPEED * slow;
        if (ps > 1e-9) { f.vx = f.vx / ps * cspd; f.vy = f.vy / ps * cspd; }

        f.energy = Math.min(ENERGY_MAX, f.energy + ACTIVE_REGEN - METAB_CIRCLE);
        f.policy.metab += METAB_CIRCLE;
        f.circleT--;

        // 能量低(p2) -> 退出追猎, 让设伏位的另一只立刻接棒
        if (f.energy < PV_.energyLow) {
          activeId = (fi + 1) % falcons.length;
          falcons[activeId].circleT = 0;
          continue;
        }
        // 盘旋期满 + 能量够(p1) + 不晕 + 采样到可用目标 -> 冲刺(60° 约束, D 锁定)
        if (f.circleT <= 0 && f.energy >= PV_.dashMin && f.stun <= 0 && pc) {
          if (pc.cx < 0) { stats.noLockAborts++; f.circleT = 4; }   // P1: 40px 内无鸟 -> 放弃(隔几帧再采样)
          else if (tryDash(f, pc.cx, pc.cy, pc.lockIdx, pc.lockZ)) {   // 第 8 轮修正③: 冲刺瞄锁定个体
        logDec(1, fi, "追猎冲刺: 采样中心 (" + pc.cx.toFixed(0) + "," + pc.cy.toFixed(0) + ") z=" + pc.z.toFixed(0) +
               " 锁定#" + pc.lockIdx + " 能量 " + f.energy.toFixed(0));
      } else { f.circleT = 8; logDec(2, fi, "追猎冲刺落空(航向夹角过大)"); }
        }
      } else {
        // 设伏方: 不算全局鸟群, 只用自己视野里的质心推拦截位 ——
        // 鸟群总朝远离追猎方的方向逃, 逃逸走廊的尽头就是设伏点(p4 外推比例可学)。
        let travel = false, tx = 0, ty = 0, d = 0;
        if (pc) {
          const af = falcons[activeId];
          const ax0 = minImageX(pc.x - af.x), ay0 = minImageY(pc.y - af.y);
          const ipx = wrapX(pc.x + ax0 * PV_.interceptAhead);
          const ipy = wrapY(pc.y + ay0 * PV_.interceptAhead);
          tx = minImageX(ipx - f.x); ty = minImageY(ipy - f.y);
          d = Math.hypot(tx, ty);
          travel = d > INTERCEPT_MIN;
        } else if (freshMem(f)) {
          tx = minImageX(f.memX - f.x); ty = minImageY(f.memY - f.y);
          d = Math.hypot(tx, ty);
          travel = d > INTERCEPT_MIN;
        }
        if (travel && d > 1) {
          // 未到拦截位: 高速赶路(A 版: 设伏方速度 7.5 > 盘旋 5.0)
          f.vx += clamp(tx / d * REST_SPEED - f.vx, -0.8, 0.8);
          f.vy += clamp(ty / d * REST_SPEED - f.vy, -0.8, 0.8);
        } else if (pc && d > 1) {
          f.vx += tx / d * INTERCEPT_GAIN;     // 已到位: 小幅贴向设伏点
          f.vy += ty / d * INTERCEPT_GAIN;
        }
        applyBoundary(f, 2);
        const ps = Math.hypot(f.vx, f.vy);
        const spd = (travel ? REST_SPEED : CIRCLE_SPEED) * slow;
        if (ps > 1e-9) { f.vx = f.vx / ps * spd; f.vy = f.vy / ps * spd; }

        f.energy = Math.min(ENERGY_MAX, f.energy + REST_REGEN - METAB_CIRCLE);
        f.policy.metab += METAB_CIRCLE;
        f.circleT--;

        // 偶发双打(p3): 设伏方能量很满且采样到可用目标时, 不等接棒直接出手
        if (f.circleT <= 0 && f.energy >= PV_.doubleTeam && f.stun <= 0 && pc) {
          if (pc.cx < 0) { stats.noLockAborts++; f.circleT = 4; }
          else if (tryDash(f, pc.cx, pc.cy, pc.lockIdx, pc.lockZ)) {   // 第 8 轮修正③: 冲刺瞄锁定个体
        logDec(1, fi, "双隼夹击冲刺: 能量 " + f.energy.toFixed(0) + " 锁定#" + pc.lockIdx);
      } else { f.circleT = 10; logDec(2, fi, "夹击冲刺落空(航向夹角过大)"); }
        }
      }

      // E 驱逐冲刺: 优先级低于捕猎 —— 附近有对手(另一只隼或鹰)且能量够就撞上去,
      // 撞上后由 6.9 的互攻判定决胜负。没有猎物可追时这就是唯一出路。
      if (f.dashT === 0 && f.stun <= 0 && f.circleT <= 0 && f.energy >= PV_.dashMin) {
        let rv = null, rvd2 = 1e18;
        for (const r of raptors) {
          if (r === f) continue;
          const dx = minImageX(r.x - f.x), dy = minImageY(r.y - f.y);
          const d2 = dx * dx + dy * dy;
          if (d2 < rvd2) { rvd2 = d2; rv = r; }
        }
        if (rv && rvd2 < RIVAL_R * RIVAL_R) {
          if (tryDash(f, rv.x, rv.y, -1, rv.z)) {
          logDec(1, fi, "驱逐竞争者冲刺(目标 z=" + rv.z.toFixed(0) + ")");
        } else { f.circleT = 6; logDec(2, fi, "驱逐冲刺落空"); }
        }
      }
    }
    f.x = wrapX(f.x + f.vx);
    f.y = wrapY(f.y + f.vy);
    // 第 8 轮 z 轴: 非冲刺时朝目标高度爬升/俯冲, 巡航定高; 近地拉起
    if (GRAV_ON) {
      if (f.dashT === 0) {
        // task-3: 垂向只有一个目标层(俯冲相在上面的 if(pc) 里已把目标层压到猎物层), 且控制器
        // 加了 FALCON_ALT_LEAD 帧的前瞻阻尼: 原来的 pure-P + vz 速率限幅(爬 0.14 / 俯 0.26)
        // 是欠阻尼的 —— 冲过目标层后要 30 帧才能把 vz 反号, 于是自己就摆起来了。
        const tzF = (f.targetZ >= 0) ? f.targetZ : f.z;
        const dzT = tzF - f.z;
        const des = clamp((dzT - FALCON_ALT_LEAD * f.vz) / 100, -1, 1) * (dzT > 0 ? 2.6 : 4.2);
        f.vz += clamp(des - f.vz, -DIVE_RATE, CLIMB_RATE);
      }
      if (f.z < GROUND_MARGIN && f.vz < 0.3) f.vz = 0.3;
      f.z = Math.max(3, f.z + f.vz);
    }
    trailPush(f, f.x, f.y, GRAV_ON ? f.z : Z_INIT);
  }

  /* ---- 6.9 猎物补充 ---- */
  if (frame % REFILL_CHECK === 0) maybeRefill();

  /* ---- 6.10 猛禽互攻(驱逐制): 三只两两判定 ----
   * 实力 = 冲刺中 +2 / 鹰体型 +1.5 / 眩晕 -3 / 噪声;
   * 败方被击退 + 眩晕 + 扣分 + 被抢走剩余分数的 STEAL_FRAC; 胜方拿走抢来的分。
   * 加了 CLASH_CD 冷却: 否则贴在一起的两只猛禽会逐帧互相扣分, 分数瞬间崩掉。 */
  for (let i = 0; i < raptors.length; i++) {
    for (let j = i + 1; j < raptors.length; j++) {
      const A = raptors[i], B = raptors[j];
      if (A.clashCd > 0 || B.clashCd > 0) continue;
      const dx = minImageX(B.x - A.x), dy = minImageY(B.y - A.y);
      const d2 = dx * dx + dy * dy;
      if (d2 >= CLASH_R * CLASH_R || d2 < 1e-6) continue;

      const sA = (A.dashT > 0 ? 2 : 0) + (A.kind === "eagle" ? 1.5 : 0) + (A.stun > 0 ? -3 : 0) + Math.random();
      const sB = (B.dashT > 0 ? 2 : 0) + (B.kind === "eagle" ? 1.5 : 0) + (B.stun > 0 ? -3 : 0) + Math.random();
      const win = sA >= sB ? A : B, lose = win === A ? B : A;
      const md = Math.sqrt(d2);
      const nx = dx / md, ny = dy / md;              // A -> B 的单位向量

      // 败方被击退(位置 + 速度都推一把), 眩晕, 扣分, 被抢分
      lose.x = wrapX(lose.x + (lose === B ? nx : -nx) * CLASH_KNOCK);
      lose.y = wrapY(lose.y + (lose === B ? ny : -ny) * CLASH_KNOCK);
      lose.vx = (lose === B ? nx : -nx) * 4;
      lose.vy = (lose === B ? ny : -ny) * 4;
      lose.stun = CLASH_STUN;
      if (lose.dashT > 0) {                          // 被打断的冲刺同样走落空罚款流程
        if (lose.dashEats === 0) {
          if (lose.kind === "eagle") {
            lose.score -= MISS_PENALTY_EAGLE; lose.pending -= MISS_PENALTY_EAGLE; stats.missEagle++; logDec(3, 255, "鹰空冲刺罚款 -" + MISS_PENALTY_EAGLE);
          } else {
            lose.score -= MISS_PENALTY_FALCON; stats.missFalcon++; logDec(3, lose === eagle ? falcons.length : falcons.indexOf(lose), "空冲刺罚款 -" + MISS_PENALTY_FALCON);
          }
        }
        if (lose.kind !== "eagle") lose.circleT = CIRCLE_FRAMES;
      }
      lose.dashT = 0; lose.lockIdx = -1;
      lose.score -= CLASH_COST;
      const stolen = lose.score > 0 ? Math.floor(lose.score * STEAL_FRAC) : 0;
      lose.score -= stolen;
      win.score += stolen;
      win.dashEats++;                                // 胜方免空冲刺罚款
      // 鹰的奖惩要走 pending, 否则 Q 学习看不见互攻这件事
      if (win.kind === "eagle") win.pending += stolen;
      logDec(4, 255, win.label.split(" ")[0] + " 驱逐成功(抢分 " + stolen + ")");
      if (lose.kind === "eagle") lose.pending -= CLASH_COST;
      A.clashCd = CLASH_CD; B.clashCd = CLASH_CD;
      stats.clashes++;
      if (stolen > 0) stats.steals++;
    }
  }
}

/* ============================================================================
 * 第 8 轮: 3D 视角层 —— 轨道相机 + 透视投影 + 雾
 * ----------------------------------------------------------------------------
 * 世界坐标: x 右, y 下(z 轴向上)。默认 3D 环绕视角(拖拽旋转 / 滚轮缩放 /
 * 目标自动跟随群体质心与均高); ?view=top 进入旧俯视(投影层退化为恒等映射,
 * 所有旧渲染路径原样工作)。GL3D 后端不可用时的兜底是 CPU 软投影(慢, 但正确)。
 * ========================================================================== */
let VIEW3D = true;
try { if (/[?&]view=top/.test(window.location.search)) VIEW3D = false; } catch (e) { /* headless */ }
let gl3dReady = false;
let ovClear = false;                       // 叠加层本帧是否需要 clear(底层是 GL 不透明画面时)
const cam = { yaw: 0.7, pitch: 0.52, dist: 950, tx: W / 2, ty: H / 2, tz: Z_INIT, auto: false };   // 【第 8 轮修正⑤】默认不自动转(要转再勾)
let vpM = new Float32Array(16);

function perspM(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1;
  m[14] = 2 * far * near / (near - far);
  return m;
}
function lookAtM(ex, ey, ez, cx, cy, cz) {
  let fx = cx - ex, fy = cy - ey, fz = cz - ez;
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  // 世界上方向 = +z
  const sx = fy, sy = -fx, sz = 0;           // s = f × up(世界上方向取 +z): (fy, -fx, 0) —— sz 恒为 0
  const sl = Math.hypot(sx, sy) || 1;
  const ux2 = sy * fz - sz * fy, uy2 = sz * fx - sx * fz, uz2 = sx * fy - sy * fx;  // s × f
  const m = new Float32Array(16);
  m[0] = sx;  m[1] = ux2; m[2] = -fx; m[3] = 0;
  m[4] = sy;  m[5] = uy2; m[6] = -fy; m[7] = 0;
  m[8] = sz;  m[9] = uz2; m[10] = -fz; m[11] = 0;
  m[12] = -(sx * ex + sy * ey + sz * ez);
  m[13] = -(ux2 * ex + uy2 * ey + uz2 * ez);
  m[14] = (fx * ex + fy * ey + fz * ez);
  m[15] = 1;
  return m;
}
function mulM(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let t = 0;
    for (let k = 0; k < 4; k++) t += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = t;
  }
  return o;
}
function updateCamera() {
  cam.tx += (cxmI - cam.tx) * 0.04;
  cam.ty += (cymI - cam.ty) * 0.04;
  cam.tz += (zMeanLive - cam.tz) * 0.04;
  if (cam.auto) cam.yaw += 0.0022;         // 无输入时缓慢公转
  cam.pitch = clamp(cam.pitch, -1.25, 1.42);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const ex = cam.tx + Math.sin(cam.yaw) * cp * cam.dist;
  const ey = cam.ty - Math.cos(cam.yaw) * cp * cam.dist;
  const ez = Math.max(24, cam.tz + sp * cam.dist + 40);
  vpM = mulM(perspM(0.92, W / H, 2, 6000), lookAtM(ex, ey, ez, cam.tx, cam.ty, cam.tz));
}

/* 3D -> 屏幕。俯视模式退化为恒等映射(与旧 2D 完全一致);
 * s = 近大远小系数, f = 雾(远淡), ok = 在视锥内。 */
const PR_A = { x: 0, y: 0, s: 1, f: 1, ok: true };
const PR_B = { x: 0, y: 0, s: 1, f: 1, ok: true };
const PR_C = { x: 0, y: 0, s: 1, f: 1, ok: true };
function project(x, y, z, out) {
  if (!VIEW3D) { out.x = x; out.y = y; out.s = 1; out.f = 1; out.ok = true; return out; }
  const m = vpM;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw < 2) { out.ok = false; return out; }
  out.ok = true;
  out.x = (cx / cw * 0.5 + 0.5) * W;
  out.y = (0.5 - cy / cw * 0.5) * H;
  out.s = clamp(420 / cw, 0.22, 3.4);
  out.f = clamp(1.3 - cw * 0.00115, 0.18, 1);
  return out;
}

function toggleView() {
  VIEW3D = !VIEW3D;
  const b = document.getElementById("btnView");
  if (b) b.textContent = VIEW3D ? "切换俯视（T）" : "切换 3D（T）";
  if (VIEW3D && !gl3dReady && !glTried) tryInitGL();
}

/* 相机输入: 左键拖拽旋转(自动关自动环绕), 滚轮缩放; 面板是独立 DOM, 不冲突 */
(function camInput() {
  const stage = document.getElementById("stage");
  let dragging = false, lx = 0, ly = 0;
  stage.addEventListener("mousedown", e => { dragging = true; lx = e.clientX; ly = e.clientY; cam.auto = false;
    const cb = document.getElementById("cbAuto"); if (cb) cb.checked = false; });
  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    cam.yaw += (e.clientX - lx) * 0.006;
    cam.pitch = clamp(cam.pitch + (e.clientY - ly) * 0.005, -1.25, 1.42);
    lx = e.clientX; ly = e.clientY;
  });
  window.addEventListener("mouseup", () => dragging = false);
  stage.addEventListener("wheel", e => {
    e.preventDefault();
    cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.001), 260, 3400);
  }, { passive: false });
})();

/* ------------------------------ 7. 渲染 ------------------------------ */

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const qcv = document.getElementById("qcv");
const qctx = qcv.getContext("2d");

// 渲染后端选择: 默认 WebGL(底层实例化), ?render=2d 强制走原来的 Canvas2D 全路径
let glReady = false, glTried = false, forceGL = false, glUsed = false;
let want2D = false;
try { want2D = /[?&]render=2d/.test(window.location.search); } catch (e) { /* 无 location(headless) */ }

// 性能 EMA(面板与 SIM.perf 都用它): stepMs / renderMs / gl + WebGPU 计算三段耗时
const perf = { stepMs: 0, renderMs: 0, gl: false, uploadMs: 0, gpuMs: 0, readbackMs: 0 };
function perfPush(step, render) {
  perf.stepMs = perf.stepMs * 0.9 + step * 0.1;
  perf.renderMs = perf.renderMs * 0.9 + render * 0.1;
}

// 计算后端选择: ?compute=cpu | gpu | auto(默认). CPU 路径永久保留作参照与兜底。
let computeMode = "auto", gpuCompute = false;
try {
  const m = /[?&]compute=(\w+)/.exec(window.location.search);
  if (m && ["cpu", "gpu", "auto"].indexOf(m[1]) >= 0) computeMode = m[1];
} catch (e) { /* 无 location(headless) */ }
let computeSelfCheck = null, computeInitInfo = null;
let diagMode = false;                          // ?diag=1: 周期性往控制台打一行性能/状态, 便于无头或真机取证
try { diagMode = /[?&]diag=1/.test(window.location.search); } catch (e) { /* 无 location */ }
let diagTicks = 0;
let initTimeoutMs = 3000;                      // WebGPU 初始化超时(?initTimeout=ms 可调, 慢机器/冷启动用)
try {
  const m = /[?&]initTimeout=(\d+)/.exec(window.location.search);
  if (m) initTimeoutMs = Math.max(500, Math.min(60000, +m[1]));
} catch (e) { /* 无 location */ }

// 交给 WebGPU 计算后端(第三个 <script>)的场景桥: 定型数组 + 网格常量 + CPU 参考实现的回调
const computeScene = {
  W, H, P, V, ACC, alive, maxN: MAXN,
  counts: () => ({ n: N }),
  grid: {
    get gw() { return GW; }, get gh() { return GH; },
    get topoK() { return topoK; }, cell: CELL, pad: PAD, torus: TORUS,
    perceptionR2: PERCEPTION_R2, sepR2: SEP_R2, sepGain: SEP_GAIN,
    maxSpeed: MAX_SPEED, maxForce: MAX_FORCE, cohesionW: COHESION_W, alignmentW: ALIGNMENT_W,
  },
  // 自检用: 跑一遍 CPU 版 6.1+6.2 并把 ACC 拷进 out(不动其它状态)
  cpuForces: (out) => {
    const saveCxm = cxmI, saveCym = cymI;
    cpuGridAndForces(TORUS);
    out.set(ACC.subarray(0, out.length));
    cxmI = saveCxm; cymI = saveCym;
  },
  perf,
};

// 交给 WebGL 后端的场景桥(第二个 <script> 区块里的 GLBackend 直接读这些定型数组)
  const glScene = {
    // 【第 8 轮修正⑥】s.W/s.H 是**视口**(纹理/投影/像素尺度都用它), 世界尺寸另给 worldW/worldH
    W: VIEW_W, H: VIEW_H, worldW: W, worldH: H, P, V, alive, P2, V2, galive, maxN: MAXN, maxM: M,
  Z, VZ, Z2, VZ2,                                    // 第 8 轮: 3D 实例属性源
  counts: () => ({ n: N, m: M, aliveCount, galiveCount }),
  colors: { starling: [200 / 255, 215 / 255, 235 / 255], goose: [255 / 255, 200 / 255, 110 / 255] },
  shapes: { starling: BODY_S, goose: BODY_G },   // [尖端, 尾长, 翼展] 与 2D 的 drawArrow 共用同一组常量
  bg: [10 / 255, 12 / 255, 18 / 255],
  // 三维渲染参数(第 8 轮调优): 体积倍数 + 高度范围(亮度映射) + 视场角(算像素尺度)
  fov: 0.92,
  get size3dMul() { return SIZE3D_MUL; },
  get trail3() { return { on: TRAIL3_ON, len: TRAIL3_LEN, w: TRAIL3_W, alpha: TRAIL3_ALPHA }; },
  // 第 8 轮修正: 诊断"加减猛禽后别名是否指向活对象"
  raptorRefs: () => ({ eagleIsLive: eagle === (eagles[0] || null), eagleNull: eagle === null,
                       falcons: falcons.map(f => f.label), eagles: eagles.map(E => E.label),
                       total: raptors.length, activeId }),
  get stoop() { return raptors.map(r => r.stoopT || 0); },
  size3dMinPx: SIZE3D_MINPX,
  get zLow() { return zLowLive; },
  get zHigh() { return zHighLive; },
  fade: 0.16,                                    // 与 fillRect(rgba(10,12,18,0.16)) 等价
  perf,
};

// ---- UI 状态 ----
let showVision = false, showFormation = true, refillOn = true;
let paused = false, speedMul = 1;
let fpsEma = 60, lastT = performance.now(), lastPanelT = 0;

// 渲染侧零分配: 虚线样式数组与辉光精灵都预生成一次, 不再每帧 new
const EMPTY_DASH = [];
const DASH_VISION = [4, 10], DASH_MEM = [5, 7], DASH_AXIS = [3, 9], DASH_FORM = [6, 8], DASH_MINI = [3, 4];
const glowSprites = new Map();                // 颜色 -> 64×64 预渲染径向辉光
function glowSprite(C) {
  let s = glowSprites.get(C);
  if (s) return s;
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g2 = c.getContext("2d");
  const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${C}, 1)`);
  grad.addColorStop(1, `rgba(${C}, 0)`);
  g2.fillStyle = grad;
  g2.fillRect(0, 0, 64, 64);
  glowSprites.set(C, c);
  return c;
}

function drawArrow(x, y, vx, vy, sTip, sBack, sWing) {
  // 通用 ">": 尖端在速度方向 sTip 处, 批量塞进同一条 path 一次描边
  const sp = Math.hypot(vx, vy) || 1;
  const ux = vx / sp, uy = vy / sp, qx = -uy, qy = ux;
  const tx = x + ux * sTip, ty = y + uy * sTip;
  const bx = x - ux * sBack, by = y - uy * sBack;
  ctx.moveTo(bx + qx * sWing, by + qy * sWing);
  ctx.lineTo(tx, ty);
  ctx.lineTo(bx - qx * sWing, by - qy * sWing);
}

// 拖尾环形缓冲: 定容 Float32Array + 头指针, 推一个点 O(1), 永不分配(第 8 轮: 3 分量)
function trailPush(o, x, y, z) {
  const L = TRAIL_LEN;
  if (o.trailN < L) {
    const idx = (o.trailHead + o.trailN) * 3;
    o.trailBuf[idx] = x; o.trailBuf[idx + 1] = y; o.trailBuf[idx + 2] = z; o.trailN++;
  } else {
    o.trailBuf[o.trailHead * 3] = x; o.trailBuf[o.trailHead * 3 + 1] = y; o.trailBuf[o.trailHead * 3 + 2] = z;
    o.trailHead = (o.trailHead + 1) % L;
  }
}

/* ---- 第 8 轮: 尸体下坠(被吃的鸟带初速做抛体, 落地停住后消散) ---- */
const CORPSE_CAP = 384;
const cX = new Float32Array(CORPSE_CAP), cY = new Float32Array(CORPSE_CAP), cZ = new Float32Array(CORPSE_CAP);
const cVX = new Float32Array(CORPSE_CAP), cVY = new Float32Array(CORPSE_CAP), cVZ = new Float32Array(CORPSE_CAP);
const cT = new Float32Array(CORPSE_CAP);          // 存活帧数(0 = 空位)
let cCursor = 0;
function spawnCorpse(x, y, z, vx, vy, vz) {
  const k = cCursor;
  cX[k] = x; cY[k] = y; cZ[k] = z; cVX[k] = vx; cVY[k] = vy; cVZ[k] = vz; cT[k] = 1;
  cCursor = (cCursor + 1) % CORPSE_CAP;
}
function stepCorpses() {
  if (!GRAV_ON) return;
  for (let k = 0; k < CORPSE_CAP; k++) {
    if (cT[k] <= 0) continue;
    cT[k]++;
    cVZ[k] -= 0.055;                             // 尸体只受重力(无弹簧)
    cX[k] += cVX[k]; cY[k] += cVY[k]; cZ[k] += cVZ[k];
    if (cZ[k] <= FLOOR_Z) {                      // 落地: 滑动衰减, 停留 60 帧后消散
      cZ[k] = FLOOR_Z; cVX[k] *= 0.8; cVY[k] *= 0.8; cVZ[k] = 0;
      if (cT[k] > 60) cT[k] = 0;
    } else if (cT[k] > 240) cT[k] = 0;
  }
}

// 拖尾颜色字符串缓存: 按(颜色, 透明度档位)预生成, 避免每段一次模板字符串
const TRAIL_BUCKETS = 12;
const trailColorCache = new Map();
function trailColor(C, a) {
  let bucket = (a * TRAIL_BUCKETS) | 0;
  if (bucket < 0) bucket = 0; else if (bucket >= TRAIL_BUCKETS) bucket = TRAIL_BUCKETS - 1;
  const key = C + "|" + bucket;
  let s = trailColorCache.get(key);
  if (s === undefined) {
    s = `rgba(${C}, ${((bucket + 0.5) / TRAIL_BUCKETS).toFixed(3)})`;
    trailColorCache.set(key, s);
  }
  return s;
}

// 猛禽的公共画法(隼/鹰共用; 第 8 轮: 全坐标过 project(), 近大远小 + 雾)。
// 返回 {x,y,s,f} 给标签/能量条复用; 在视锥外返回 null。
function drawHunter(h, dash, opt) {
  const C = h.color;
  project(h.x, h.y, h.z, PR_A);
  if (!PR_A.ok) return null;
  const sx = PR_A.x, sy = PR_A.y, ss = PR_A.s, ff = PR_A.f;

  const n = h.trailN;
  if (n >= 2) {                                // 环形缓冲按时间序连点(3D 投影)
    const L = TRAIL_LEN;
    ctx.lineCap = "round";
    let px = 0, py = 0, open = true;
    for (let k = 0; k < n; k++) {
      const idx = ((h.trailHead + k) % L) * 3;
      project(h.trailBuf[idx], h.trailBuf[idx + 1], h.trailBuf[idx + 2], PR_B);
      if (!PR_B.ok) { open = true; continue; }
      if (!open) {
        const dx = PR_B.x - px, dy = PR_B.y - py;
        if (dx * dx + dy * dy <= 2500 * ss * ss) {   // 投影跳变(转到背侧)不连线
          ctx.strokeStyle = trailColor(C, opt.trailA * (k + 1) / n * ff);
          ctx.lineWidth = (dash ? 2.5 : 1.5) * Math.max(0.55, ss);
          if (dash) { ctx.shadowColor = `rgb(${C})`; ctx.shadowBlur = 14; }
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(PR_B.x, PR_B.y);
          ctx.stroke();
        }
      }
      px = PR_B.x; py = PR_B.y; open = false;
    }
    ctx.shadowBlur = 0;
  }

  if (h.shock) {                               // 冲刺冲击波(带高度)
    h.shock.t++;
    const alpha = (1 - h.shock.t / 35) * ff;
    if (h.shock.t >= 35 || alpha <= 0.02) h.shock = null;
    else {
      project(h.shock.x, h.shock.y, h.shock.z || Z_INIT, PR_B);
      const r = h.shock.t * 9 * ss;
      if (PR_B.ok && r > 0.6) {
        ctx.strokeStyle = `rgba(${C}, ${alpha * 0.8})`;
        ctx.lineWidth = 2.5 * ss;
        ctx.shadowColor = `rgb(${C})`; ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(PR_B.x, PR_B.y, r, 0, TAU);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }

  if (showVision && opt.visionR) {             // 视野球 -> 屏幕圆(半径随深度缩放)
    const r = opt.visionR * ss;
    if (r > 4) {
      ctx.save();
      ctx.setLineDash(DASH_VISION);
      ctx.strokeStyle = `rgba(${C}, ${0.10 * ff})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (!h.seeing && freshMem(h)) {              // 搜索中: 朝记忆点的虚线
    project(h.memX, h.memY, h.z, PR_B);
    if (PR_B.ok) {
      ctx.save();
      ctx.setLineDash(DASH_MEM);
      ctx.strokeStyle = `rgba(${C}, ${0.20 * ff})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(PR_B.x, PR_B.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  const glowR = (dash ? opt.glowDash : opt.glow) * ss;
  ctx.globalAlpha = (dash ? 0.55 : opt.glowA) * ff;
  ctx.drawImage(glowSprite(C), sx - glowR, sy - glowR, glowR * 2, glowR * 2);
  ctx.globalAlpha = 1;

  // 朝向: 投影"位置 + 速度×6"两点, 用屏幕连线方向画 ">"(飞行姿态在屏幕上自然呈现)
  project(h.x + h.vx * 6, h.y + h.vy * 6, h.z + h.vz * 6, PR_B);
  const avx = PR_B.ok ? PR_B.x - sx : h.vx, avy = PR_B.ok ? PR_B.y - sy : h.vy;
  ctx.strokeStyle = `rgb(${C})`;
  ctx.lineWidth = (dash ? 2.2 : 1.5) * Math.max(0.55, ss);
  ctx.shadowColor = `rgb(${C})`;
  ctx.shadowBlur = dash ? 24 : 12;
  ctx.beginPath();
  drawArrow(sx, sy, avx, avy, (dash ? opt.size[0] : opt.size[1]) * ss, opt.size[2] * ss, opt.size[2] * ss);
  ctx.stroke();
  ctx.shadowBlur = 0;
  PR_C.x = sx; PR_C.y = sy; PR_C.s = ss; PR_C.f = ff;
  return PR_C;
}

/* render2D(): 原 Canvas2D 全路径(拖尾残影 + 鸟群本体), 由 ?render=2d 或 GL 不可用时走
   renderOverlay(): 两种模式共用的 2D 叠加层(威慑锥/编队线/涟漪/猛禽/小地图/标签) */
function render2D() {
  // GL 曾经跑过又中途降级时, 底层 canvas 还留着上一帧, 先铺一层不透明背景
  if (glUsed) { ctx.fillStyle = "#0a0c12"; ctx.fillRect(0, 0, W, H); glUsed = false; }
  // 半透明覆盖 = 所有鸟自带拖尾(代价低, 效果好)
  ctx.fillStyle = "rgba(10, 12, 18, 0.16)";
  ctx.fillRect(0, 0, W, H);

  if (!TORUS) {                                // 视口只是世界的一扇窗
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  // ---- 椋鸟(灰白, 一批 path 一次描边; F: 体型收小) ----
  ctx.strokeStyle = "rgb(200, 215, 235)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    if (!alive[i]) continue;
    drawArrow(P[2*i], P[2*i+1], V[2*i], V[2*i+1], BODY_S[0], BODY_S[1], BODY_S[2]);
  }
  ctx.stroke();

  // 雁的本体(2D 路径); GL 模式下这两段由 shader 实例化绘制
  ctx.strokeStyle = "rgb(255, 200, 110)";
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  for (let i = 0; i < M; i++) {
    if (!galive[i]) continue;
    drawArrow(P2[2*i], P2[2*i+1], V2[2*i], V2[2*i+1], BODY_G[0], BODY_G[1], BODY_G[2]);
  }
  ctx.stroke();

  renderOverlay();
}

// 2D 叠加层(第 8 轮: 全部经 project() —— 俯视模式退化为旧 2D 行为):
// 猛禽/标签/能量条/涟漪/尸体/小地图/视野圈/配合轴线/威慑锥。实体数 <= 20, Canvas2D 够用。
function renderOverlay() {
  if (ovClear) ctx.clearRect(0, 0, W, H);      // 底层 GL 已画不透明画面 -> 先清叠加层
  else if (!TORUS) {
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  // ---- 雁群: 威慑锥(3D 扇形投影) / 编队线 / 数量标签 ----
  if (galiveCount > 0) {
    const LZ = Z2[leaderIdx];
    const fan = (r, fill, stroke) => {
      project(Lx, Ly, LZ, PR_A);
      if (!PR_A.ok) return;
      ctx.beginPath();
      ctx.moveTo(PR_A.x, PR_A.y);
      let closed = false;
      for (let k = 0; k <= 14; k++) {
        const a = leaderAng - CONE_HALF_ANGLE + (k / 14) * CONE_HALF_ANGLE * 2;
        project(Lx + Math.cos(a) * r, Ly + Math.sin(a) * r, LZ, PR_B);
        if (!PR_B.ok) { closed = false; continue; }
        ctx.lineTo(PR_B.x, PR_B.y);
        closed = true;
      }
      if (!closed) return;
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    };
    fan(CONE_R, "rgba(120, 190, 255, 0.045)");
    fan(CONE_R * 0.55, "rgba(120, 190, 255, 0.05)");
    fan(CONE_R, null, "rgba(120, 190, 255, 0.18)");
  }
  if (showFormation) {                         // V 形两条翼的引导线(投影端点)
    const hx = Math.cos(leaderAng), hy = Math.sin(leaderAng);
    const qx = -hy, qy = hx;
    const rank = (M >> 1);
    const back = rank * SLOT_SPACING, side = rank * SLOT_SPACING * 0.36;
    ctx.save();
    ctx.setLineDash(DASH_FORM);
    ctx.strokeStyle = "rgba(255, 200, 110, 0.13)";
    ctx.lineWidth = 1;
    for (const arm of [1, -1]) {
      project(Lx, Ly, Z2[leaderIdx], PR_A);
      project(Lx - hx * back + qx * side * arm, Ly - hy * back + qy * side * arm, Z2[leaderIdx], PR_B);
      if (PR_A.ok && PR_B.ok) {
        ctx.beginPath();
        ctx.moveTo(PR_A.x, PR_A.y);
        ctx.lineTo(PR_B.x, PR_B.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  project(Lx, Ly, Z2[leaderIdx], PR_A);
  if (PR_A.ok) {
    ctx.fillStyle = "rgb(255, 200, 110)";
    ctx.font = "bold 12px 'Microsoft YaHei', sans-serif";
    ctx.fillText("雁 GEESE ×" + galiveCount, PR_A.x + 12, PR_A.y - 10);
  }

  // ---- 死亡涟漪(投影到群体高度层) + 尸体下坠(3D 点, 落地渐隐) ----
  for (let k = 0; k < DEATH_CAP; k++) {
    if (deathT[k] <= 0) continue;
    const t = ++deathT[k], alpha = 1 - t / 22;
    if (alpha <= 0) { deathT[k] = 0; continue; }
    project(deathX[k], deathY[k], Z_INIT, PR_A);
    if (!PR_A.ok) continue;
    ctx.strokeStyle = `rgba(255, 110, 100, ${alpha * 0.9 * PR_A.f})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(PR_A.x, PR_A.y, (2 + t * 0.4) * PR_A.s, 0, TAU);
    ctx.stroke();
  }
  if (GRAV_ON) {
    ctx.fillStyle = "rgb(180, 195, 215)";
    for (let k = 0; k < CORPSE_CAP; k++) {
      if (cT[k] <= 0) continue;
      project(cX[k], cY[k], cZ[k], PR_A);
      if (!PR_A.ok) continue;
      const grounded = cZ[k] <= FLOOR_Z;
      const fade = grounded ? Math.max(0, 1 - (cT[k] - 1) / 60) : 1;
      ctx.globalAlpha = 0.55 * PR_A.f * fade;
      const r = Math.max(1, 1.6 * PR_A.s);
      ctx.fillRect(PR_A.x - r / 2, PR_A.y - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
  }

  // ---- 隼群配合轴线(投影, 极淡虚线) ----
  if (falcons.length >= 2) {
    const f1 = falcons[0], f2 = falcons[1];
    project(f1.x, f1.y, f1.z, PR_A);
    project(f1.x + minImageX(f2.x - f1.x), f1.y + minImageY(f2.y - f1.y), f2.z, PR_B);
    if (PR_A.ok && PR_B.ok) {
      ctx.save();
      ctx.setLineDash(DASH_AXIS);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PR_A.x, PR_A.y);
      ctx.lineTo(PR_B.x, PR_B.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- 隼 ----
  for (let fi = 0; fi < falcons.length; fi++) {
    const f = falcons[fi];
    const dash = f.dashT > 0;
    const isActive = fi === activeId;
    const hp = drawHunter(f, dash, { visionR: VIEW_FALCON, trailA: 0.7, glowDash: 20, glow: 14,
                          glowA: isActive ? 0.35 : 0.18, size: BODY_F });
    if (!hp) continue;
    const bw = 28 * hp.s, bh = 3 * Math.max(0.6, hp.s), bx = hp.x - bw / 2, by = hp.y - 20 * hp.s;
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = `rgb(${f.color})`;
    ctx.fillRect(bx, by, bw * f.energy / ENERGY_MAX, bh);
    ctx.fillStyle = `rgba(200, 200, 200, ${0.6 * hp.f})`;
    ctx.font = "10px 'Microsoft YaHei', sans-serif";
    ctx.fillText(isActive ? "追猎" : "设伏", bx + bw + 3, by + bh);
    ctx.fillStyle = `rgba(150, 200, 160, ${0.75 * hp.f})`;
    ctx.fillText("策略 " + f.policy.gen + "代", bx, by - 4);
    if (f.stun > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.9 * hp.f})`;
      ctx.fillText("眩晕 " + f.stun, bx - 1, by - 15);
    }
    ctx.fillStyle = `rgb(${f.color})`;
    ctx.font = "bold 12px 'Microsoft YaHei', sans-serif";
    ctx.fillText(f.label, hp.x + 11 * hp.s, hp.y - 8 * hp.s);
  }

  // ---- 鹰(支持多只; 0 只时自然跳过) ----
  for (let ei = 0; ei < eagles.length; ei++) {
    const E = eagles[ei];
    const dash = E.dashT > 0;
    const hp = drawHunter(E, dash, { visionR: VIEW_EAGLE, trailA: 0.55, glowDash: 19, glow: 16,
                          glowA: 0.4, size: BODY_E });
    if (!hp) continue;
    ctx.fillStyle = "rgb(255, 190, 60)";
    ctx.font = "bold 12px 'Microsoft YaHei', sans-serif";
    ctx.fillText(E.label + "  ε=" + E.eps.toFixed(2), hp.x + 12 * hp.s, hp.y - 10 * hp.s);
    if (E.stun > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.9 * hp.f})`;
      ctx.font = "10px 'Microsoft YaHei', sans-serif";
      ctx.fillText("眩晕 " + E.stun, hp.x - 16 * hp.s, hp.y - 22 * hp.s);
    }
  }

  drawMinimap();
}

/* 3D 软件兜底渲染(GL3D 不可用且处于 3D 视角时): CPU 投影 + 雾, 慢但正确。
 * 椋鸟/雁各一批 path; 大小/透明度随深度。仅作兜底, 正常路径走 GL3D 实例化。 */
function renderSoft3D() {
  ctx.fillStyle = "#0a0c12";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgb(200, 215, 235)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < N; i++) {
    if (!alive[i]) continue;
    project(P[2*i], P[2*i+1], Z[i], PR_A);
    if (!PR_A.ok) continue;
    project(P[2*i] + V[2*i] * 4, P[2*i+1] + V[2*i+1] * 4, Z[i] + VZ[i] * 4, PR_B);
    ctx.globalAlpha = PR_A.f;
    ctx.beginPath();
    if (PR_B.ok) drawArrow(PR_A.x, PR_A.y, PR_B.x - PR_A.x, PR_B.y - PR_A.y,
                           BODY_S[0] * PR_A.s, BODY_S[1] * PR_A.s, BODY_S[2] * PR_A.s);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgb(255, 200, 110)";
  for (let i = 0; i < M; i++) {
    if (!galive[i]) continue;
    project(P2[2*i], P2[2*i+1], Z2[i], PR_A);
    if (!PR_A.ok) continue;
    project(P2[2*i] + V2[2*i] * 4, P2[2*i+1] + V2[2*i+1] * 4, Z2[i] + VZ2[i] * 4, PR_B);
    ctx.globalAlpha = PR_A.f;
    ctx.beginPath();
    if (PR_B.ok) drawArrow(PR_A.x, PR_A.y, PR_B.x - PR_A.x, PR_B.y - PR_A.y,
                           BODY_G[0] * PR_A.s, BODY_G[1] * PR_A.s, BODY_G[2] * PR_A.s);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ---- 渲染分发(第 8 轮: 3D 视角优先, 俯视/2D 全路径保留作 A/B 与兜底) ---- */
function render() {
  const t0 = performance.now();
  updateCamera();                              // 相机跟随群体质心+均高(每帧, 暂停时也生效)
  if (VIEW3D) {
    if (gl3dReady) {
      try {
        window.GLBackend.draw3D(glScene, vpM); // 底层: 透视 + 深度 + 雾, 两批实例化
        glUsed = true;
      } catch (e) {
        gl3dReady = false;
        console.warn("WebGL3D 异常, 回退软渲染:", e && e.message);
      }
    }
    if (!gl3dReady) renderSoft3D();            // CPU 投影兜底(慢, 但行为正确)
    ovClear = gl3dReady;                       // GL 底不透明 -> 叠加层要清; 软渲染画在 ctx 上 -> 不清
    renderOverlay();
  } else {
    if (glReady) {
      try {
        window.GLBackend.draw(glScene);        // 旧 2D 实例化(俯视专用)
        glUsed = true;
      } catch (e) {
        glReady = false;
        perf.gl = false;
        console.warn("WebGL 后端异常, 回退 Canvas2D:", e && e.message);
      }
    }
    ovClear = glReady;
    if (glReady) renderOverlay();
    else render2D();                           // 原 Canvas2D 全路径
  }
  perf.renderMs = perf.renderMs * 0.9 + (performance.now() - t0) * 0.1;
  perf.gl = glReady;
}

// 小地图: 开阔世界专用 —— 视口只是一部分, 必须有个全局视图看鸟群跑哪去了
function drawMinimap() {
  if (TORUS) return;
  const mw = 210, mh = mw * (H + 2 * PAD) / (W + 2 * PAD);
  const ox = 14, oy = H - 14 - mh;
  const sx = mw / (W + 2 * PAD), sy = mh / (H + 2 * PAD);
  const mx = x => ox + (x + PAD) * sx, my = y => oy + (y + PAD) * sy;

  ctx.save();
  ctx.fillStyle = "rgba(10, 12, 18, 0.6)";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.rect(ox, oy, mw, mh); ctx.fill(); ctx.stroke();

  ctx.setLineDash(DASH_MINI);                     // 视口范围
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath(); ctx.rect(mx(0), my(0), W * sx, H * sy); ctx.stroke();
  ctx.setLineDash(EMPTY_DASH);

  ctx.fillStyle = "rgba(200,215,235,0.5)";     // 椋鸟抽样, 1px 点
  for (let i = 0; i < N; i += 6) {
    if (!alive[i]) continue;
    ctx.fillRect(mx(P[2*i]) - 0.5, my(P[2*i+1]) - 0.5, 1, 1);
  }
  ctx.fillStyle = "rgb(255,200,110)";          // 雁
  for (let i = 0; i < M; i++) {
    if (!galive[i]) continue;
    ctx.fillRect(mx(P2[2*i]) - 1, my(P2[2*i+1]) - 1, 2, 2);
  }
  for (const f of threats) {                   // 猛禽
    ctx.fillStyle = `rgb(${f.color})`;
    ctx.fillRect(mx(f.x) - 1.5, my(f.y) - 1.5, 3, 3);
  }
  // P2: 领队位置 + 威慑锥方向(小地图上最容易看出"雁群在躲谁")
  if (galiveCount > 0) {
    ctx.fillStyle = "rgba(120,190,255,0.9)";
    ctx.fillRect(mx(Lx) - 2, my(Ly) - 2, 4, 4);
    ctx.strokeStyle = "rgba(120,190,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(mx(Lx), my(Ly));
    ctx.lineTo(mx(Lx + Math.cos(leaderAng) * 60), my(Ly + Math.sin(leaderAng) * 60));
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(150,155,168,0.75)";
  ctx.font = "10px 'Microsoft YaHei', sans-serif";
  ctx.fillText(`开阔世界 ${W + 2 * PAD}×${H + 2 * PAD}（虚线 = 视口）`, ox + 2, oy - 4);
  ctx.restore();
}

// 鹰脑 Q 表热力图(小 canvas, 6Hz 刷新足够)
function renderQ() {
  const w = qcv.width, h = qcv.height;
  qctx.clearRect(0, 0, w, h);
  if (!eagles.length) {                        // 第 8 轮: 鹰减到 0 时 Q 表留空
    qctx.fillStyle = "rgba(150,155,170,0.5)";
    qctx.font = "10px 'Microsoft YaHei', sans-serif";
    qctx.fillText("无鹰(增援已清空)", 6, h / 2);
    return;
  }
  qctx.fillStyle = "rgba(255,255,255,0.03)";
  qctx.fillRect(0, 0, w, h);

  const labelW = 30, headH = 15;
  const cw = (w - labelW) / N_ACTIONS, ch = (h - headH) / N_STATES;
  const rows = ["椋近", "椋中", "椋远", "雁近", "雁中", "雁远", "全空"];
  const cols = ["追椋", "追雁", "伏击", "攻隼"];

  let maxQ = 1e-6;
  for (let s = 0; s < N_STATES; s++)
    for (let a = 0; a < N_ACTIONS; a++)
      maxQ = Math.max(maxQ, eagle.Q[s * N_ACTIONS + a]);

  qctx.font = "9px 'Microsoft YaHei', sans-serif";
  qctx.textBaseline = "middle";
  for (let a = 0; a < N_ACTIONS; a++) {
    qctx.fillStyle = "rgba(180,185,200,0.8)";
    qctx.fillText(cols[a], labelW + a * cw + cw / 2 - 11, headH / 2);
  }
  for (let s = 0; s < N_STATES; s++) {
    const y = headH + s * ch;
    const cur = (s === eagle.curState);
    // 该状态下的贪心动作(顶部亮线), 一眼看出"学会了什么"。
    // 若第一名与第二名差距 <5%, 亮线画成半透明 —— 表示"还没学出偏好",
    // 免得用户以为热力图在闪就是坏了(雁近行常年就是这种势均力敌)。
    let ga = 0, gb = -1;
    for (let a = 1; a < N_ACTIONS; a++) {
      const v = eagle.Q[s * N_ACTIONS + a], cur2 = eagle.Q[s * N_ACTIONS + ga];
      if (v > cur2) { gb = ga; ga = a; } else if (a !== ga && (gb < 0 || v > eagle.Q[s * N_ACTIONS + gb])) gb = a;
    }
    const best = eagle.Q[s * N_ACTIONS + ga];
    const second = gb >= 0 ? eagle.Q[s * N_ACTIONS + gb] : -Infinity;
    const tie = !(best > second) || (best - second) < 0.05 * Math.max(maxQ, 1e-6);
    const hasValue = maxQ > 1e-6 && best > 1e-6;
    qctx.fillStyle = cur ? "rgba(255,220,140,0.95)" : "rgba(150,155,170,0.65)";
    qctx.fillText(rows[s], 2, y + ch / 2);
    for (let a = 0; a < N_ACTIONS; a++) {
      const x = labelW + a * cw;
      const v = Math.max(0, eagle.Q[s * N_ACTIONS + a]) / maxQ;   // 0..1 亮度
      qctx.fillStyle = `hsl(${210 - 165 * v}, ${35 + 40 * v}%, ${10 + 38 * v}%)`;
      qctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      if (s !== STATE_NONE && hasValue) {                    // 贪心动作: 顶部一条亮线
        if (a === ga) {
          qctx.fillStyle = tie ? "rgba(255,235,170,0.35)" : "rgba(255,235,170,0.9)";
          qctx.fillRect(x + 3, y + 2, cw - 6, 1.5);
        }
      }
      if (cur && a === eagle.curAction) {                    // 当前决策高亮
        qctx.strokeStyle = "rgba(255,255,255,0.95)";
        qctx.lineWidth = 1.5;
        qctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
      }
    }
  }
}

/* --------------------- 8. 计分板 / 控件 / 主循环 --------------------- */

const el = id => document.getElementById(id);

/* ---- 状态栏可收起: 按钮或快捷键 H 切换, 尽量记住上次状态 ---- */
const PANEL_KEY = "boids.panelCollapsed";
let panelHidden = false;
function setPanelHidden(hide, persist) {
  panelHidden = !!hide;
  const p = el("panel");
  if (p && p.classList) p.classList.toggle("collapsed", panelHidden);
  const b = el("btnHide");
  if (b) b.textContent = panelHidden ? "展开 ◂" : "收起 ▸";
  if (persist) {
    try { localStorage.setItem(PANEL_KEY, panelHidden ? "1" : "0"); } catch (e) { /* file:// 下可能不可用 */ }
  }
}
el("btnHide").onclick = () => setPanelHidden(!panelHidden, true);
try { if (localStorage.getItem(PANEL_KEY) === "1") setPanelHidden(true, false); } catch (e) { /* 忽略 */ }

/* ---- 第 8 轮之三: 动态计分板 ----
 * 原面板写死 3 行(隼①②/鹰), 加入鹰隼后多出来的个体根本不显示 -> 现在按 raptors 动态建行。
 * 兼容: 前两只隼与第一只鹰仍分别挂 s0/k0、s1/k1、s2/k2 三个老 id(既有测试/脚本依赖它们)。 */
let scoreRoster = -1, scoreRowEls = [];
const ACT_NAME = ["追椋鸟", "追雁", "游荡伏击", "攻击竞争者"];
function buildScoreRows() {
  const body = el("scoreBody");
  if (!body) return;
  const list = [];
  falcons.forEach((f, i) => list.push({ r: f, name: "隼" + (CN_NUM[i] || "#" + (i + 1)),
    idS: i === 0 ? "s0" : (i === 1 ? "s1" : null), idK: i === 0 ? "k0" : (i === 1 ? "k1" : null) }));
  eagles.forEach((E, i) => list.push({ r: E, name: "鹰" + (CN_NUM[i] || "#" + (i + 1)),
    idS: i === 0 ? "s2" : null, idK: i === 0 ? "k2" : null }));
  // 清空: snapshot + removeChild —— 浏览器里 body.children 是 HTMLCollection(没有 shift/splice),
  // 无头测试桩则是普通数组; 这种差异只有真机跑才会暴露(第 8 轮之三实测踩到)。
  const kids = [];
  for (let i = 0; i < body.children.length; i++) kids.push(body.children[i]);
  for (const c of kids) body.removeChild(c);
  scoreRowEls = list.map(item => {
    const tr = document.createElement("tr");
    const c0 = document.createElement("td");
    c0.style.color = "rgb(" + item.r.color + ")";
    c0.textContent = item.name;
    const c1 = document.createElement("td"); c1.className = "num"; c1.textContent = "0";
    const c2 = document.createElement("td"); c2.className = "num"; c2.textContent = "0";
    const c3 = document.createElement("td"); c3.className = "st"; c3.textContent = "-";
    if (item.idS) c1.id = item.idS;                     // 老契约: 前三行仍叫 s0/s1/s2, k0/k1/k2
    if (item.idK) c2.id = item.idK;
    [c0, c1, c2, c3].forEach(c => tr.appendChild(c));
    body.appendChild(tr);
    return { r: item.r, s: c1, k: c2, st: c3 };
  });
  scoreRoster = falcons.length * 100 + eagles.length;
}
function raptorStateText(r) {
  // 尽量紧凑 + 数字定宽(用 nbsp 补齐): 列宽固定, 文本长度也固定, 状态列就不会一跳一跳
  const NB = "\u00A0";
  const pad = (s, n) => String(s).padStart(n, NB);
  const b = [];
  if (r.stun > 0) b.push("眩晕");
  else if (r.dashT > 0) b.push("冲刺");
  else if (r.circleT > 0) b.push("盘旋");
  else b.push("游猎");
  if (r.kind === "eagle") b.push(["追鸟", "追雁", "伏击", "互攻"][r.curAction | 0] || "-");
  if (r.energy !== undefined) b.push("能" + pad(Math.round(r.energy), 3) + "%");
  if (r.mob > 0) b.push("围" + pad((r.mob / 60).toFixed(0), 2) + "s");   // mob 是累加帧数, 换算成"被围攻多少秒"
  if (r.lockIdx >= 0) b.push("#" + pad(r.lockIdx, 3));
  return b.join("·");
}
function refreshScore() {
  const roster = falcons.length * 100 + eagles.length;
  if (roster !== scoreRoster) buildScoreRows();
  let ts = 0, tk = 0, dash = 0;
  for (const row of scoreRowEls) {
    const r = row.r;
    row.s.textContent = r.score;
    row.k.textContent = r.kills;
    const txt = raptorStateText(r);
    if (row.st.textContent !== txt) row.st.textContent = txt;
    row.st.style.color = r.dashT > 0 ? "#ffb37a" : (r.stun > 0 ? "#ff8fa0" : "#7d8bb0");
    ts += r.score; tk += r.kills;
    if (r.dashT > 0) dash++;
  }
  el("scoreTotal").textContent = ts;
  el("killTotal").textContent = tk;
  const secs = stats.steps / 60;
  el("rateTotal").textContent = (tk / Math.max(secs, 1) * 60).toFixed(1) + "/分" + (dash ? " · 冲刺中 " + dash : "");
  el("scoreSummary").textContent = "编制 隼 ×" + falcons.length + " · 鹰 ×" + eagles.length;
}
function refreshPanel() {
  const E0 = eagles[0] || null;                // 第 8 轮: 鹰可减到 0, 食谱/ε 等都要守卫
  refreshScore();
  el("aliveS").textContent = aliveCount;
  el("aliveG").textContent = galiveCount;
  el("aliveSPct").textContent = (aliveCount / Math.max(1, N) * 100).toFixed(0) + "%";
  el("aliveGPct").textContent = (galiveCount / Math.max(1, M) * 100).toFixed(0) + "%";
  const zr = SIMzRange();
  el("zStar").textContent = zr.starling ? zr.starling.mean.toFixed(0) : "—";
  el("zGoose").textContent = zr.goose ? zr.goose.mean.toFixed(0) : "—";
  el("zSpan").textContent = zr.starling ? (zr.starling.hi - zr.starling.lo).toFixed(0) : "—";
  el("corpseN").textContent = corpseCount();
  refreshRaidLine();                           // 第 7 轮: 增援编制与战果
  {                                            // 第 8 轮: 猛禽决策日志(最后 3 条)
    const tail = decTail(3);
    el("decLine").innerHTML = tail.length
      ? tail.map(d => "f" + d.frame + " <b>" + d.who + "</b> " + d.msg).join("<br>")
      : "（暂无决策记录）";
  }

  const ds = E0 ? E0.dietStarling : 0, dg = E0 ? E0.dietGoose : 0, tot = ds + dg;
  el("dietS").style.width = (tot ? ds / tot * 100 : 50) + "%";
  el("dietG").style.width = (tot ? dg / tot * 100 : 50) + "%";
  el("dietText").textContent = tot
    ? `椋鸟 ${ds} 只 · 雁 ${dg} 只 · 当前偏向 ${dg >= ds ? "追雁（大分）" : "追椋鸟（好抓）"}`
    : "还没开张";

  const secs = stats.steps / 60;
  // 视图与性能: 拆成两块 —— 上半屏"看得见的世界状态", 下半屏"机制计数", 不再是一整坨文字
  el("viewLine").innerHTML =
    `<b>${VIEW3D ? "三维" : "俯视"}</b> · 重力 <b>${GRAV_ON ? "开" : "关"}</b>` +
    ` · 相机 ${cam.dist.toFixed(0)}px${cam.auto ? "(自动环绕)" : ""}` +
    ` · 拖尾 ${TRAIL3_ON ? "开" : "关"}` +
    ` · 世界 ${W}×${H}(视口 ${VIEW_W}×${VIEW_H}, 厌恶 ${BOUND_R}px)` +
    ` · 渲染 ${VIEW3D ? (gl3dReady ? "WebGL·3D" : "软渲染·3D") : (glReady ? "WebGL" : "Canvas2D")}${want2D ? "(强制)" : ""}` +
    ` · 计算 ${gpuCompute ? "WebGPU" : "CPU"}${computeMode === "cpu" ? "(强制)" : ""}`;
  el("fpsLine").innerHTML =
    `FPS <b>${fpsEma.toFixed(0)}</b> · 模拟 ${secs.toFixed(0)}s · step ${perf.stepMs.toFixed(1)}ms · render ${perf.renderMs.toFixed(2)}ms` +
    (gpuCompute ? `（上行 ${perf.uploadMs.toFixed(1)} + GPU ${perf.gpuMs.toFixed(1)} + 回读 ${perf.readbackMs.toFixed(1)}）` : "") +
    ` · 总捕获 <b>${stats.kills}</b>（${(stats.kills / Math.max(secs, 1) * 60).toFixed(1)}/分）· 补充 ${stats.wave} 波<br>` +
    `空冲刺 ${stats.missFalcon}+${stats.missEagle} · 突围打断 ${stats.mobInterrupts} · 锁定冲刺 ${stats.lockedDashes}` +
    ` · 无目标放弃 ${stats.noLockAborts} · 互攻 ${stats.clashes}（抢分 ${stats.steals}） · ε=${E0 ? E0.eps.toFixed(2) : "—"}<br>` +
    `雁: 领队 #${leaderIdx} · 混乱 ${disarray} · 幼雁 ${juvenileAlive()}/${juvCount}` +
    `${gooseDebuff > 0 ? " (沮丧 " + gooseDebuff + ")" : ""} · 借网预警 ${stats.gooseAlerts}（误报 ${stats.gooseFalseAlerts}）· 斩首 ${stats.gooseDisarray}<br>` +
    `隼策: 代数 ${falcons[0] ? falcons[0].policy.gen : "—"}/${falcons[1] ? falcons[1].policy.gen : "—"}` +
    ` · 锥内失血 ${stats.coneFalconFrames}+${stats.coneEagleDrain} · ES 采纳 ${stats.esAdopt}/${stats.esPeriods} 期 · 决策日志 ${decN} 条`;
  el("modeTag").textContent = TORUS ? "环面" : "开阔世界";
  renderQ();
}

/* z 范围与尸体数(面板用; 与 SIM.zRange/corpses 同口径) */
function SIMzRange() {
  let lo = 1e9, hi = -1e9, sum = 0, cnt = 0;
  for (let i = 0; i < N; i++) if (alive[i]) { const z = Z[i]; if (z < lo) lo = z; if (z > hi) hi = z; sum += z; cnt++; }
  let glo = 1e9, ghi = -1e9, gsum = 0, gcnt = 0;
  for (let i = 0; i < M; i++) if (galive[i]) { const z = Z2[i]; if (z < glo) glo = z; if (z > ghi) ghi = z; gsum += z; gcnt++; }
  return { starling: cnt ? { lo, hi, mean: sum / cnt } : null, goose: gcnt ? { lo: glo, hi: ghi, mean: gsum / gcnt } : null };
}
function corpseCount() {
  let c = 0;
  for (let k = 0; k < CORPSE_CAP; k++) if (cT[k] > 0) c++;
  return c;
}

// P2: 还活着几只幼雁
function juvenileAlive() {
  let c = 0;
  for (let i = 0; i < M; i++) if (galive[i] && isJuvenile(i)) c++;
  return c;
}

// P3: 把两只隼的策略打回出厂设置(评估期/代数/适应度一起归零)
function resetFalconPolicies() {
  for (const f of falcons) {
    f.policy = makePolicy();
    f.policy.score0 = f.score;
  }
  stats.esAdopt = 0; stats.esPeriods = 0;
}

el("btnFlocks").onclick = () => resetFlocks();          // 重置鸟群(计分保留)
el("btnPreds").onclick  = () => resetPredators();       // 重置猛禽 = 回到默认编制(2 隼 + 1 鹰)
el("btnAddFalcon").onclick = () => spawnRaptor("falcon");   // 第 7/8 轮: 立即增援一只隼
el("btnAddEagle").onclick  = () => spawnRaptor("eagle");    // 第 7/8 轮: 立即增援一只鹰(独立 Q 表)
el("btnFMinus").onclick = () => removeRaptor("falcon");     // 第 8 轮: 一键增减编制
el("btnFPlus").onclick  = () => spawnRaptor("falcon");
el("btnEMinus").onclick = () => removeRaptor("eagle");
el("btnEPlus").onclick  = () => spawnRaptor("eagle");
el("btnView").onclick = () => toggleView();
el("btnCamReset").onclick = () => { cam.yaw = 0.7; cam.pitch = 0.52; cam.dist = 950; };
el("cbGravity").onchange = e => { GRAV_ON = e.target.checked; };
el("cbAuto").onchange = e => { cam.auto = e.target.checked; };
/* 增援行: 显示当前猛禽编制与增援者的合计战果 */
function refreshRaidLine() {
  const nf = falcons.length, ne = eagles.length;
  let extraK = 0, extraS = 0;
  for (let i = 2; i < falcons.length; i++) { extraK += falcons[i].kills; extraS += falcons[i].score; }
  for (let i = 1; i < eagles.length; i++)  { extraK += eagles[i].kills;  extraS += eagles[i].score; }
  const base = `猛禽编制: 隼 ×${nf} · 鹰 ×${ne}`;
  el("raidLine").textContent = (nf > 2 || ne > 1)
    ? base + `（增援 ${nf - 2 + ne - 1} 只: 捕获 ${extraK} · 得分 ${extraS}）`
    : base;
}
el("btnScore").onclick  = () => {                       // 清空计分
  for (const f of falcons) { f.score = 0; f.kills = 0; f.dashEats = 0; }
  for (const E of eagles) { E.score = 0; E.kills = 0; E.dashEats = 0; E.dietStarling = 0; E.dietGoose = 0; }
  stats.kills = 0; stats.steps = 0; stats.wave = 0;
  stats.missFalcon = 0; stats.missEagle = 0; stats.mobInterrupts = 0;
  stats.lockedDashes = 0; stats.clashes = 0; stats.steals = 0;
};
el("btnBrain").onclick = () => {                        // 重置鹰脑(所有鹰的 Q 表一起清)
  for (const E of eagles) {
    E.Q.fill(0);
    E.eps = EPS0;
    E.lastState = 0; E.lastAction = 0; E.pending = 0;
    E.dietStarling = 0; E.dietGoose = 0;
    E.curState = STATE_NONE; E.curAction = 2;
    E.hold = 0; E.holdState = STATE_NONE; E.holdAction = 2;
  }
};
el("btnPolicy").onclick = () => resetFalconPolicies();  // P3: 重置隼策(回默认参数)
el("btnPause").onclick = () => {
  paused = !paused;
  el("btnPause").textContent = paused ? "继续（空格）" : "暂停（空格）";
  el("btnPause").classList.toggle("on", paused);
};
el("cbVision").onchange = e => showVision = e.target.checked;
el("cbForm").onchange   = e => showFormation = e.target.checked;
el("cbRefill").onchange = e => refillOn = e.target.checked;
el("cbTorus").onchange  = e => setGeometry(e.target.checked);
el("cbTrail").onchange  = e => { TRAIL3_ON = e.target.checked; };   // 第 8 轮之三: 三维拖尾开关
el("cbEat3D").onchange  = e => { EAT_3D = e.target.checked; };      // 第 8 轮修正③: 吃判是否升 3D 球
el("rgN").oninput    = e => el("vN").textContent = e.target.value;
el("rgN").onchange   = e => setN(+e.target.value);
el("rgK").oninput    = e => { topoK = clamp(+e.target.value, 1, TOPO_MAX); el("vK").textContent = topoK; };
el("rgSpeed").oninput = e => { speedMul = +e.target.value; el("vSpeed").textContent = speedMul + "×"; };

document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (k === " ") { e.preventDefault(); el("btnPause").onclick(); }
  else if (k === "h") setPanelHidden(!panelHidden, true);   // 收起/展开状态栏
  else if (k === "r") resetFlocks();
  else if (k === "c") el("btnScore").onclick();
  else if (k === "f") { if (e.shiftKey) el("btnFMinus").onclick(); else el("btnAddFalcon").onclick(); }   // 第 8 轮: ⇧F 减员
  else if (k === "e") { if (e.shiftKey) el("btnEMinus").onclick(); else el("btnAddEagle").onclick(); }     // 第 8 轮: ⇧E 减员
  else if (k === "t") toggleView();                     // 第 8 轮: 3D/俯视切换
  else if (k === "b") el("btnBrain").onclick();
  else if (k === "v") { el("cbVision").checked = !el("cbVision").checked; showVision = el("cbVision").checked; }
});

/* ---- GPU 计算路径(第 1 步原型): 6.1+6.2 在 GPU, 其余仍走 stepRest ---- */
async function stepGPU() {
  frame++; stats.steps++;
  const tor = TORUS;
  const r = await window.ComputeBackend.frame(computeScene);   // GPU: 网格 + 邻居 + 求力 -> ACC
  perf.uploadMs = perf.uploadMs * 0.9 + r.uploadMs * 0.1;
  perf.gpuMs = perf.gpuMs * 0.9 + r.gpuMs * 0.1;
  perf.readbackMs = perf.readbackMs * 0.9 + r.readbackMs * 0.1;
  cpuCentroidOnly(tor);                                       // 6.3/6.4 需要质心(与 CPU 版同序)
  stepRest(tor);                                              // 6.3 ~ 6.10
  return r;
}

let stepAcc = 0;
function loop() {
  const now = performance.now();
  fpsEma = fpsEma * 0.95 + (1000 / Math.max(now - lastT, 1)) * 0.05;
  lastT = now;
  tryInitGL();                                 // 首帧再初始化 GL(那时第二个 script 已解析)

  let stepMs = 0;
  if (!paused) {
    const t0 = performance.now();
    stepAcc += speedMul;                       // 时间倍速: 一帧跑多步
    const nSteps = Math.min(Math.floor(stepAcc), 4);
    stepAcc -= nSteps;
    for (let s = 0; s < nSteps; s++) step();
    stepMs = (performance.now() - t0) / Math.max(nSteps, 1);   // 单步耗时(除以步数)
  }
  perf.stepMs = perf.stepMs * 0.9 + stepMs * 0.1;
  render();

  if (now - lastPanelT > 160) {                // 计分板 ~6Hz 刷新足够
    lastPanelT = now;
    refreshPanel();
    if (diagMode && (++diagTicks % 6 === 0)) {  // ~1 秒一行, 给无头/真机取证用
      console.info("DIAG " + JSON.stringify({
        backend: gpuCompute ? "webgpu" : "cpu", n: N, frame,
        fps: Math.round(fpsEma), stepMs: +perf.stepMs.toFixed(2), renderMs: +perf.renderMs.toFixed(2),
        uploadMs: +perf.uploadMs.toFixed(2), gpuMs: +perf.gpuMs.toFixed(2), readbackMs: +perf.readbackMs.toFixed(2),
        alive: aliveCount, galive: galiveCount, kills: stats.kills, deaths: stats.steps,
      }));
    }
  }
  requestAnimationFrame(loop);
}

/* GPU 帧循环: 每帧 await 计算后端(WebGPU 提交是异步的, 主线程不能阻塞等待,
 * 所以 GPU 模式下整条循环变成 async —— 每帧仍然只推进一次物理, 语义与 CPU 路径一致) */
let gpuFrameBusy = false;
async function loopGPU() {
  if (gpuFrameBusy) { requestAnimationFrame(loopGPU); return; }   // 防重入(一帧一个 await)
  gpuFrameBusy = true;
  const now = performance.now();
  fpsEma = fpsEma * 0.95 + (1000 / Math.max(now - lastT, 1)) * 0.05;
  lastT = now;
  tryInitGL();

  let stepMs = 0;
  if (!paused && window.ComputeBackend && window.ComputeBackend.ready()) {
    const t0 = performance.now();
    stepAcc += speedMul;
    const nSteps = Math.min(Math.floor(stepAcc), 4);
    stepAcc -= nSteps;
    for (let s = 0; s < nSteps; s++) {
      try { await stepGPU(); }
      catch (e) {                                  // 任何一次失败都当场降级, 不让画面停住
        console.warn("WebGPU 计算失败, 退回 CPU 路径:", e && e.message);
        gpuCompute = false; perf.gl = perf.gl; computeMode = "cpu";
        step(); break;
      }
    }
    stepMs = (performance.now() - t0) / Math.max(nSteps, 1);
  } else if (!paused) {
    const t0 = performance.now();
    step();
    stepMs = performance.now() - t0;
  }
  perf.stepMs = perf.stepMs * 0.9 + stepMs * 0.1;
  render();
  if (now - lastPanelT > 160) {
    lastPanelT = now;
    refreshPanel();
    if (diagMode && (++diagTicks % 6 === 0)) {
      console.info("DIAG " + JSON.stringify({
        backend: gpuCompute ? "webgpu" : "cpu", n: N, frame,
        fps: Math.round(fpsEma), stepMs: +perf.stepMs.toFixed(2), renderMs: +perf.renderMs.toFixed(2),
        uploadMs: +perf.uploadMs.toFixed(2), gpuMs: +perf.gpuMs.toFixed(2), readbackMs: +perf.readbackMs.toFixed(2),
        alive: aliveCount, galive: galiveCount, kills: stats.kills, deaths: stats.steps,
      }));
    }
  }
  gpuFrameBusy = false;
  requestAnimationFrame(gpuCompute ? loopGPU : loop);
}

/* ---- 启动 ---- */
recomputeGridSize();
resetFlocks();
resetPredators();

/* 启动闸门: compute=cpu 直接起 CPU 循环; 否则先试 WebGPU(含自检), 失败静默回退。
 * 【必须排到首帧再跑】: 本函数在主区块求值时会同步执行, 而 WebGPU 后端在第三个
 * <script> 区块里, 那时还没被解析 —— 直接查 window.ComputeBackend 会永远拿到
 * undefined, auto 模式就永远退回 CPU(真机浏览器实测踩到的坑)。 */
requestAnimationFrame(async function boot() {
  if (computeMode === "cpu") { requestAnimationFrame(loop); return; }
  const B = window.ComputeBackend;
  if (!B) {
    console.warn("WebGPU 计算后端脚本缺失, 走 CPU 路径");
    requestAnimationFrame(loop); return;
  }
  // 初始化带超时: requestAdapter 万一卡住也不能让画面不启动(默认 3 秒, ?initTimeout=ms 可调)
  const ok = await Promise.race([
    B.init(computeScene),
    new Promise(res => setTimeout(() => res("timeout"), initTimeoutMs)),
  ]);
  if (ok === "timeout") {
    console.warn("WebGPU 初始化超时(" + initTimeoutMs + "ms), 先按 CPU 路径起步");
    requestAnimationFrame(loop); return;
  }
  computeInitInfo = B.info();  if (!ok) {
    if (computeMode === "gpu") console.warn("compute=gpu 但 WebGPU 不可用:", computeInitInfo.reason, "-> 回退 CPU");
    else console.info("WebGPU 不可用(" + computeInitInfo.reason + "), 走 CPU 路径");
    requestAnimationFrame(loop); return;
  }
  // 自检: 同一状态比 CPU/GPU 的 ACC, 超差就退回 CPU
  computeSelfCheck = await B.selfCheck(computeScene, computeScene.cpuForces);
  if (!computeSelfCheck.passed) {
    console.warn("WebGPU 自检未通过(maxAbs=" + computeSelfCheck.maxAbs.toExponential(2) +
                 ", 超差 " + computeSelfCheck.bad + " 项), 退回 CPU 路径");
    B.dispose();
    requestAnimationFrame(loop); return;
  }
  gpuCompute = true;
  console.info("WebGPU 计算启用: 6.1+6.2 上 GPU, 自检通过(maxAbs=" +
               computeSelfCheck.maxAbs.toExponential(2) + ")");
  requestAnimationFrame(loopGPU);
});

/* ---- 第二个 <script> 里的 WebGL 后端: 延迟到第一帧再初始化(那时它已解析完) ---- */
function tryInitGL() {
  if (glTried) return;
  glTried = true;
  if (want2D) { console.info("render=2d: 走 Canvas2D 全路径(用于 A/B 对比)"); return; }
  const B = window.GLBackend;
  if (!B) { console.warn("WebGL 后端脚本缺失, 回退 Canvas2D"); return; }
  const ok = B.init(glScene, document.getElementById("glcv"), forceGL);
  glReady = !!ok;
  gl3dReady = glReady && !!(B.has3D && B.has3D());   // 第 8 轮: 3D 管线随 2D 一起初始化
  perf.gl = glReady;
  if (!ok) console.warn("WebGL 不可用, 回退 Canvas2D 全路径");
  else {
    const gi = B.info();
    console.info("WebGL 实例化渲染已启用: " + (gi && gi.gl2 ? "WebGL2" : "WebGL1+ANGLE") +
                 " · " + (gi ? gi.renderer : "?") + " · 最多 " + (gi ? gi.maxN : "?") + " 只实例");
  }
}

/* ---- 调试/自动化钩子(浏览器控制台或 headless 校验脚本可用) ---- */
window.SIM = {
  step, render, initStarlings, initGeese, resetFlocks, resetPredators, setGeometry, setN, perceive, refreshPanel,
  setPanelHidden,
  get panelHidden() { return panelHidden; },
  get N() { return N; },
  get M() { return M; },
  get frame() { return frame; },
  get TORUS() { return TORUS; },
  get PAD() { return PAD; },
  get aliveCount() { return aliveCount; },
  get galiveCount() { return galiveCount; },
  get scores() { return [falcons[0] ? falcons[0].score : 0, falcons[1] ? falcons[1].score : 0, eagles[0] ? eagles[0].score : 0]; },
  get kills() { return [falcons[0] ? falcons[0].kills : 0, falcons[1] ? falcons[1].kills : 0, eagles[0] ? eagles[0].kills : 0]; },
  get diet() { return [eagles[0] ? eagles[0].dietStarling : 0, eagles[0] ? eagles[0].dietGoose : 0]; },
  get stats() { return stats; },
  get Q() { return eagles[0] ? eagles[0].Q : new Float32Array(N_STATES * N_ACTIONS); },
  get eps() { return eagles[0] ? eagles[0].eps : 0; },
  get maxSpeed() { return MAX_SPEED; },
  get maxSpeedG() { return MAX_SPEED_G; },
  get leaderSpeed() { return LEADER_SPEED; },
  get leader() { return { x: Lx, y: Ly, ang: leaderAng, z: Z2[leaderIdx] }; },
  get topoK() { return topoK; },
  setTopoK(v) { topoK = clamp(v | 0, 1, TOPO_MAX); },
  setRefill(v) { refillOn = !!v; },
  setSpeed(v) { speedMul = v; },
  setPaused(v) { paused = !!v; },
  get hunterMob() { return [falcons[0] ? falcons[0].mob : 0, falcons[1] ? falcons[1].mob : 0, eagles[0] ? eagles[0].mob : 0]; },
  get hunterStun() { return [falcons[0] ? falcons[0].stun : 0, falcons[1] ? falcons[1].stun : 0, eagles[0] ? eagles[0].stun : 0]; },
  get hunterLock() { return [falcons[0] ? falcons[0].lockIdx : -1, falcons[1] ? falcons[1].lockIdx : -1, eagles[0] ? eagles[0].lockIdx : -1]; },
  get eatR2() { return [EAT_R2_S, EAT_R2_G]; },
  get flockConsts() { return { PERCEPTION, COHESION_W, ALIGNMENT_W, MAX_FORCE, SEP_R2 }; },
  get mobConsts() { return { MOB_FRACTION, MOB_R, MOB_HARASS, MOB_MAX, MOB_DRAIN_PER, MOB_PENALTY_N }; },
  get mobberCount() { let c = 0; for (let i = 0; i < N; i++) if (alive[i] && isMobber[i]) c++; return c; },
  get actionCols() { return N_ACTIONS; },
  // 第 7 轮: 个体体积与间距(验收/回归用), 以及"加入鹰/隼"的编程接口
  get bodySizes() { return { starling: BODY_S.slice(), goose: BODY_G.slice(), falcon: BODY_F.slice(), eagle: BODY_E.slice() }; },
  get spacing() { return { PERCEPTION, SEP_R2, GSEP_R2, CELL }; },
  get raptorCount() { return { falcons: falcons.length, eagles: eagles.length, total: raptors.length }; },
  get raidKills() { return raptors.map(r => r.kills); },
  addFalcon: () => spawnRaptor("falcon"),
  addEagle: () => spawnRaptor("eagle"),
  get raidLine() { return el("raidLine").textContent; },
  get maxN() { return MAXN; },
  get gw() { return GW; },
  get gh() { return GH; },
  // 性能: 每帧指数滑动平均(渲染后端验收用)
  get perf() { return { stepMs: perf.stepMs, renderMs: perf.renderMs, gl: perf.gl,
                        uploadMs: perf.uploadMs, gpuMs: perf.gpuMs, readbackMs: perf.readbackMs }; },
  // WebGPU 计算后端(第 6 轮 Phase 1+2B 原型): 状态 / 自检结果 / 手动切换与手动一帧
  get compute() {
    return {
      requested: computeMode,
      backend: gpuCompute ? "webgpu" : "cpu",
      init: computeInitInfo,
      selfCheck: computeSelfCheck,
      ready: !!(window.ComputeBackend && window.ComputeBackend.ready()),
      info: window.ComputeBackend ? window.ComputeBackend.info() : null,
    };
  },
  accView: () => ACC,                            // 调试/验收: 直接看 CPU 侧 ACC(自检对拍用)
  // 第 8 轮: 猛禽决策日志 / 三维体积 / 高度范围(验收取证用)
  log: (n) => decTail(n === undefined ? 30 : n),
  logTail: (n) => decTail(n === undefined ? 30 : n),
  get logCount() { return decN; },
  clearLog: () => { decN = 0; decHead = 0; },
  setSize3D: (m) => { SIZE3D_MUL = clamp(+m || 0, 0.5, 12); return SIZE3D_MUL; },
  get size3D() { return SIZE3D_MUL; },
  // 第 8 轮之三: 三维鸟拖尾(开关/长度/宽度/透明度)
  // 【第 8 轮修正⑥】世界与边界验收钩子 + 3D 吃判开关(之前只加了常量, 忘了出口)
  worldInfo: () => ({ worldW: W, worldH: H, viewW: VIEW_W, viewH: VIEW_H, torus: TORUS,
                     boundR: BOUND_R, clampCount: boundClamp, peakPenetration: boundPeak,
                     minEdgeDist: boundMinEdge === Infinity ? null : boundMinEdge }),
  resetBoundStats: () => { boundClamp = 0; boundPeak = 0; boundMinEdge = Infinity; return 1; },
  setEat3D: (v) => { EAT_3D = !!v; const cb = el("cbEat3D"); if (cb) cb.checked = EAT_3D; return EAT_3D; },
  get eat3D() { return EAT_3D; },
  // 【第 8 轮之六】验收用只读/只写单点的钩子:
  //   verifier 要做"惊飞波接力传播"的严格测量, 需要能查"谁在第几帧被惊飞"与单点扰动;
  //   ghunter 冷却取证需要猛禽的冷却字段。
  startledList: () => { const out = []; for (let i = 0; i < N; i++) if (alive[i] && startled[i]) out.push(i); return out; },
  startledFlags: () => { const a = new Uint8Array(N); for (let i = 0; i < N; i++) a[i] = alive[i] ? startled[i] : 0; return a; },
  setStarlingVel: (i, vx, vy) => { if (i < 0 || i >= N || !alive[i]) return 0; V[2 * i] = vx; V[2 * i + 1] = vy; PV[2 * i] = vx; PV[2 * i + 1] = vy; return 1; },
  starlingNear: (x, y, r) => { const rr = r * r, out = []; for (let i = 0; i < N; i++) { if (!alive[i]) continue; const dx = P[2 * i] - x, dy = P[2 * i + 1] - y; if (dx * dx + dy * dy <= rr) out.push(i); } return out; },
  hunterDetail: (k) => { const h = raptors[k]; if (!h) return null; return { kind: h.kind, label: h.label, x: h.x, y: h.y, z: h.z,
    vx: h.vx, vy: h.vy, vz: h.vz || 0, energy: h.energy, dashT: h.dashT, cool: h.cool || 0, circleT: h.circleT,
    stun: h.stun, mob: h.mob, lockIdx: h.lockIdx, stoopT: h.stoopT || 0, score: h.score, kills: h.kills,
    gcool: h.gcool || 0, attacks: h.attacks || 0 }; },
  setTrail3: (v, len, w, alpha) => {
    if (v !== undefined) TRAIL3_ON = !!v;
    if (len !== undefined) TRAIL3_LEN = clamp(+len, 0, 40);
    if (w !== undefined) TRAIL3_W = clamp(+w, 0.05, 4);
    if (alpha !== undefined) TRAIL3_ALPHA = clamp(+alpha, 0, 1);
    return { on: TRAIL3_ON, len: TRAIL3_LEN, w: TRAIL3_W, alpha: TRAIL3_ALPHA };
  },
  get trail3() { return { on: TRAIL3_ON, len: TRAIL3_LEN, w: TRAIL3_W, alpha: TRAIL3_ALPHA }; },
  // 第 8 轮修正: 诊断"加减猛禽后别名是否指向活对象"
  raptorRefs: () => ({ eagleIsLive: eagle === (eagles[0] || null), eagleNull: eagle === null,
                       falcons: falcons.map(f => f.label), eagles: eagles.map(E => E.label),
                       total: raptors.length, activeId }),
  get stoop() { return raptors.map(r => r.stoopT || 0); },
  get zRange() {
    let lo = 1e9, hi = -1e9, sum = 0, cnt = 0;
    for (let i = 0; i < N; i++) if (alive[i]) { const z = Z[i]; if (z < lo) lo = z; if (z > hi) hi = z; sum += z; cnt++; }
    let glo = 1e9, ghi = -1e9, gsum = 0, gcnt = 0;
    for (let i = 0; i < M; i++) if (galive[i]) { const z = Z2[i]; if (z < glo) glo = z; if (z > ghi) ghi = z; gsum += z; gcnt++; }
    return { starling: cnt ? { lo, hi, mean: sum / cnt } : null,
             goose: gcnt ? { lo: glo, hi: ghi, mean: gsum / gcnt } : null,
             zMeanLive, zLowLive, zHighLive };
  },
  get scene() { return { gravity: GRAV_ON, view3D: VIEW3D, camYaw: cam.yaw, camPitch: cam.pitch, camDist: cam.dist, camAuto: cam.auto }; },
  computeSceneRef: () => computeScene,
  async setCompute(mode) {                       // "cpu" | "gpu" | "auto": 立即尝试切换
    computeMode = mode;
    if (mode === "cpu") { gpuCompute = false; return { backend: "cpu" }; }
    const B = window.ComputeBackend;
    if (!B) return { backend: "cpu", reason: "后端脚本缺失" };
    if (!B.ready()) {
      const ok = await B.init(computeScene);
      computeInitInfo = B.info();
      if (!ok) return { backend: "cpu", reason: computeInitInfo.reason };
    }
    computeSelfCheck = await B.selfCheck(computeScene, computeScene.cpuForces);
    if (!computeSelfCheck.passed) { gpuCompute = false; return { backend: "cpu", selfCheck: computeSelfCheck }; }
    gpuCompute = true;
    return { backend: "webgpu", selfCheck: computeSelfCheck };
  },
  async selfCheckNow() {                         // 浏览器里手动复跑一次自检
    const B = window.ComputeBackend;
    if (!B || !B.ready()) return null;
    computeSelfCheck = await B.selfCheck(computeScene, computeScene.cpuForces);
    return computeSelfCheck;
  },
  async stepGPUOnce() {                          // 手动跑一帧 GPU 路径(调试)
    if (!window.ComputeBackend || !window.ComputeBackend.ready()) return null;
    const t0 = performance.now();
    await stepGPU();
    return { ms: performance.now() - t0, gpuMs: perf.gpuMs, uploadMs: perf.uploadMs, readbackMs: perf.readbackMs };
  },
  /* 浏览器侧测速: 连跑 frames 帧 GPU 路径, 返回整体 step 与三段(上行/GPU/回读)的中位数。
   * 用法(控制台): await SIM.benchGPU(120) */
  async benchGPU(frames) {
    if (!window.ComputeBackend || !window.ComputeBackend.ready()) return { error: "WebGPU 未就绪: " + (computeInitInfo && computeInitInfo.reason) };
    const f = frames || 120;
    const tot = [], up = [], gp = [], rd = [];
    for (let i = 0; i < f; i++) {
      const t0 = performance.now();
      const r = await stepGPU();
      tot.push(performance.now() - t0); up.push(r.uploadMs); gp.push(r.gpuMs); rd.push(r.readbackMs);
    }
    const med = a => { a = Array.from(a).sort((x, y) => x - y); return a[a.length >> 1]; };
    return { frames: f, n: N, stepMs: med(tot), uploadMs: med(up), gpuMs: med(gp), readbackMs: med(rd),
             cpuRestMs: med(tot) - med(up) - med(gp) - med(rd) };
  },
  get renderBackend() { return glReady ? "webgl" : (want2D ? "2d(forced)" : "2d(fallback)"); },
  initRenderBackend: () => { tryInitGL(); return glReady; },
  get glInfo() { return window.GLBackend ? window.GLBackend.info() : null; },
  // P2: 雁群中心化状态(验收判据 4/5/6 用)
  get geeseInfo() {
    return { leaderIdx, shift: gooseShift, disarray, debuff: gooseDebuff,
             juvenileAlive: juvenileAlive(), juvenileTotal: juvCount,
             apexAlive: !!galive[leaderIdx], galiveCount,
             apexX: Lx, apexY: Ly, leaderAng,
             alerts: stats.gooseAlerts, falseAlerts: stats.gooseFalseAlerts,
             disarrayCount: stats.gooseDisarray };
  },
  // P3: 两只隼的策略参数(实际值)与上一期适应度
  get falconPolicies() {
    return falcons.map((f, k) => {
      const v = policyVals({ policy: { evalP: f.policy.p } });
      return { id: k, normalized: Array.from(f.policy.p), vals: v,
               gen: f.policy.gen, periods: f.policy.periods,
               baseFit: f.policy.baseFit, lastFit: f.policy.lastFit,
               isCand: f.policy.isCand, score: f.score };
    });
  },
  resetFalconPolicies,
  killGoose: gooseDies,                    // 调试/验收: 手动干掉一只雁(走真实死亡流程)
  slotOf: i => (i + gooseShift) % M,
  slotRankArm: i => ({ rank: slotRank[(i + gooseShift) % M], arm: slotArm[(i + gooseShift) % M] }),
  isJuvenile,
  get esConst() { return { ES_EVAL_FRAMES, ES_SIGMA, ES_MISS_WEIGHT, ES_METAB_WEIGHT, ES_NP }; },
  setEvalFrames(v) { esEvalOverride = v; },
  // ---- 任务0: 一次性物理基准(浏览器控制台或 headless 都用这一个入口) ----
  // 用法: SIM.bench()  或  SIM.bench(300, [2000,5000,10000,20000])
  // 返回每档的每帧 step 耗时分布(只调 step(), 完全不碰 render)
  bench(steps, ns) {
    const list = ns && ns.length ? ns : [2000, 5000, 10000, 20000];
    const out = [];
    const keepN = N;
    for (const n of list) {
      setN(n);
      for (let i = 0; i < 30; i++) step();            // 预热(让 JIT 稳定)
      const times = new Float64Array(steps);
      for (let i = 0; i < steps; i++) {
        const t0 = performance.now();
        step();
        times[i] = performance.now() - t0;
      }
      const sorted = Array.from(times).sort((a, b) => a - b);
      const med = sorted[steps >> 1];
      const p90 = sorted[Math.min(steps - 1, Math.floor(steps * 0.9))];
      const p99 = sorted[Math.min(steps - 1, Math.floor(steps * 0.99))];
      const mean = sorted.reduce((a, b) => a + b, 0) / steps;
      out.push({ n, steps, median: +med.toFixed(3), p90: +p90.toFixed(3), p99: +p99.toFixed(3),
                 mean: +mean.toFixed(3), min: +sorted[0].toFixed(3) });
    }
    setN(keepN);
    return out;
  },
  // P1: 采样目标获取的直接入口(调试/验收用)
  probe: (x, y, vx, vy, r) => perceive(x, y, vx, vy, r * r),
  inCone,
  // P4: 惊飞网规模(雁能"看到"多少条预警)
  get startledCount() { let c = 0; for (let i = 0; i < N; i++) if (alive[i] && startled[i]) c++; return c; },
  get startledRatio() { return aliveCount ? this.startledCount / aliveCount : 0; },
  get pvConst() { return { PV_ALERT_COS, ALERT_R, ALERT_N, ALERT_FALSE_R }; },
  get samplingConst() { return { radii: SAMPLE_RADII.slice(), angles: SAMPLE_ANGLES, SCOOP_R, LOCK_R, DIR_LAG }; },
  // 验收用: 把三只猛禽挪到远角(可每帧调用, 模拟"无猛禽干扰"的鸟群)
  parkRaptors(x = -PAD - 40, y = -PAD - 40) {
    for (const r of raptors) {
      r.x = wrapX(x); r.y = wrapY(y); r.vx = 0; r.vy = 0;
      r.dashT = 0; r.energy = ENERGY_MAX; r.memT = -1e9; r.seeing = false;
    }
  },
  starling(i) { return { x: P[2*i], y: P[2*i+1], z: Z[i], vx: V[2*i], vy: V[2*i+1], vz: VZ[i], alive: !!alive[i], mobber: !!isMobber[i] }; },
  goose(i) { return { x: P2[2*i], y: P2[2*i+1], z: Z2[i], alive: !!galive[i] }; },
  hunter(i) {
    const h = raptors[i];
    return { x: h.x, y: h.y, z: h.z, vx: h.vx, vy: h.vy, vz: h.vz || 0, energy: h.energy || 0, dashT: h.dashT || 0,
             mob: h.mob || 0, stun: h.stun || 0, lockIdx: h.lockIdx === undefined ? -1 : h.lockIdx,
             score: h.score, dashEats: h.dashEats || 0,
             kind: h.kind || "raptor", label: h.label || "" };   // 【task-6】验收探针要按种类区分
  },
  // 第 8 轮: 视角/重力/减员 编程接口
  get view3D() { return VIEW3D; },
  setView3D(v) { if (!!v !== VIEW3D) toggleView(); },
  get gravity() { return GRAV_ON; },
  setGravity(v) { GRAV_ON = !!v; const cb = el("cbGravity"); if (cb) cb.checked = GRAV_ON; },
  removeFalcon: () => removeRaptor("falcon"),
  removeEagle: () => removeRaptor("eagle"),
  get corpses() { let c = 0; for (let k = 0; k < CORPSE_CAP; k++) if (cT[k] > 0) c++; return c; },
  cam,
};
