/* Lead: 补 SIM 钩子(供 verifier 做惊飞传播测量与 ghunter 冷却取证) + 锁协议
 * 锚点: SIM 对象里的 setTrail3 之前插入。 */
import fs from "node:fs";
const P = "掠食竞赛.html";
const LOCK = "_wip/main.lock";
const NL = "\n";
// 抢锁
let locked = false;
for (let i = 0; i < 40; i++) {
  try { fs.writeFileSync(LOCK, String(Date.now()), { flag: "wx" }); locked = true; break; }
  catch (e) {
    try { const st = fs.statSync(LOCK); if (Date.now() - st.mtimeMs > 10 * 60 * 1000) { fs.unlinkSync(LOCK); continue; } } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
}
if (!locked) { console.log("✗ 抢不到 _wip/main.lock, 放弃本次编辑"); process.exit(1); }
try {
  let t = fs.readFileSync(P, "utf8");
  const anchor = '  setTrail3: (v, len, w, alpha) => {';
  const add = [
    '  // 【第 8 轮之六】验收用只读/只写单点的钩子:' + NL,
    '  //   verifier 要做"惊飞波接力传播"的严格测量, 需要能查"谁在第几帧被惊飞"与单点扰动;' + NL,
    '  //   ghunter 冷却取证需要猛禽的冷却字段。' + NL,
    '  startledList: () => { const out = []; for (let i = 0; i < N; i++) if (alive[i] && startled[i]) out.push(i); return out; },' + NL,
    '  startledFlags: () => { const a = new Uint8Array(N); for (let i = 0; i < N; i++) a[i] = alive[i] ? startled[i] : 0; return a; },' + NL,
    '  setStarlingVel: (i, vx, vy) => { if (i < 0 || i >= N || !alive[i]) return 0; V[2 * i] = vx; V[2 * i + 1] = vy; PV[2 * i] = vx; PV[2 * i + 1] = vy; return 1; },' + NL,
    '  starlingNear: (x, y, r) => { const rr = r * r, out = []; for (let i = 0; i < N; i++) { if (!alive[i]) continue; const dx = P[2 * i] - x, dy = P[2 * i + 1] - y; if (dx * dx + dy * dy <= rr) out.push(i); } return out; },' + NL,
    '  hunterDetail: (k) => { const h = raptors[k]; if (!h) return null; return { kind: h.kind, label: h.label, x: h.x, y: h.y, z: h.z,' + NL,
    '    vx: h.vx, vy: h.vy, vz: h.vz || 0, energy: h.energy, dashT: h.dashT, cool: h.cool || 0, circleT: h.circleT,' + NL,
    '    stun: h.stun, mob: h.mob, lockIdx: h.lockIdx, stoopT: h.stoopT || 0, score: h.score, kills: h.kills,' + NL,
    '    gcool: h.gcool || 0, attacks: h.attacks || 0 }; },' + NL,
  ].join("");
  if (!t.includes(anchor)) throw new Error("锚点未命中: " + anchor);
  t = t.replace(anchor, add + anchor);
  // hunter(i) 里补 cool/attacks(如果还没有)
  const hAnchor = '  hunter: (k) => { const h = raptors[k]; if (!h) return null; return {';
  if (t.includes(hAnchor)) {
    console.log("  提示: hunter() 已是对象形式, 检查是否需要补 cool/attacks(见下方 detail)");
  }
  fs.writeFileSync(P, t);
  console.log("✓ 钩子已加: startledList/startledFlags/setStarlingVel/starlingNear/hunterDetail");
} finally {
  try { fs.unlinkSync(LOCK); } catch {}
}
