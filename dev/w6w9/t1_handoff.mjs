/* W6(T1) handoffDoc 追加「变更记录(W6)」 —— 插在 handoffDoc 容器的最后一个 </script> 之前。
 * 用法: node _w6w9/t1_handoff.mjs [--apply]   (T1_TARGET 可指定其它文件)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML = process.env.T1_TARGET ? path.resolve(ROOT, process.env.T1_TARGET) : path.join(ROOT, "掠食竞赛(4).html");

const SECTION = `
 变更记录(W6: 隼·链式攻击 / T1):
 一句话: 隼从"狙击枪"(D 静态锁定 + 弱制导, 一次冲刺只可能吃到锁定那一只)改成"链式扫射"
 (动态再锁定 + 末制导加强 + 逐口能耗递增), 一次冲刺连着吃直到能量耗尽/吃到雁/被打断。
 【落地的锚点(改前 -> 改后)】
  · 常量区(第 293 行附近): DASH_HOME_K 0.12 -> 0.30(只影响带锁冲刺; 驱逐/追雁冲刺 lockIdx=-1
    天然不制导, 不用区分); 新增 F_CHAIN_R=60 / F_CHAIN_R2 / F_CHAIN_CONE=π/4(45°)/ F_CHAIN_COS /
    F_CHAIN_RELOCK=3 / F_CHAIN_MAX=150 / F_DASH_TRIGGER=280 / F_FEAST_RECOVER=60 / F_CHAIN_BITES=21。
  · DASH_LOCK 标注 deprecated(隼侧): "只吃锁定那一只"已被动态再锁定取代, 该常量现在只服务鹰的
    Q-learning 动作 0/3(鹰的机制一个字没动); 契约不删。
  · perceive 的 PC.lockIdx 语义未变(仍是捞勺中心 LOCK_R 内最近的鸟), 但冲刺期间**不再限制吃判**。
  · 6.4 吃判: "f.dashT > 0 && f.lockIdx >= 0 && f.lockIdx !== i -> continue" 改为
    "f.kind !== 'falcon' && ...", 即隼链式冲刺期间允许吃任何撞进 9px 判定的鸟; 鹰/雁隼保持旧行为。
  · 6.5 雁吃判: 隼在冲刺中吃到雁 -> 立即结束这一链(dashT=1 + chainStop 哨兵, 见"实现事实")+
    chainTurbo=F_FEAST_RECOVER; 冲刺收尾时 circleT = CIRCLE_FRAMES + 60(施工单原文是"额外 +60")。
  · tryDash: 记录本次链预算 chainLeft=min(dashFrames, F_CHAIN_MAX)、chainEats=0、chainBill=0、
    chainStop=0、chainS=dashFrames(哨兵)。
  · 6.8 隼冲刺分支: ① 每帧 drain 乘 eatMult=1.5^chainEats; ② 每 F_CHAIN_RELOCK=3 帧在
    45° 锥 + PV_.chainR 半径内重选最近的活椋鸟(chainRelockPick), 换目标首帧 k=1 全量转向,
    其余帧仍受 DASH_HOME_K 插值约束; ③ 续期: 锁 alive 且在 45° 锥内 -> dashT+1, 同时按 1.5^已吃数
    扣链预算; ④ 收尾: 整链全空才罚一次(已吃则免)。
  · 6.8 追猎冲刺出手门限: 锁定个体(无锁时退化为采样中心)距离 >= F_DASH_TRIGGER=280px 时不发起,
    计 stats.dashTooFar; 只加在追猎这条路径上, 不改 tryDash 的 60° 结构。
  · ES: ES_NP 5 -> 6; 新增 P_CHAIN_R=[30,90,60]px(p6 = 再锁定半径); makePolicy/policyVals/PVV/
    falconPolicies/esConst 同步扩展; p6 由 (1+1)-ES 在线学。
  · 6.9 互攻: 败方冲刺被打断时的空冲刺罚款增加 "链条上已有斩获则免罚" 的前置条件。
 【四件套】
  · 常量区注释: 每个新常量都有"动机 + 实测依据"(含 DASH_HOME_K 0.12 追不上横移猎物的实测)。
  · stats: chainTriggers / chainGooseEnds / chainRelock / chainMaxEats / dashEatsFalcon0 /
    dashEatsFalcon1 / dashEndsFalcon0 / dashEndsFalcon1 / chainInterrupts / chainFullMissPenalties /
    relockMiss / dashTooFar / chainEnergyEnds / chainBudgetEnds / chainBillEnds。
  · SIM 钩子: chainConst(含 R/CONE_DEG/RELOCK/MAX/TRIGGER/FEAST_RECOVER/HOME_K/BITES)、chainInfo
    (每只隼的 chainEats/chainLeft/chainBill/lockIdx/dashT/dashEats/eats/dashEnds);
    hunter(i) 增加 chainEats/chainLeft/chainS。旧钩子一个没删(scores/kills 前三元素、SIM.stats、
    SIM.bench、falconPolicies、esConst 等契约保持)。
  · 面板: 新增两行"链式攻击(W6)…"与"链终止: 能量/预算/账单", 并显示 dashMaxEats/锁定/自由。
 【实现事实(本轮自己踩到并修掉的坑, 全部有实测证据)】
  1) p6 -> 再锁定半径映射写错: 初版写成 P_CHAIN_R[0] * denorm(...) = 0.5 × 1.0, 半径 0.5px,
     导致"再锁定 0 次"(实测 900 帧 209 次调用全部返回 -1); 改成 denorm(P_CHAIN_R, p[5]) 后
     4 种子再锁定 84~106 次/4000 帧。
  2) "只按每帧 drain 的 1.5^n 递增"不足以终止链: 密集鸟群里一次扫掠能在 8 帧内连吃 8 只
     (实测帧 379~386 连续 8 口), 而 drain 是每帧扣一次, 追不上 8 帧内完成的连吃 ——
     实测单链最长 11~17 只, 越出验收带 [2,8]。
  3) 大餐收尾不能直接 f.dashT = 0: 冲刺收尾的结算块在隼自己的冲刺分支里, 而雁吃判在 6.5 雁循环、
     跑在 6.8 之前 —— 直接清零会让结算块整块被跳过, "吃到雁的链"既不进 dashEnds 也不进
     dashEatsFalcon0(实测漏计 1~4 条链/种子), 把单次冲刺 eats 均值系统性拉低。改 dashT=1 +
     chainStop 哨兵, 下一帧走同一条结算路径。
  4) 测量 bug(自曝): stats.dashEnds 是**两只隼合计**的冲刺收尾数, 而 dashEatsFalcon0 只数隼①,
     此前用 dashEnds 当分母 -> "单次冲刺 eats 均值"被系统性除以 2(把本来达标的 2.9~3.9 报成 1.4~1.9)。
     已加 stats.dashEndsFalcon0/1 分账, 验收分母一律用隼①自己的收尾数。
  5) 扫描 harness bug(自曝): _w6w9/jsdom_drive.mjs 的 readHtmlCached() 按路径缓存, 把多组参数
     写进同一个文件名反复跑会命中旧缓存, 得出"多组参数结果完全相同"的假结论。参数矩阵必须
     每组独立文件名(或 fresh:true)。
 【规格未规定处新增的机制级常量(显式声明)】
  F_CHAIN_BITES = 21(单链能量账单预算, 口数当量 -> 单链峰值封顶 6~8 口)。
  依据/量纲解释: 施工单 T1 规格 3 第一款是"dash 期间每吃 1 只, DASH_DRAIN 乘 1.5^已吃数"。
  本轮**保留**了每帧 drain 的 1.5^chainEats 乘子(与 W8 的 hDrainPen(f) 并存), 另外把同一因子
  落成"每吃一口记一笔 1.5^(n-1) 的账", 账单越线即收尾 —— 否则 8 帧内完成的连吃根本无法被
  "每帧扣一次"的量拦住(见实现事实 2)。该封顶只是把 1.5^n 的账算实, **不替代**能耗项: 实测
  四条终止条件的触发次数里, "能量耗尽"始终是主因(下表的能量列远大于账单列)。
 【验收(主修订 掠食竞赛(4).html, sha256 96A3F031…; 4 种子 × 4000 帧, 先默认编制预热 1500 帧)】
  默认编制(含 W8 驱逐鸟, T3 已落盘):
   dashMaxEats(逐种子)          = 7 / 7 / 6 / 6        (∈[2,8] 通过; dashMaxEatsLocked 同值)
   单次冲刺 eats 均值(逐种子)    = 1.52 / 1.89 / 1.50 / 1.75, 池化 1.67 -> 未达 >=2(见下方归因)
   EV/次冲刺                    = 6.70 / 5.60 / 2.32 / 1.63, 池化 3.95 -> 通过(>=+1.5)
   隼①净得分 > 0 的种子数        = 4/4                          -> 通过(>=3)
   chainGooseEnds(全期)         = 1 / 3 / 2 / 1                 -> 通过(>=1)
   再锁定次数 / 链触发           = 91~106 / 20~25 次每 4000 帧
   链终止分布(能量/预算/账单/大餐/打断) = 26,1,2,1,0 / 20,1,2,3,0 / 17,4,0,2,0 / 32,0,0,1,0
  物理哈希(固定种子 1~4)        = ff765f01 / 1054d853 / e156b932 / 369f2b92
  归因实验(T1_HARRIER_OFF=1, 同一修订里 SIM.setHarrier(false) 关掉 W8 驱逐鸟):
   dashMaxEats = 8/7/8/8; 单次冲刺 eats 均值 = 1.96/3.09/2.27/2.36(池化 2.41, 通过);
   EV = 10.79/0.00/6.79/6.43(池化 6.04); 隼①净得分 > 0 = 3/4; chainGooseEnds = 1/3/2/5;
   物理哈希 = 936db330/d4a6d456/22b97d54/453be215。
  => 结论: T1 机制本身在 4 种子上达标(池化均值 2.41, 峰值 8); 集成后的均值下降(2.41 -> 1.67)
     可归因于 T3 驱逐鸟对猛禽的持续 debuff(转向类 ×(1-0.02L) 最低 0.4、冲刺能耗 ×(1+0.03L)
     最高 1.9)把链的能量预算提前耗尽(能量终止次数 17~32/种子)。这是跨任务集成事实, 已交 Lead
     裁决; 本文件未为迁就该阈值改动任何施工单常量。
  备注: dashMaxEatsLocked 语义已随 D-lock 变更 —— 旧义"锁定冲刺吃数(应 <=1)"改为
  "带锁冲刺(追猎/夹击, lockIdx>=0 或本链吃到 >1)吃数", 现在允许 >1; 未带锁的驱逐/追雁冲刺
  仍走 dashMaxEatsFree。旧计数器不删, 面板照旧显示, 只是口径改写。
 ================================================================================
`;

let src = fs.readFileSync(HTML, "utf8");
if (src.includes("变更记录(W6: 隼·链式攻击 / T1)")) { console.log("已存在, 跳过"); process.exit(0); }
const marker = "</script>\n</body>";
const i = src.lastIndexOf(marker);
if (i < 0) { console.log("找不到 handoffDoc 结尾锚点"); process.exit(2); }
const hud = src.lastIndexOf('id="handoffDoc"');
if (hud < 0 || hud > i) { console.log("结尾不在 handoffDoc 容器内(找不到 id=\"handoffDoc\"), 中止"); process.exit(3); }
const out = src.slice(0, i) + SECTION + src.slice(i);
console.log("将插入 " + SECTION.length + " 字符, 文件 " + src.length + " -> " + out.length);
if (process.argv.includes("--apply")) { fs.writeFileSync(HTML, out); console.log("WROTE", HTML); }
