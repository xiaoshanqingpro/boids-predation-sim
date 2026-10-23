/* 第 8 轮修正⑧b: GL 2D 路径也要跟着鸟群平移(与叠加层 project() 的 pan 一致) */
import fs from "node:fs";
const P = "掠食竞赛.html";
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const reps = [];
const add = (a, b) => reps.push([a, b]);

// 1) 两个 2D 顶点着色器: 加 uPan 并参与映射
add('  uniform vec2 uRes;             // 视口尺寸(世界坐标 1:1 像素)',
    '  uniform vec2 uRes;             // 视口尺寸(世界坐标 1:1 像素)' + NL +
    '  uniform vec2 uPan;             // 【修正⑧b】相机平移(世界与视口解耦后,俯视必须跟着鸟群跑)');
add('    gl_Position = vec4(w.x / uRes.x * 2.0 - 1.0, 1.0 - w.y / uRes.y * 2.0, 0.0, 1.0);',
    '    gl_Position = vec4((w.x - uPan.x) / uRes.x * 2.0 - 1.0, 1.0 - (w.y - uPan.y) / uRes.y * 2.0, 0.0, 1.0);');
add('  uniform vec2 uRes; uniform vec3 uShape;',
    '  uniform vec2 uRes; uniform vec2 uPan; uniform vec3 uShape;');
// 注意: 上面第一条 "gl_Position = vec4(w.x / uRes.x ..." 用的是 split/join(全量替换),
// 已经同时改了天空/鸟/拖尾两处 2D 着色器, 所以这里不再重复一条(否则会"未命中"而整体回滚)。

// 2) 取 uniform 位置
add('    U.res = gl.getUniformLocation(progBird, "uRes");',
    '    U.res = gl.getUniformLocation(progBird, "uRes");' + NL +
    '    U.pan = gl.getUniformLocation(progBird, "uPan");   // 【修正⑧b】');

// 3) 每帧设置(2D draw 里; 3D 走 VP 矩阵, pan 恒 0)
add('    gl.uniform2f(U.res, s.W, s.H);',
    '    gl.uniform2f(U.res, s.W, s.H);' + NL +
    '    if (U.pan) gl.uniform2f(U.pan, s.panX || 0, s.panY || 0);   // 【修正⑧b】');

// 4) glScene 暴露 pan(3D 时为 0)
add('    W: VIEW_W, H: VIEW_H, worldW: W, worldH: H, P, V, alive, P2, V2, galive, maxN: MAXN, maxM: M,',
    '    W: VIEW_W, H: VIEW_H, worldW: W, worldH: H, P, V, alive, P2, V2, galive, maxN: MAXN, maxM: M,' + NL +
    '    // 【修正⑧b】俯视(2D)时把画面平移到相机目标(鸟群质心); 三维走 VP 矩阵, 不需要' + NL +
    '    get panX() { return VIEW3D ? 0 : cam.tx - VIEW_W * 0.5; },' + NL +
    '    get panY() { return VIEW3D ? 0 : cam.ty - VIEW_H * 0.5; },');

let ok = 0;
for (const [a, b] of reps) { if (t.includes(a)) { t = t.split(a).join(b); ok++; } else console.log("✗ 未命中: " + a.split(NL)[0].slice(0, 66)); }
if (ok !== reps.length) { console.log(`只命中 ${ok}/${reps.length}, 不写回`); process.exit(1); }
fs.writeFileSync(P, t);
console.log(`修正⑧b 已应用: ${ok}/${reps.length} 处`);
