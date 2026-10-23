/* W6b(T1b) handoffDoc 追加「变更记录(W6b)」 —— 插在 handoffDoc 容器的最后一个 </script> 之前。
 * 用法: node _w6w9/t1b_handoff.mjs [--apply]   (T1B_TARGET 可指定其它文件)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML = process.env.T1B_TARGET ? path.resolve(ROOT, process.env.T1B_TARGET) : path.join(ROOT, "掠食竞赛(4).html");

const SECTION = `
 变更记录(W6b: 隼·配合四件套 / T1b):
 一句话: 隼从"单打"变成"配合"—— 追猎方按牧羊位把鸟群赶向设伏方, 设伏方用"群体均速 × 前置时间
 倍率 p7"的追踪解提前堵截, 感知通过按值拷贝共享, 任一隼出手当帧就事件双打给其余隼发牌,
 同盟之间互不驱逐/互不扣分抢分。四件套全部落在"常量区 + stats 计数 + SIM 钩子 + 面板一行"。
 【落地的锚点(改前 -> 改后)】
  · 常量区: 新增 F_SHEPHERD_R=180 / F_SHARE_R=150 / F_EVT_BIAS=1.5 / F_EVT_SECTOR=60° / F_EVT_COS /
    F_INTERCEPT_MAX=120。
  · ES: 新增 p7 = P_LEAD_TIME=[0.5, 2.0, 1.0](前置时间倍率), ES_NP 6 -> 7;
    makePolicy/policyVals/PVV/falconPolicies/esConst 同步扩展(p7 由 (1+1)-ES 在线学)。
    被取代并标 deprecated(参数位保留, 不再被任何决策读取):
      PV_.interceptAhead / P_INTERCEPT(p4) / INTERCEPT_AHEAD 常量 -> 由 p7 取代;
      P_DOUBLE_TEAM(p3) / DOUBLE_TEAM_E 常量 -> 由"事件双打"取代。
  · perceive(px,py,vx,vy,viewR2,biasDir): 新增第 6 参 biasDir(默认 undefined/null = 不启用);
    打分时"候选点方向落在 biasDir ±60° 扇区内 -> ×F_EVT_BIAS"; PC 新增 mvx/mvy(视野内椋鸟均速)。
    旧调用(SIM.probe/雁隼/鹰)不传第 6 参, 逐位不变。
  · 新增 makePC()/copyPC()/SHARED_PC/SHEP 四个零分配载体: 共享感知按值拷贝
    (cx/cy/lockIdx/score/n/mvx/mvy + 走位要用的 x/y/z/lockZ), 绝不把全局 PC 的引用借出去。
  · makeFalcon: +lastPC(按值拷贝)/sharedUses/biasDir/evtDouble; resetPredators 一并清零。
  · 6.8 隼段:
     ② 角色: ambushId = 非追猎方里离质心最近者(2 只 = 另一只; 1 只 = 无设伏方);
        追猎方巡航目标从"质心"改为"质心与设伏方连线延长线上、质心外侧 F_SHEPHERD_R";
        其余非追猎方按 shepherdRank()(+1,-1,+2,-2 … 每档 30°)错开站位。
     ① 设伏方拦截位 = 质心 + (mvx,mvy) × min(F_INTERCEPT_MAX, dHunter/DASH_SPEED + dSelf/REST_SPEED) × p7。
     ③ 共享感知: 设伏方自己 perceive 为 null 或目标 > F_SHARE_R 时, 改用追猎方**上一帧**的
        SHARED_PC 快照(frame 戳严格 = frame-1, 不留过期目标), 计 stats.sharedPcUses。
     ④ 出手: 原"能量双打(p3)"分支删除, 改为只有被事件点名的隼(f.evtDouble)才出手;
        隼段末尾统一发牌: 任一隼 tryDash 成功当帧 -> 其余隼 energy ≥ 各自 dashMin 则 circleT=0 +
        biasDir = 那次冲刺方向的反方向; 带上 biasDir 的冲刺计入 stats.evtBiasDashes。
     ⑤ 驱逐冲刺: 加一条 "r.kind === f.kind -> continue"(隼不驱逐隼)。
  · 6.10 互攻: falcon-falcon 对保留击退 + 眩晕 + CLASH_CD, **废除 CLASH_COST 扣分与 STEAL_FRAC 抢分**
    (只对 鹰/雁隼 生效); 面板/momentum 口径 stats.clashes 不变; 新增 stats.falconClashes /
    stats.falconSteals(恒 0, 判据) / stats.falconAvoided(反事实金额, 证明豁免真的拦下了转移)。
 【四件套】
  · 常量区注释: 每个新常量都有"动机 + 量纲/上限理由"(见 6.8 段头的 W6b 常量块)。
  · stats: shepherdFrames / sharedPcUses / eventDoubles / evtBiasDashes / falconClashes /
    falconSteals / falconAvoided。
  · SIM 钩子: t1bConst(SHEPHERD_R/SHARE_R/EVT_BIAS/EVT_SECTOR_DEG/INTERCEPT_MAX/LEAD/ES_NP/DEPRECATED)、
    t1bInfo(每只隼 role/ lastPC 七字段+frame / biasDirDeg / evtDouble / sharedUses / leadK)。
    旧钩子一个没删(scores/kills 前三元素、SIM.stats、chainConst/chainInfo、esConst 等契约保持)。
  · 面板: fpsLine 新增"配合四件套(W6b)…"一行(牧羊位/共享感知/事件双打/偏向冲刺/同盟豁免/p7)。
 【规格未规定处新增的机制级解释(显式声明, 不是调参)】
  1) 牧羊位的"其余隼"站位: 施工单只说"其余也按各自牧羊位站位", 未给多隼错开规则。本实现按
     非追猎方队列序号把基向扇形错开 ±30°/±60°…(shepherdRank, 确定性、不消耗随机数), 否则
     3 只以上隼会叠在同一点。默认编制(2 隼)下永远用 rank=0, 与原文一字不差。
  2) SHARED_PC 的时效: 施工单说"追猎方上一帧的 pc"。本实现取"严格上一帧"(frame 戳 == frame-1),
     追猎方连续两帧都没感知时共享自动失效, 避免拿几十帧前的旧目标当共享感知。
  3) 事件双打的偏向角 = 那次冲刺方向 + π(反方向), 冲刺含驱逐冲刺(施工单原文"任一隼 tryDash 成功")。
 【实现事实(本轮自己踩到/核对过的点)】
  1) PC 是每帧复用的全局对象(鹰/隼/雁隼三个调用者共用), "共享 pc"如果直接传引用, 下游的
     targetZ/记忆点会被别的猛禽当帧改写 —— 因此 SHARED_PC 与每隼 lastPC 都是独立对象 + copyPC 拷贝。
  2) SIM.t1bInfo 是 getter(不是函数): 验收脚本若用 typeof 判 "function" 会永远为假,
     导致"角色帧 0/0/0"的假结论(本轮自曝并修正了 t1b_probe 的采样)。
  3) 集成臂(驱逐鸟开)会把四件套的收益整体压低: 驱逐鸟压力让隼转向 ×(1-0.02L)、冲刺能耗 ×(1+0.03L),
     所以判据按**隔离臂(SIM.setHarrier(false))**判定, 集成臂如实并列(与 T1 同一处理)。
  4) ES_NP 6->7 会多消耗一个随机数/候选抽样 -> 即使机制不生效的"隼×1"臂, 轨迹也会整体错开;
     因此单隼臂只能比"速度方差"这类统计量, 不能逐帧对齐(实测速度方差 1.02×)。
 【验收(主修订 掠食竞赛(4).html, sha256 51C39BD9…(T1b 后); 4 种子 × 4000 帧, 先默认编制预热 1500 帧)】
  判据 1 dashEndBirds/冲刺 均值(逐种子):
    隔离臂 隼×2: T1 基线 20.62/21.00/41.58/34.77(均 29.49) -> T1b 44.05/51.30/45.84/49.22(均 **47.60**, +61.4%)
    集成臂 隼×2: T1 基线 24.10/21.89/25.95/32.51(均 26.11) -> T1b 41.83/32.63/38.13/46.88(均 **39.87**, +52.7%)
    单隼对照:   隔离 30.75 -> 26.66; 集成 26.68 -> 26.81(单隼无牧羊/无共享/无事件, 数值波动来自 ES_NP 变更)
  判据 2 "隼×2 / 隼×1"总捕获比(逐种子, 同文件同种子):
    隔离臂: T1 基线 1.83/1.31/2.60/1.54(中位 1.69) -> T1b 3.67/2.52/3.10/3.31(中位 **3.21**, 判据 >=1.8 通过)
    集成臂: T1 基线 1.63/3.29/1.71/2.00(中位 1.86) -> T1b 3.21/2.80/3.33/4.36(中位 **3.27**)
    原始 Δ捕获(4000 帧, 隔离臂): 隼×2 185/131/195/145(均 164.0) -> 290/232/242/222(均 **246.5**);
                                 隼×1 101/100/75/94(均 92.5)   -> 79/92/78/67(均 79.0)
  判据 3 同盟豁免: stats.falconSteals = **0**(16/16 组); stats.falconClashes > 0(集成×2: 10/2/2/6;
    隔离×2: 6/7/5/4) -> 豁免路径确实被走到且零转移。定向取证(_w6w9/t1b_falconclash.mjs,
    强制两隼贴住互攻): T1b 该帧 scoreDeltaSum = 0、falconAvoided = 10、眩晕 90、无第二次互攻(60 帧内);
    对照组 T1 基线同场景 scoreDeltaSum = -10(CLASH_COST 生效)。
  判据 4 单隼速度方差(不超基线 2 倍):
    隔离臂 隼×1: T1 基线 1.6884/1.9947/1.6196/1.7438(中位 1.7161) -> T1b 1.6580/1.8394/1.6180/1.8732(中位 1.7487)= 1.02×
    集成臂 隼×1: T1 基线 1.8233/1.7423/1.9181/1.7836(中位 1.8034) -> T1b 1.7430/1.7336/1.8198/1.7644(中位 1.7537)= 0.97×
  四件套活跃度(隔离臂 隼×2, 4000 帧): 共享感知 1930~2177 帧 · 事件双打 18~27 次 · 牧羊帧 3582~4432 ·
    偏向冲刺 18~23 次; 角色帧(猎/伏/牧) ≈ 4000/3990/10。
  物理哈希(固定种子 1~4, ?grav=0, 隔离臂 隼×2): T1 基线 936db330/d4a6d456/22b97d54/453be215 ->
    T1b 29534a79/ec495895/5ed6a5a1/6b36a966。
  T1 回归(集成臂, _w6w9/t1_run.mjs 4×4000): dashMaxEats 7/7/6/6 -> 7/8/8/8(∈[2,8] 通过);
    单次冲刺 eats 均值(隼①) 1.52/1.89/1.50/1.75(池化 1.67) -> 1.62/2.27/2.39/2.15(池化 **2.11**, 达 >=2);
    EV/次冲刺 池化 3.95 -> 3.83(>=+1.5 通过); 隼①净得分 > 0 = 4/4 -> 3/4(>=3 通过);
    chainGooseEnds 1/3/2/1 -> 0/0/1/2(>=1 通过); 总捕获 195.8 -> **256.5**(+31%)。
  => 结论: 四件套在隔离臂把"每次冲刺终点 80px 内可见鸟数"从 29.49 提到 47.60(+61%), 并让
     "两隼/一隼 总捕获比"从 1.69 提到 3.21(判据 >=1.8); 同盟豁免使隼-隼互攻零分转移;
     单隼速度方差 1.02×(判据 <=2×)。T1 的链式攻击指标同步改善(池化 eats 1.67 -> 2.11)。
  ================================================================================
`;

let src = fs.readFileSync(HTML, "utf8");
if (src.includes("变更记录(W6b: 隼·配合四件套 / T1b)")) { console.log("已存在, 跳过"); process.exit(0); }
const marker = "</script>\n</body>";
const i = src.lastIndexOf(marker);
if (i < 0) { console.log("找不到 handoffDoc 结尾锚点"); process.exit(2); }
const hud = src.lastIndexOf('id="handoffDoc"');
if (hud < 0 || hud > i) { console.log("结尾不在 handoffDoc 容器内, 中止"); process.exit(3); }
const out = src.slice(0, i) + SECTION + src.slice(i);
console.log("将插入 " + SECTION.length + " 字符, 文件 " + src.length + " -> " + out.length);
if (process.argv.includes("--apply")) { fs.writeFileSync(HTML, out); console.log("WROTE", HTML); }
