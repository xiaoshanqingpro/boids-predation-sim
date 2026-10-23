/* T5/W9: 追加 handoffDoc「变更记录(W9)」 */
import fs from "node:fs";
const P = "掠食竞赛_2D.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const A = '================================================================================\n</script>\n</body>\n</html>';
const B = '================================================================================\n' +
'\n' +
'【变更记录(W9)】T5: 2D 变体 掠食竞赛_2D.html(从 (4) 派生, 只删代码路径、不改物理语义)\n' +
'  · 派生来源: 掠食竞赛(4).html sha256 205BD9A324526FFED7950D2156D3AE466B45010CDA955203CF1A17F8168629ED (449254 B, 含 T1 链式/T1b 配合/T2 bandit/T3 驱逐鸟)\n' +
'  · 【守恒线】physicsHash 对 (4)?grav=0 与本文档: 逐位一致(见下"验收数字")。做法: 只删/只改写"在 GRAV_ON=false 下永不执行"\n' +
'    的代码, 并且**保留所有 Math.random() 调用**(spawnRaptor 里那行 r2.z = 120 + Math.random()*100 就是为此留下的 ——\n' +
'    它虽已无人读, 但在基线里同样执行, 删掉会改变随机数流) -> 2D 轨迹与基线逐位相同。\n' +
'  · 删除清单:\n' +
'    ① 三维视角层: VIEW3D / 轨道相机(perspM/lookAtM/mulM/updateCamera 的三维部分) / project() 的三维分支 /\n' +
'       renderSoft3D / toggleView / 相机输入监听(拖拽+滚轮) / ?view=top 与 T 键与"切换俯视"按钮;\n' +
'       project() 退化为"恒等 + 相机平移"(cam 只剩 tx/ty, 仍跟随鸟群质心)。\n' +
'    ② 重力与 z 轴(物理删除): GRAV_ON 常量化 false(?grav= 解析删除); 数组 Z/VZ/ZT/Z2/VZ2 与对象上的 z/vz/targetZ 字段;\n' +
'       椋鸟定高弹簧+重力+阻尼、雁分层弹簧、猛禽爬升/俯冲相与俯冲红利(DIVE_BOOST)、近地拉起(GROUND_MARGIN)、\n' +
'       三维逃逸分量、三维吃判球(EAT_3D 开关 + ez 项)、尸体抛体系统(spawnCorpse/stepCorpses/CORPSE_CAP)、\n' +
'       inCone3 的三维部分(退化为平面锥, 算术与 dz=0 时逐位相同)、tryDash 的 dz/cvz(退化为平面 ±60° 判据)。\n' +
'    ③ 三维拖尾: TRAIL3_* 常量、trailPush/trailBuf/trailColor/TRAIL_LEN、drawHunter 里的折线拖尾段。\n' +
'    ④ WebGL 3D 路径: VS/FS_BIRD3、VS/FS_TRAIL3、prog3/progTrail3 与程序/缓冲/深度帧缓冲初始化、draw3D() 方法。\n' +
'       **WebGL 2D 实例化 draw() 与 ping-pong 残影保留**; 第三个 <script> 的 WebGPU 计算后端**原样保留**。\n' +
'    ⑤ 面板: 「高度 鸟/雁」「云厚/尸体」两行、切换俯视/复位视角按钮、重力/自动环绕/三维拖尾/3D 吃判四个开关、\n' +
'       视图行里的三维/重力/相机/拖尾字段(改为纯 2D 描述)。其余(含 T2 bandit 表、T3 驱逐鸟行、W5 失速计数)全部保留。\n' +
'  · 弃用但**保留**的钩子(不删旧契约, 值退化为常量): SIM.view3D=false / setView3D / gravity=false / setGravity /\n' +
'    setSize3D / size3D / setTrail3 / trail3(on:false) / setEat3D / eat3D / setGhunterZ / stoop / zRange / corpses /\n' +
'    starling(i).z|vz / goose(i).z / hunter(i).z|vz / hunterDetail().z|vz|stoopT / ghunterInfo().z / harrierInfo.list[].z。\n' +
'    ghunterBanditHigh() 的"相对高度"上下文在平面版恒为 0(贴层飞行), UCB1 仍按"雁群是否混乱"学 —— 这是 W9 的口径变化。\n' +
'  · 验收数字(详见 _w6w9/T5_report.md): 守恒线 3 种子 × 2000 帧逐位一致; 500 帧 step+render(?render=2d, 假 2D 上下文)\n' +
'    无异常; SIM.bench(100,[2000,20000]) 可跑, N=20000 中位数 177.5ms vs round7 基线 171.5ms = 1.035 倍(≤1.2);\n' +
'    SIM.compute 钩子存在; grep 确认 ComputeBackend/neighborForces/WebGPU 均未被删。\n' +
'================================================================================\n' +
'</script>\n</body>\n</html>';
const n = t.split(A).length - 1;
console.log(`${n === 1 ? "✓" : "✗"} 锚点命中 ${n} 次`);
if (!APPLY) { process.exit(n === 1 ? 0 : 1); }
if (n !== 1) { console.log("不写回"); process.exit(1); }
fs.writeFileSync(P, t.split(A).join(B));
console.log("handoffDoc 变更记录(W9) 已写入");
