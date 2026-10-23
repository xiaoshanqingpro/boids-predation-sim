/* 各捕食者得分效率对比: 分/分钟、每次出击得分、捕获构成 */
import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[3] || "掠食竞赛.html", "utf8");
const cut = html.indexOf('<script type="text/plain"');
const code = [...(cut > 0 ? html.slice(0, cut) : html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");
const grad = { addColorStop() {} };
const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : () => {})), set: (t, p, v) => (t[p] = v, true) });
const els = new Map();
const mk = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "", children: [], addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} }, getContext: () => ctx, appendChild(c) { if (c && c.id) els.set(c.id, c); return c; }, removeChild(c) { return c; }, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
const d = { getElementById: id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); }, addEventListener() {}, createElement: () => mk("c" + Math.random()) };
const sb = { document: d, window: { addEventListener() {}, removeEventListener() {}, location: { search: "" } }, location: { search: "" }, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
vm.createContext(sb); vm.runInContext(code, sb, { filename: "sim.js" });
const SIM = sb.window.SIM;
SIM.setGeometry(false); SIM.setN(2000); SIM.setGravity(true); SIM.setRefill(false);
SIM.addGhunter && SIM.addGhunter();                       // 把四种捕食者都放进来
const FR = Number(process.argv[2] || 12000);
const start = {}, dash0 = {}, attack0 = {};
const snap = () => { const o = {}; for (let k = 0; k < SIM.raptorCount.total; k++) { const h = SIM.hunterDetail(k) || SIM.hunter(k); o[k] = { kind: h.kind, label: h.label, score: h.score, kills: h.kills, dashEats: h.dashEats || 0, attacks: h.attacks || 0, locked: SIM.stats.lockedDashes, miss: SIM.stats.missFalcon, hits: (h.hitGoose || 0) + (h.hitStarling || 0) }; } return o; };
const A = snap();
for (let i = 0; i < FR; i++) SIM.step();
const B = snap();
const mins = FR / 60 / 60;
console.log(`模拟 ${FR} 帧 = ${(FR / 60).toFixed(0)} 秒 = ${mins.toFixed(2)} 分钟  (N=2000, refill off, 含雁隼)`);
console.log("捕食者            得分   捕获  分/分钟  捕获/分钟  每次出击得分  说明");
for (const k of Object.keys(B)) {
  const a = A[k], b = B[k];
  const dScore = b.score - a.score, dKill = b.kills - a.kills;
  const isGh = b.kind === "ghunter";
  const attacks = isGh ? (SIM.stats.ghunterAttacks || 0) : (dKill > 0 ? dKill : 0);   // 雁隼用攻击计数, 其余用捕获近似
  console.log(`${(b.label || b.kind).padEnd(18)} ${String(b.score).padStart(5)} ${String(b.kills).padStart(5)}  ${(dScore / mins).toFixed(1).padStart(7)}  ${(dKill / mins).toFixed(1).padStart(8)}  ${(attacks ? (dScore / attacks).toFixed(2) : "-").padStart(11)}  ${isGh ? "雁隼(单次攻击+" + (SIM.stats.ghunterCooldown || 0) + "帧冷却)" : ""}`);
}
console.log("雁隼统计:", JSON.stringify({ attacks: SIM.stats.ghunterAttacks, hits: SIM.stats.ghunterHits, goose: SIM.stats.ghunterGoose, starling: SIM.stats.ghunterStarling, miss: SIM.stats.ghunterMiss, cooldownContacts: SIM.stats.ghunterCooldownContacts }));
console.log("鹰食谱:", JSON.stringify(SIM.diet), " 雁隼食谱:", JSON.stringify(SIM.dietByKind && SIM.dietByKind.ghunter));
console.log(`全局: 冲刺 ${SIM.stats.lockedDashes} 次, 空冲刺 ${SIM.stats.missFalcon}, 总捕获 ${SIM.stats.kills}`);
