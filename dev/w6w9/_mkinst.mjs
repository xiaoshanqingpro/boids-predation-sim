import fs from "node:fs";
const src = fs.readFileSync("_w6w9/sandbox_T1.html", "utf8");
const n1 = "function chainRelockPick(f, r2) {";
const n2 = "        const cand = chainRelockPick(f, PV_.chainR2);";
const n3 = "  return best;\n}\n\n// tryDash: 发起冲刺。带";
if (src.split(n1).length - 1 !== 1) throw new Error("n1");
if (src.split(n2).length - 1 !== 1) throw new Error("n2");
if (src.split(n3).length - 1 !== 1) throw new Error("n3");
let out = src
  .replace(n1, n1 + "\n  globalThis.__CRP = (globalThis.__CRP|0) + 1;")
  .replace(n2, n2 + "\n        globalThis.__CRPCALL = (globalThis.__CRPCALL|0) + 1; globalThis.__CRPVAL = cand;")
  .replace(n3, "  globalThis.__CRPLAST = best;\n  return best;\n}\n\n// tryDash: 发起冲刺。带");
fs.writeFileSync("_w6w9/dbg3.html", out);
console.log("ok", out.length);
