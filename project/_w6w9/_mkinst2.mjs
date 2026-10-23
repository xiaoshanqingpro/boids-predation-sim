import fs from "node:fs";
let src = fs.readFileSync("_w6w9/dbg3.html", "utf8");
const n1 = "function chainRelockPick(f, r2) {";
const inst = `
function __crpProbe(f, r2) {
  const sp = Math.hypot(f.vx, f.vy);
  let nIn = 0, nCone = 0, nAlive = 0;
  for (let j = 0; j < N; j++) {
    if (!alive[j]) continue;
    nAlive++;
    const ex = minImageX(P[2*j] - f.x), ey = minImageY(P[2*j+1] - f.y);
    const d2 = ex*ex + ey*ey;
    if (d2 > r2 || d2 <= 1e-9) continue;
    nIn++;
    if (sp > 1e-9 && (ex*f.vx + ey*f.vy)/(Math.sqrt(d2)*sp) >= F_CHAIN_COS) nCone++;
  }
  // 网格路径计数
  let gIn = 0, gCone = 0, gCells = 0;
  const cellR = Math.sqrt(r2) + CELL*0.75, cellR2 = cellR*cellR;
  for (let oi = 0; oi < cellOrderN; oi++) {
    const c = cellOrder[oi];
    const cx = c % GW, cy = (c / GW) | 0;
    const bx = -PAD + (cx + 0.5)*CELL, by = -PAD + (cy + 0.5)*CELL;
    const dxc = minImageX(bx - f.x), dyc = minImageY(by - f.y);
    if (dxc*dxc + dyc*dyc > cellR2) continue;
    gCells++;
    for (let j = gridHead[c]; j !== -1; j = gridNext[j]) {
      if (!alive[j]) continue;
      const ex = minImageX(P[2*j] - f.x), ey = minImageY(P[2*j+1] - f.y);
      const d2 = ex*ex + ey*ey;
      if (d2 > r2 || d2 <= 1e-9) continue;
      gIn++;
      if (sp > 1e-9 && (ex*f.vx + ey*f.vy)/(Math.sqrt(d2)*sp) >= F_CHAIN_COS) gCone++;
    }
  }
  return { sp, r2, nAlive, nIn, nCone, gCells, gIn, gCone, N, CELL, GW, GH, PAD, aliveCount, cellOrderN, gridHeadLen: gridHead.length };
}
`;
src = src.replace(n1, inst + n1);
src = src.replace("        globalThis.__CRPCALL = (globalThis.__CRPCALL|0) + 1; globalThis.__CRPVAL = cand;",
  "        globalThis.__CRPCALL = (globalThis.__CRPCALL|0) + 1; globalThis.__CRPVAL = cand; globalThis.__CRPPROBE = __crpProbe(f, PV_.chainR2);");
fs.writeFileSync("_w6w9/dbg4.html", src);
console.log("ok", src.length);
