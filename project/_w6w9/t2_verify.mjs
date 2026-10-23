/* W7 变更存活自检: 逐个 key 检查(避免 pwsh 引号地狱) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const t = fs.readFileSync(path.join(here, "..", "掠食竞赛(4).html"), "utf8");
const keys = ["GH_BANDIT_STATES", "GH_BANDIT_ON", "GH_BANDIT_TEMP", "GH_STARLING_CAP",
  "bandit: { n: new Float64Array", "function ghunterBanditState", "function ghunterBanditProbs",
  "function ghunterBanditWeight", "function ghunterBanditBegin", "function ghunterBanditPick",
  "function ghunterBanditSettle", "const wGoose = GH_BANDIT_ON", "const arm = GH_BANDIT_ON ? ghunterBanditPick",
  "ghunterBanditSettle(g, GH_BANDIT_R_MISS)", "ghunterBanditSettle(g, GH_BANDIT_R_GOOSE)",
  "ghunterBanditSettle(g, GH_BANDIT_R_STARLING)", "ghunterBanditSettle(g, GH_BANDIT_R_ABANDON)",
  "function renderBandit", 'id="bcv"', "get ghunterBandit", "setBandit:", "get banditOn",
  "ghunterBanditEpisodes", "ghunterBanditAbandons", "ghunterBanditReward", "banditArmRateText",
  "renderBandit();", "bcv.getContext"];
let miss = 0;
for (const k of keys) { const ok = t.includes(k); if (!ok) miss++; console.log((ok ? "OK  " : "MISS") + " " + k); }
console.log(`\n${keys.length - miss}/${keys.length} 命中; 文件 ${t.split("\n").length} 行`);
process.exit(miss ? 1 : 0);
