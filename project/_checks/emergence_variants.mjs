/* ============================================================================
 * W2 变体生成器(离线调参用): 把"新的椋鸟受力块"注入一份 html 副本, **不碰主文件**
 * ----------------------------------------------------------------------------
 * 用法: node _checks/emergence_variants.mjs <输出html> [K=V ...] [--base=<html>]
 *   例: node _checks/emergence_variants.mjs _wip/variants/a.html ALIGNMENT_W=2.4 ANISO=0.3 CONT=1
 *   (用 K=V 而不是 JSON: PowerShell 会把 JSON 里的双引号吃掉)
 *
 * 参数(全部可选, 缺省 = 不动):
 *   ALIGNMENT_W / COHESION_W / MAX_FORCE / SEP_GAIN / SEP_R / PERCEPTION / CENTROID_FORCE
 *        —— 直接改同名常量(SEP_R 写进 SEP_R2 = r*r)
 *   ANISO      —— 各向异性权重 0~1(0 = 关闭; 需要在受力块里用新写法)
 *   SPEED_K    —— "速率归一"力(0 = 关闭; 在积分段里把 |v| 拉回 MAX_SPEED)
 *   CONT       —— 1 = 打开"惊飞波传染"机制(见下), 0/缺省 = 关闭
 *   ALERT_FRAMES / ALERT_TRIG / RELAY_MIN / CONT_W —— 传染机制参数
 *   OLD        —— 1 = 不注入新受力块(用于验证生成器只改了想改的地方)
 *
 * 三处结构性改动(为什么写在代码注释里):
 *   ① 对齐 / 凝聚 / 分离 各自独立成力, 各自有转向预算; 对齐用邻居**单位航向**平均。
 *      旧写法把三者先混成一个方向再归一化, 对齐权重被凝聚的距离项吃掉 -> 刚性一坨,
 *      扰动被"共识"抹平, 传不出去。
 *   ② 惊飞波传染(escape-wave contagion): 邻居急转 -> 我也朝同方向急转(带 12 帧左右
 *      的警报记忆)。真实椋鸟的惊飞波就是"照抄邻居的动作"而不是"向邻居的平均航向靠拢";
 *      单靠对齐是均值回归, 一个被吓到的个体很快被拉回共识, 波传不过几个身位。
 *   ③ (可选)速率归一: 真实椋鸟几乎恒速飞行。
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, "..");
const P = {};
let outArg = null, baseArg = null;
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--base=")) baseArg = a.slice(7);
  else if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(a)) {
    const k = a.slice(0, a.indexOf("=")), v = a.slice(a.indexOf("=") + 1);
    P[k] = (v !== "" && !Number.isNaN(Number(v))) ? Number(v) : v;
  } else outArg = a;
}
const outPath = path.resolve(outArg || path.join(ROOT, "_wip/variants/variant.html"));
const basePath = path.resolve(baseArg || path.join(ROOT, "掠食竞赛.html"));
let code = fs.readFileSync(basePath, "utf8");

/* ---- 1. 改常量(只动已有的 `const NAME = ...;`) ---- */
function setConst(src, name, value) {
  const re = new RegExp(`(\\b${name}\\s*=\\s*)[^,;\\n]+`);
  if (!re.test(src)) throw new Error(`setConst: 找不到常量 ${name}`);
  return src.replace(re, `$1${value}`);
}
function ensureConst(src, name, value, anchor) {
  if (new RegExp(`\\bconst ${name}\\b`).test(src)) return setConst(src, name, value);
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(`ensureConst: 找不到锚点 ${anchor}`);
  const j = src.indexOf("\n", i);
  return src.slice(0, j + 1) + `const ${name} = ${value};\n` + src.slice(j + 1);
}

const CONT = !!P.CONT;
const ADD = !!P.ADD;                       // ADD=1: 保留旧受力式, 只在上面"叠加"新机制(风险最小)
if (P.SEP_R !== undefined) code = setConst(code, "SEP_R2", `${P.SEP_R} * ${P.SEP_R}`);
for (const k of ["ALIGNMENT_W", "COHESION_W", "MAX_FORCE", "SEP_GAIN", "PERCEPTION", "CENTROID_FORCE"]) {
  if (P[k] !== undefined) code = setConst(code, k, String(P[k]));
}
const CONST_ANCHOR = "const MIGRATE_FORCE = 0.06;";
code = ensureConst(code, "ANISO", String(P.ANISO !== undefined ? P.ANISO : 0), CONST_ANCHOR);
if (P.SPEED_K !== undefined) code = ensureConst(code, "SPEED_K", String(P.SPEED_K), CONST_ANCHOR);
if (ADD) code = ensureConst(code, "ALIGN2_W", String(P.ALIGN2_W !== undefined ? P.ALIGN2_W : 1.5), CONST_ANCHOR);
if (CONT) {
  code = ensureConst(code, "ALERT_FRAMES", String(P.ALERT_FRAMES !== undefined ? P.ALERT_FRAMES : 12), CONST_ANCHOR);
  code = ensureConst(code, "RELAY_MIN", String(P.RELAY_MIN !== undefined ? P.RELAY_MIN : 0.15), CONST_ANCHOR);
  code = ensureConst(code, "CONT_W", String(P.CONT_W !== undefined ? P.CONT_W : 4.0), CONST_ANCHOR);
  code = ensureConst(code, "REFRACT", String(P.REFRACT !== undefined ? P.REFRACT : 30), CONST_ANCHOR);
  code = ensureConst(code, "ALERT_TRIG", String(P.ALERT_TRIG !== undefined ? P.ALERT_TRIG : 0.5), CONST_ANCHOR);
}

/* ---- 2. 注入新受力块(按锚点定位旧块, 不依赖行号) ---- */
const A1 = "    let ax = 0, ay = 0;\n    if (kn > 0) {";
const A2 = "    ACC[2*i] = ax; ACC[2*i+1] = ay;";
const i1 = code.indexOf(A1), i2 = code.indexOf(A2);
if (i1 < 0 || i2 < 0 || i2 < i1) throw new Error("注入失败: 找不到受力块锚点(旧块已被改动?)");

const relayAcc = CONT
  ? `        relay += (W2_ALERT[j] > 0.5) ? W2_TURN[j] : 0;   // 惊飞波: 邻居的"急转"带符号累加\n`
  : "";
const contagion = CONT
  ? `
      // ② 惊飞波传染: 邻居正在急转 -> 我朝**同一方向**急转(照抄动作, 不是向平均航向靠拢)。
      //    只靠对齐是均值回归: 被吓到的个体会被邻居拉回共识, 波穿不过几个身位。
      if (Math.abs(relay) > RELAY_MIN && spi > 1e-6) {
        const s = relay > 0 ? 1 : -1;
        const mag = Math.min(1, Math.abs(relay)) * CONT_W * MAX_FORCE;
        ax += -s * viy / spi * mag;                       // 左转 = 速度逆时针 90°(-vy, +vx)
        ay += s * vix / spi * mag;
      }
`
  : "";
const alertState = CONT
  ? `    /* 传染状态机(可兴奋介质的一次性波): a>0 = 正在急转(警报中); a<0 = 不应期; a=-REFRACT = 待命。
     * 为什么要有不应期: 没有它, 两只鸟会互相接力把"警报"永久维持下去 —— 整群会一直打转。 */
    { const a0 = W2_ALERT[i];
      if (a0 > 0) W2_ALERT[i] = a0 - 1;
      else if (a0 <= -REFRACT && Math.abs(relay) > RELAY_MIN) W2_ALERT[i] = ALERT_FRAMES;
      else if (a0 > -REFRACT) W2_ALERT[i] = a0 - 1; }
`
  : "";

const NEW_BLOCK = `    /* ---- W2 涌现增强: 对齐 / 凝聚 / 分离 各自独立成力(不再先混成一个方向再归一化) ----
     * 为什么: 旧写法把 凝聚(邻居位置和) 与 对齐(邻居速度和) 先相加再归一化, 得到一个
     * "折中方向"; 对齐的权重被凝聚的距离项吞掉, 群体只能靠"挤成一坨"维持一致 ——
     * 宏观上就是一块刚性实体: 惊飞信号传不出 flee 半径(实测 100~150px 之后骤降)。
     * 新写法:
     *   ① 对齐用**邻居单位航向的平均**(不看邻居快慢, 也不被慢鸟拖偏), 单独给预算 ALIGNMENT_W;
     *   ② 凝聚单独给预算 COHESION_W, 目标是"邻居质心方向";
     *   ③ 分离沿用距离加权(越近推得越狠);
     *   ④ 各向异性 ANISO: 侧前方的邻居权重更高(椋鸟视野有盲区, 真实群的转向是"从前往后"传);
     *   ⑤ 全程零分配: 只用栈上标量与已复用的 KX/KY/KD/KJ 槽。
     * 每项先归一化方向再 clamp 到自己预算, 所以邻居再多、距离再远也不会爆掉。 */
    let ax = 0, ay = 0;
    let relay = 0;                                             // 邻居"急转"的带符号和(惊飞波方向)
    if (kn > 0) {
      const vix = V[2*i], viy = V[2*i+1];
      const spi = Math.sqrt(vix * vix + viy * viy);
      let pxn = 0, pyn = 0, uxn = 0, uyn = 0, sepx = 0, sepy = 0, wsum = 0;
      for (let m = 0; m < kn; m++) {
        const j = KJ[m];
        const vjx = V[2*j], vjy = V[2*j+1];
        const spj = Math.sqrt(vjx * vjx + vjy * vjy);
        // 各向异性: 邻居在我正前方 -> 权重 1+ANISO; 正后方 -> 1-ANISO(下限 0.1)
        let w = 1;
        if (ANISO > 0 && spi > 1e-6) {
          const dl = Math.sqrt(KD[m]);
          if (dl > 1e-6) w += ANISO * (vix * KX[m] + viy * KY[m]) / (spi * dl);
          if (w < 0.1) w = 0.1;
        }
        wsum += w;
        pxn += KX[m] * w; pyn += KY[m] * w;                     // 凝聚: 邻居质心(加权)
        if (spj > 1e-9) { uxn += vjx / spj * w; uyn += vjy / spj * w; }   // 对齐: 单位航向(加权)
        if (KD[m] < SEP_R2) {                                   // 分离: 距离加权推开
          const wd = 1 / Math.max(KD[m], 1);
          sepx -= KX[m] * wd; sepy -= KY[m] * wd;
        }
${relayAcc}      }
      const inv = 1 / Math.max(wsum, 1e-9);
      pxn *= inv; pyn *= inv; uxn *= inv; uyn *= inv;
      const pn = Math.sqrt(pxn * pxn + pyn * pyn);
      if (pn > 1e-9) {                                          // 凝聚力(方向 -> 期望速度 -> 受限转向)
        const tx2 = pxn / pn * MAX_SPEED, ty2 = pyn / pn * MAX_SPEED;
        // 【关键】先按增益 1 限幅到 MAX_FORCE, 再乘预算 COHESION_W。
        // 若写成 ((tx2-vix)*COHESION_W) 再限幅, COHESION_W=2.0 就是"每帧把速度误差翻倍"的
        // 松弛率 >= 2, 离散积分直接越过稳定边界: 速度来回过冲 -> 鸟群被抖散(实测 R90 200->820)。
        ax += clamp(tx2 - vix, -MAX_FORCE, MAX_FORCE) * COHESION_W;
        ay += clamp(ty2 - viy, -MAX_FORCE, MAX_FORCE) * COHESION_W;
      }
      const un = Math.sqrt(uxn * uxn + uyn * uyn);
      if (un > 1e-9) {                                          // 对齐力(独立的转向预算)
        const tx2 = uxn / un * MAX_SPEED, ty2 = uyn / un * MAX_SPEED;
        ax += clamp(tx2 - vix, -MAX_FORCE, MAX_FORCE) * ALIGNMENT_W;
        ay += clamp(ty2 - viy, -MAX_FORCE, MAX_FORCE) * ALIGNMENT_W;
      }
      ax += clamp(sepx * SEP_GAIN, -2 * MAX_FORCE, 2 * MAX_FORCE);   // 分离力(允许更大预算)
      ay += clamp(sepy * SEP_GAIN, -2 * MAX_FORCE, 2 * MAX_FORCE);
${contagion}    }
${alertState}`;
if (!P.OLD && !ADD) code = code.slice(0, i1) + NEW_BLOCK + code.slice(i2);

/* ---- 2b. ADD 模式: 旧受力式原样保留, 只叠加"独立对齐力"与"惊飞波传染" ----
 * 这样 COHESION_W/ALIGNMENT_W/MAX_FORCE/PERCEPTION/SEP_R2 的语义与数值都不动
 * (headless 里那条"第 7 轮参数已收紧"的断言仍然成立), 新增的是新常量。 */
if (ADD) {
  const T1 = "    let ax = 0, ay = 0;\n    if (kn > 0) {";
  if (code.indexOf(T1) !== i1) throw new Error("ADD: 锚点漂移");
  const RELAYDECL = CONT ? "    let relay = 0;   // W2: 邻居\"急转\"的带符号和(惊飞波方向)\n" : "";
  code = code.slice(0, i1) + "    let ax = 0, ay = 0;\n" + RELAYDECL + "    if (kn > 0) {" + code.slice(i1 + T1.length);
  const OLD_TAIL = `      ax += clamp(sepx * SEP_GAIN, -2 * MAX_FORCE, 2 * MAX_FORCE);
      ay += clamp(sepy * SEP_GAIN, -2 * MAX_FORCE, 2 * MAX_FORCE);
    }`;
  const i6 = code.indexOf(OLD_TAIL);
  if (i6 < 0) throw new Error("ADD: 找不到旧受力式的尾锚点");
  const EXTRA = `      ax += clamp(sepx * SEP_GAIN, -2 * MAX_FORCE, 2 * MAX_FORCE);
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
${CONT ? `        for (let m = 0; m < kn; m++) {                    // 惊飞波: 邻居"急转"的带符号和
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
        }` : ""}
      }
    }
${CONT ? `    /* 传染状态机: a>0 警报中(急转接力窗口); a<0 不应期; a=-REFRACT 待命。 */
    { const a0 = W2_ALERT[i];
      if (a0 > 0) W2_ALERT[i] = a0 - 1;
      else if (a0 <= -REFRACT && Math.abs(relay) > RELAY_MIN) W2_ALERT[i] = ALERT_FRAMES;
      else if (a0 > -REFRACT) W2_ALERT[i] = a0 - 1; }
` : ""}`;
  code = code.slice(0, i6) + EXTRA + code.slice(i6 + OLD_TAIL.length);
}

/* ---- 3a. 速率归一力(可选) ---- */
if (P.SPEED_K) {
  const S1 = "    let vx = V[vi] + ax, vy = V[vi+1] + ay;\n    const sp = Math.sqrt(vx * vx + vy * vy);";
  const i3 = code.indexOf(S1);
  if (i3 < 0) throw new Error("注入失败: 找不到积分段锚点(速率归一)");
  const ADD = `    let vx = V[vi] + ax, vy = V[vi+1] + ay;
    {   // W2 速率归一: 真实椋鸟几乎恒速飞行(个体速度差异会让群里"有的快有的慢")
      const s0 = Math.sqrt(vx * vx + vy * vy);
      if (s0 > 1e-6) { const k = (MAX_SPEED - s0) * SPEED_K; vx += vx / s0 * k; vy += vy / s0 * k; }
    }
    const sp = Math.sqrt(vx * vx + vy * vy);`;
  code = code.slice(0, i3) + ADD + code.slice(i3 + S1.length);
}

/* ---- 3b. 惊飞波: (i) 状态数组 (ii) 记带符号转向 (iii) 波源 = 视野内有猛禽 ---- */
if (CONT) {  // (i) 状态数组声明
  const D1 = "let migAng = Math.random() * TAU;";
  const i4 = code.indexOf(D1);
  if (i4 < 0) throw new Error("注入失败: 找不到 migAng 锚点(状态数组声明)");
  const j4 = code.indexOf("\n", i4);
  const DECL = `
/* ---- W2 惊飞波状态(定型数组, 零分配) ----
 * W2_ALERT: >0 = 正在急转(警报剩余帧), <0 = 不应期, = -REFRACT = 待命;
 * W2_TURN : 上一帧的带符号转向(弧度/帧), 给接力提供方向;
 * W2_PV   : 上一帧末的速度副本 —— 自己记一份而不是用现成的 PV, 因为
 *           SIM.setStarlingVel() 注入惊飞时会同时写 V 和 PV(相当于"抹掉"这一次突变),
 *           用 PV 就看不见注入的急转, 波源也就点不着。 */
const W2_ALERT = new Float32Array(MAXN).fill(-REFRACT);
const W2_TURN  = new Float32Array(MAXN);
const W2_PV    = new Float32Array(MAXN * 2);`;
  code = code.slice(0, j4 + 1) + DECL + "\n" + code.slice(j4 + 1);
  // (ii) 积分段: 在 PV 写回之前记录本帧带符号转向(慢速鸟的航向是噪声 -> 记 0, 不给波方向)
  const T2 = "    PV[vi] = vx; PV[vi+1] = vy;";
  const i5 = code.indexOf(T2);
  if (i5 < 0) throw new Error("注入失败: 找不到 PV 写回锚点");
  const TURNCODE = `    {   // W2 惊飞波: 记下本帧"带符号"的转向 —— 波沿群体传播靠的是照抄邻居的转向,
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
`;
  code = code.slice(0, i5) + TURNCODE + code.slice(i5);
  // (iii) 波源: 视野内有猛禽(逃逸受力分支) -> 直接拉响警报。
  //       为什么不看"一帧转过多少度": 实测巡航期慢速鸟的航向抖动能到 13~35°/帧, 阈值定不准。
  const F1 = `      if (dp2 < FLEE_R2 && dp2 > 0) {
        const dp = Math.sqrt(dp2);`;
  const i7 = code.indexOf(F1);
  if (i7 < 0) throw new Error("注入失败: 找不到逃逸受力锚点(波源)");
  code = code.slice(0, i7) + F1 + `
        W2_ALERT[i] = ALERT_FRAMES;                  // W2 惊飞波源: 视野里有猛禽 = 拉响警报` + code.slice(i7 + F1.length);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, code, "utf8");
console.log(`已写出 ${outPath}  (参数 ${JSON.stringify(P)}, 基准 ${path.basename(basePath)})`);
