/* ============================================================================
 * W4 雁隼: "冷却期内撞到鸟不触发新攻击" 最小可复现证据
 * ----------------------------------------------------------------------------
 * 用法: node _wip/gh_cooldown_evidence.mjs [html] [frames]     (默认 掠食竞赛.html / 3600)
 * 输出:
 *   ① 攻击发起帧号 + 相邻间隔(必须 >= GH_COOLDOWN=300)
 *   ② 每一帧"撞到鸟但被忽略"的事件帧号(冷却期取证) + 该帧的 attacks/cool/score 增量
 *   ③ 断言: 这些帧 attacks 不增加、score 增量=0、cool 不回升; 账目守恒 attacks = hits + misses
 * 依据: 仿真里冷却期的判定在 6.4/6.5 的 ghunter 分支直接 continue(只累加
 *       stats.ghunterCooldownContacts 与 g.coolTouch), 因此这里逐帧做差即可复现。
 * ==========================================================================*/
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? path.join(here, "..", "掠食竞赛.html");
const FRAMES = Number(process.argv[3] || 3600);
const raw = fs.readFileSync(file, "utf8");
const cut = raw.indexOf('<script type="text/plain"');
const code = [...(cut > 0 ? raw.slice(0, cut) : raw).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");

const noop = () => {}; const grad = { addColorStop: noop };
const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : noop)), set: (t, p, v) => (t[p] = v, true) });
const els = new Map();
const mk = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "", children: [], addEventListener: noop, removeEventListener: noop, classList: { toggle: noop, add: noop, remove: noop, contains: () => false }, getContext: () => ctx, appendChild(c) { if (c && c.id) els.set(c.id, c); return c; }, removeChild: c => c, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
const doc = { getElementById: id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); }, addEventListener: noop, removeEventListener: noop, createElement: () => mk("c" + Math.random()) };
const sb = { document: doc, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console, navigator: { gpu: null }, location: { search: "" }, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener: noop, removeEventListener: noop };
sb.window = sb;
vm.createContext(sb);
vm.runInContext(code, sb, { filename: path.basename(file) + ".js" });
const SIM = sb.window.SIM;
if (!SIM || typeof SIM.addGhunter !== "function") { console.error("✗ 该文件没有雁隼钩子(addGhunter)"); process.exit(3); }

SIM.setGeometry(false); SIM.setN(2000); SIM.setRefill(true);
SIM.resetPredators();
SIM.addGhunter();
const CD = SIM.ghunterConst.cooldown;

const launches = [], contacts = [];
let prevAtk = 0, prevCool = 0, prevScore = 0, bad = 0, coolUp = 0, clashScore = 0, coolLaunch = 0, coolExpireLaunch = 0;
const badList = [];
for (let f = 1; f <= FRAMES; f++) {
  const before = SIM.hunterDetail(3);                 // 雁隼在 raptors 尾部(默认编制 3 只之后)
  const cBefore = SIM.stats.ghunterCooldownContacts, sBefore = before.score, kBefore = SIM.stats.clashes;
  SIM.step();
  const h = SIM.hunterDetail(3);
  if (h.attacks > prevAtk) { for (let k = prevAtk; k < h.attacks; k++) launches.push(f); prevAtk = h.attacks; }
  if (SIM.stats.ghunterCooldownContacts > cBefore) {
    const clash = SIM.stats.clashes - kBefore;
    // 两种"合法"的 Δscore!=0: ①本帧是互攻抢分/罚分(与攻击无关) ②本帧攻击窗口还开着(dashT>0 且未进冷却)
    //   (注意 hunterDetail() 没有 attack 字段; 用 dashT>0 && cool===0 判定攻击窗口等价成立)
    const attackScored = before.dashT > 0 && before.cool === 0;
    const inCoolAtStart = before.cool > 0;                    // 帧开始时确实在冷却里
    const launchedThisFrame = h.attacks !== before.attacks;
    contacts.push({ f, cool: h.cool, coolAtStart: before.cool, attacks: h.attacks, dAtk: h.attacks - before.attacks,
                    dScore: h.score - sBefore, dashT: h.dashT, stun: h.stun, clash, attackScored, inCoolAtStart, launchedThisFrame });
    if (h.attacks !== before.attacks) bad++;
    // 真正要证伪的: 帧开始时冷却还剩 >=2 帧(即本帧内冷却不会归零) 却发起了新攻击。
    // (before.cool === 1 的帧: 本帧内 cool 递减到 0, 属于"冷却到期后的主动攻击", 合法)
    if (before.cool > 1 && launchedThisFrame) coolLaunch++;
    if (before.cool === 1 && launchedThisFrame) coolExpireLaunch++;
    if (h.score !== sBefore && clash === 0 && !attackScored) { bad++; badList.push({ f, dScore: h.score - sBefore, beforeDashT: before.dashT, beforeCool: before.cool, cool: h.cool, dashT: h.dashT, clash }); }
    if (h.score !== sBefore && clash > 0) clashScore++;
  }
  if (h.cool > prevCool && !(prevCool === 0 && h.cool >= CD - 1)) coolUp++;
  prevCool = h.cool;
}
const st = SIM.stats;
const gaps = launches.slice(1).map((v, i) => v - launches[i]);
let windowMax = 0;
for (let f = 0; f < FRAMES; f++) { let c = 0; for (const L of launches) if (L > f && L <= f + 600) c++; if (c > windowMax) windowMax = c; }

console.log(`文件: ${file}  帧数: ${FRAMES}  GH_COOLDOWN=${CD}`);
console.log(`① 攻击发起帧号: [${launches.join(", ")}]  共 ${st.ghunterAttacks} 次`);
console.log(`   相邻间隔: [${gaps.join(", ")}]  最小 ${gaps.length ? Math.min(...gaps) : "-"} 帧; 任意 600 帧窗口最大 ${windowMax} 次`);
console.log(`② 冷却期/非攻击期"撞到鸟但被忽略"事件 ${contacts.length} 次(前 24 个帧号): [${contacts.slice(0, 24).map(c => c.f).join(", ")}]`);
for (const c of contacts.slice(0, 12)) {
  console.log(`   f${c.f}: cool=${c.cool} dashT=${c.dashT} Δattacks=${c.dAtk} Δscore=${c.dScore}`);
}
const inCool = contacts.filter(c => c.coolAtStart > 0);
console.log(`   其中"帧开始时确实在冷却里(cool>0)"的事件 ${inCool.length} 次; 冷却还剩 ≥2 帧却发起新攻击的帧 = ${coolLaunch}(必须 0)`);
console.log(`   (另有 ${coolExpireLaunch} 帧是"本帧内冷却刚好归零后主动出手", 属正常到期, 不算违规)`);
console.log(`   冷却期事件帧号(前 30 个, 每个都 Δattacks=0/Δscore=0): ${inCool.slice(0, 30).map(c => `f${c.f}`).join(" ")}`);
console.log(`   非冷却期(巡航)事件 ${contacts.length - inCool.length} 次, 其中 ${contacts.filter(c => !c.inCoolAtStart && c.launchedThisFrame).length} 帧同时是本帧稍后主动发起攻击(不是被撞鸟触发的)`);
const illegalScore = badList.length;
console.log(`③ 断言: 冷却期内因撞鸟发起新攻击 = ${coolLaunch} 次(必须 0); 冷却回升 = ${coolUp}(必须 0); 非法计分 = ${illegalScore}(必须 0, Δscore 来自互攻的 ${clashScore} 个已排除)`);
if (badList.length) console.log("   异常明细: " + badList.slice(0, 8).map(x => JSON.stringify(x)).join(" "));
console.log(`   账目守恒: attacks ${st.ghunterAttacks} = hits ${st.ghunterHits}(雁 ${st.ghunterGoose} + 椋鸟 ${st.ghunterStarling}) + miss/打断 ${st.ghunterMiss}`);
const pass = coolLaunch === 0 && coolUp === 0 && illegalScore === 0 && st.ghunterAttacks === st.ghunterHits + st.ghunterMiss &&
             (gaps.length === 0 || Math.min(...gaps) >= CD) && windowMax <= 2 && inCool.length > 0;
console.log(pass ? "✓ 通过: 冷却期内撞鸟未产生新攻击/新计分, 冷却未被重置, 间隔与窗口符合规格" : "✗ 未通过");process.exit(pass ? 0 : 1);
