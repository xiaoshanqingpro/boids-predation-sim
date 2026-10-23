
"use strict";
/* ============================================================================
 * WebGL 渲染后端(任务 2) —— 全部 GL 代码集中在本 <script> 区块, 零依赖
 * ----------------------------------------------------------------------------
 * 分工: 本区块只画"数量随 N 增长"的东西 —— 椋鸟 / 雁(实例化) + 拖尾残影;
 *       猛禽/标签/能量条/死亡涟漪/小地图/视野圈/配合轴线/威慑锥这些数量 <= 10 的
 *       实体仍由主区块的 2D 叠加层绘制(Canvas2D 完全够用, 不值得进 WebGL)。
 *
 * 每帧管线(api.draw):
 *   ① 残影淡出: 把上一帧纹理 prev 用 fade 片元着色器画进当前 fboCur
 *        outColor.rgb = prev.rgb * (1 - FADE) + BG * FADE     (FADE = 0.16)
 *      与旧版每帧 ctx.fillRect(0,0,W,H) + rgba(10,12,18,0.16) 数学等价。
 *   ② 两批实例化: 同一个单位 ">" 几何(两个三角形 = 6 顶点), 两次 drawArraysInstanced
 *        椋鸟 instanceCount = aliveCount, 颜色 rgb(200,215,235), 形状 (2.2,1.4,1.4)
 *        雁   instanceCount = galiveCount, 颜色 rgb(255,200,110), 形状 (3.2,1.8,2.0)
 *      实例属性 = (x, y, angle) 三个 float, 每帧 bufferSubData 只传活着的那些;
 *      旋转(uShape 缩放 + cos/sin)与投影(y 翻转)全在顶点着色器里, CPU 只算 angle。
 *      顶点(单位空间): 鼻尖(+1, 0), 左右翼各 (+/-1 侧)两个顶点, 翼端厚 ±0.28,
 *      向鼻尖收成尖 —— 视觉上等价于原来 drawArrow 描出来的 ">"。
 *   ③ 拷到默认帧缓冲(叠加层 canvas 覆盖在它上面)。
 *   ④ prev / cur 两张纹理 ping-pong 交换; preserveDrawingBuffer = false。
 * ========================================================================== */
(function () {
  let gl = null, isGL2 = false, canvas = null, scene = null, angleExt = null;
  let progFade = null, progBird = null;
  let quadVBO = null, birdVBO = null, instVBO = null;
  let texA = null, texB = null, fboA = null, fboB = null, curIsA = true;
  let starBuf = null, gooseBuf = null, maxN = 0, maxM = 0;
  // 第 8 轮: 3D 管线(透视 + 深度 + 雾; 仅 WebGL2)
  let prog3 = null, instVBO3 = null, star3Buf = null, goose3Buf = null;
  let progTrail3 = null, trailVBO = null, A4 = { unit: -1, pos: -1, vel: -1 }, U4 = {};
  let tex3 = null, fbo3 = null, depth3 = null, has3DFlag = false;
  const U3 = {}, A3 = {};
  const U = {}, A = {};

  /* ---- 着色器源码(GL2 用 #version 300 es + in/out, GL1 用 attribute/varying) ---- */
  const VS_BIRD = `#version 300 es
  in vec2 aUnit;                 // 单位 ">" 的 6 个顶点
  in vec3 aInst;                 // 实例属性: (x, y, angle)
  uniform vec2 uRes;             // 视口尺寸(世界坐标 1:1 像素)
  uniform vec2 uPan;             // 【修正⑧b】相机平移(世界与视口解耦后,俯视必须跟着鸟群跑)
  uniform vec3 uShape;           // (尖端长, 尾长, 翼展) —— 与 drawArrow 参数一致
  void main() {
    // 单位形状 -> 按形状参数放大: aUnit.x > 0 是鼻尖(前伸 uShape.x), 否则尾部(-uShape.y)
    vec2 p = vec2(aUnit.x > 0.0 ? uShape.x : -uShape.y, aUnit.y * uShape.z);
    float ca = cos(aInst.z), sa = sin(aInst.z);          // 旋转在这里做
    vec2 w = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca) + aInst.xy;
    // 世界坐标(原点左上) -> 裁剪空间: y 翻转用投影矩阵式的一行, 不逐顶点翻
    gl_Position = vec4((w.x - uPan.x) / uRes.x * 2.0 - 1.0, 1.0 - (w.y - uPan.y) / uRes.y * 2.0, 0.0, 1.0);
  }`;
  const FS_BIRD = `#version 300 es
  precision mediump float;
  uniform vec3 uColor;
  out vec4 outColor;
  void main() { outColor = vec4(uColor, 1.0); }`;
  const VS_BIRD1 = `
  attribute vec2 aUnit; attribute vec3 aInst;
  uniform vec2 uRes; uniform vec2 uPan; uniform vec3 uShape;
  void main() {
    vec2 p = vec2(aUnit.x > 0.0 ? uShape.x : -uShape.y, aUnit.y * uShape.z);
    float ca = cos(aInst.z), sa = sin(aInst.z);
    vec2 w = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca) + aInst.xy;
    gl_Position = vec4((w.x - uPan.x) / uRes.x * 2.0 - 1.0, 1.0 - (w.y - uPan.y) / uRes.y * 2.0, 0.0, 1.0);
  }`;
  const FS_BIRD1 = `
  precision mediump float; uniform vec3 uColor;
  void main() { gl_FragColor = vec4(uColor, 1.0); }`;

  const VS_QUAD = `#version 300 es
  in vec2 aPos; out vec2 vUV;
  void main() { vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const FS_QUAD = `#version 300 es
  precision mediump float;
  in vec2 vUV;
  uniform sampler2D uTex; uniform vec3 uBg; uniform float uFade; uniform float uCopy;
  out vec4 outColor;
  void main() {
    vec4 c = texture(uTex, vUV);
    // uCopy = 1 -> 原样拷贝(blit); 0 -> 衰减: c*(1-FADE) + BG*FADE
    outColor = vec4(mix(c.rgb * (1.0 - uFade) + uBg * uFade, c.rgb, uCopy), 1.0);
  }`;
  const VS_QUAD1 = `
  attribute vec2 aPos; varying vec2 vUV;
  void main() { vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const FS_QUAD1 = `
  precision mediump float;
  varying vec2 vUV;
  uniform sampler2D uTex; uniform vec3 uBg; uniform float uFade; uniform float uCopy;
  void main() {
    vec4 c = texture2D(uTex, vUV);
    gl_FragColor = vec4(mix(c.rgb * (1.0 - uFade) + uBg * uFade, c.rgb, uCopy), 1.0);
  }`;

  /* ---- 第 8 轮: 3D 着色器(实例属性 = 位置 xyz + 速度 xyz, 速度建正交基定向) ---- */
  const VS_BIRD3 = `#version 300 es
  in vec2 aUnit;                 // 单位 ">" 的 6 个顶点(与 2D 共用)
  in vec3 aPos;                  // 实例: 位置
  in vec3 aVel;                  // 实例: 速度(决定朝向)
  uniform mat4 uVP;
  uniform vec3 uShape;
  uniform vec2 uAlt;             // (最低高, 最高高): 把高度映射成亮度
  uniform float uSize3D;         // 三维体积倍数: 2D 的尺寸是屏幕像素尺度, 直接拿进透视会小到看不见
  uniform float uMinPx;          // 远处不再变小的阈值(避免远鸟只有零点几像素)
  uniform float uPxScale;        // 视口高 / (2*tan(fov/2)): 距离 1 处每世界单位对应多少像素
  out float vFog;
  out float vAlt;
  void main() {
    vec3 fwd = normalize(aVel + vec3(1e-4, 0.0, 0.0));
    vec3 hint = abs(fwd.z) > 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
    vec3 rgt = normalize(cross(fwd, hint));
    vec3 up2 = cross(rgt, fwd);
    vec4 c0 = uVP * vec4(aPos, 1.0);
    float k = uSize3D * max(1.0, uMinPx * max(c0.w, 1.0) / max(1e-3, uShape.x * uPxScale));
    vec3 p = aPos + fwd * ((aUnit.x > 0.0 ? uShape.x : -uShape.y) * k)
                  + up2 * (aUnit.y * uShape.z * k);
    gl_Position = uVP * vec4(p, 1.0);
    vFog = clamp(1.45 - c0.w * 0.00105, 0.30, 1.0);   // 雾(下限抬高: 远处也看得见)
    vAlt = clamp((aPos.z - uAlt.x) / max(1.0, uAlt.y - uAlt.x), 0.0, 1.0);
  }`;
  const FS_BIRD3 = `#version 300 es
  precision mediump float;
  in float vFog;
  in float vAlt;
  uniform vec3 uColor;
  uniform vec3 uBg;
  out vec4 outColor;
  void main() {
    // 高度直接映射成明暗: 越高越亮 —— 俯视看不出的 Z 变化在三维里一眼可见
    outColor = vec4(mix(uBg, uColor * (0.70 + 0.65 * vAlt), vFog), 1.0);
  }`;
  /* ---- 第 8 轮之三: 鸟的拖尾(速度拖尾条) ----
   * 每个实例画一条从当前位置沿速度反方向伸出的细带, 长度 ∝ 速度, 头部亮、尾部渐隐到 0。
   * 用速度而不是位置历史: 省掉每只鸟的历史缓冲, 相机转动时也不会像屏幕残影那样糊片。 */
  const VS_TRAIL3 = `#version 300 es
  in vec2 aUnit;                 // 单位带: x∈{0(头), -1(尾)}, y = ±1(半边)
  in vec3 aPos;
  in vec3 aVel;
  uniform mat4 uVP;
  uniform float uLen, uWid, uSize3D, uMinPx, uPxScale;
  out float vA;
  void main() {
    vec3 fwd = normalize(aVel + vec3(1e-4, 0.0, 0.0));
    vec3 side = cross(fwd, vec3(0.0, 0.0, 1.0));
    float sl = length(side);
    side = sl > 1e-4 ? side / sl : vec3(0.0, 1.0, 0.0);
    vec4 c0 = uVP * vec4(aPos, 1.0);
    float k = uSize3D * max(1.0, uMinPx * max(c0.w, 1.0) / max(1e-3, uWid * uPxScale));
    float len = uLen * length(aVel);
    vec3 base = aPos + fwd * (aUnit.x * len);
    float hw = uWid * k * (1.0 + 0.9 * aUnit.x);       // 尾部略收窄(half 是 GLSL 保留字, 不能用)
    gl_Position = uVP * vec4(base + side * (aUnit.y * hw), 1.0);
    vA = 1.0 + aUnit.x;                                // 头 = 1, 尾 = 0
  }`;
  const FS_TRAIL3 = `#version 300 es
  precision mediump float;
  in float vA;
  uniform vec3 uColor;
  uniform float uAlpha;
  out vec4 outColor;
  void main() { outColor = vec4(uColor, vA * vA * uAlpha); }`;

  function compile(vsSrc, fsSrc) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSrc); gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.warn("顶点着色器编译失败:", gl.getShaderInfoLog(vs)); return null;
    }
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc); gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn("片元着色器编译失败:", gl.getShaderInfoLog(fs)); return null;
    }
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn("着色器程序链接失败:", gl.getProgramInfoLog(p)); return null;
    }
    return p;
  }

  function makeTex(w, h) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function makeFBO(tex) {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok ? f : null;
  }

  window.GLBackend = {
    // 初始化: 拿 WebGL2(优先) / WebGL1 + ANGLE_instanced_arrays, 建程序/缓冲/FBO
    init(s, cv, force) {
      scene = s; canvas = cv;
      if (!canvas || !canvas.getContext) return false;
      const opts = { alpha: false, antialias: false, depth: true, stencil: false,   // 第 8 轮: 3D 需要深度
                     preserveDrawingBuffer: false, powerPreference: "high-performance" };
      try { gl = canvas.getContext("webgl2", opts); } catch (e) { gl = null; }
      isGL2 = !!gl;
      if (!gl) {
        try {
          gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
        } catch (e) { gl = null; }
      }
      if (!gl) return false;
      if (!isGL2) {
        angleExt = gl.getExtension("ANGLE_instanced_arrays");
        if (!angleExt) { console.warn("缺少 ANGLE_instanced_arrays, 回退 Canvas2D"); return false; }
      }

      progBird = compile(isGL2 ? VS_BIRD : VS_BIRD1, isGL2 ? FS_BIRD : FS_BIRD1);
      progFade = compile(isGL2 ? VS_QUAD : VS_QUAD1, isGL2 ? FS_QUAD : FS_QUAD1);
      if (!progBird || !progFade) return false;

      // 单位 ">" 几何: 两个三角形共 6 顶点(鼻尖 + 左右翼), 静态上传一次
      const UNIT = new Float32Array([
        1, 0, -1, 0.72, -1, 1.28,       // 左臂: 鼻尖 -> 左翼外缘 -> 左翼内缘
        1, 0, -1, -1.28, -1, -0.72,     // 右臂: 鼻尖 -> 右翼外缘 -> 右翼内缘
      ]);
      birdVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, birdVBO);
      gl.bufferData(gl.ARRAY_BUFFER, UNIT, gl.STATIC_DRAW);

      // 全屏四边形(两个三角形), 残影淡出与最终拷贝共用
      quadVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.bufferData(gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

      maxN = s.maxN || 20000; maxM = s.maxM || 60;
      starBuf = new Float32Array(maxN * 3);
      gooseBuf = new Float32Array(maxM * 3);
      instVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, instVBO);
      gl.bufferData(gl.ARRAY_BUFFER, starBuf.byteLength, gl.DYNAMIC_DRAW);   // 按最大 N 预留

      texA = makeTex(s.W, s.H); texB = makeTex(s.W, s.H);
      fboA = makeFBO(texA); fboB = makeFBO(texB);
      if (!fboA || !fboB) { console.warn("离屏帧缓冲不完整, 回退 Canvas2D"); return false; }

      // 两张纹理都清成背景色, 否则第一帧的残影是黑的
      for (let k = 0; k < 2; k++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, k ? fboB : fboA);
        gl.viewport(0, 0, s.W, s.H);
        gl.clearColor(s.bg[0], s.bg[1], s.bg[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      /* ---- 拖尾: 同一实例缓冲(位置+速度), 单位带几何, 开混合、关深度写入 ---- */
      const tr = s.trail3;
      if (tr && tr.on && progTrail3 && A4.unit >= 0) {
        gl.useProgram(progTrail3);
        gl.uniformMatrix4fv(U4.vp, false, vpM);
        gl.uniform1f(U4.len, tr.len);
        gl.uniform1f(U4.wid, tr.w);
        gl.uniform1f(U4.alpha, tr.alpha);
        gl.uniform1f(U4.size3d, s.size3dMul);
        gl.uniform1f(U4.minpx, s.size3dMinPx);
        gl.uniform1f(U4.pxscale, uPxScale);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.bindBuffer(gl.ARRAY_BUFFER, trailVBO);
        gl.enableVertexAttribArray(A4.unit);
        gl.vertexAttribPointer(A4.unit, 2, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(A4.unit, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, instVBO3);
        gl.enableVertexAttribArray(A4.pos);
        gl.vertexAttribPointer(A4.pos, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribDivisor(A4.pos, 1);
        gl.enableVertexAttribArray(A4.vel);
        gl.vertexAttribPointer(A4.vel, 3, gl.FLOAT, false, 24, 12);
        gl.vertexAttribDivisor(A4.vel, 1);
        if (n > 0) {
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, star3Buf.subarray(0, n * 6));
          gl.uniform3f(U4.color, s.colors.starling[0], s.colors.starling[1], s.colors.starling[2]);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
        }
        if (m > 0) {
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, goose3Buf.subarray(0, m * 6));
          gl.uniform3f(U4.color, s.colors.goose[0], s.colors.goose[1], s.colors.goose[2]);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, m);
        }
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.disableVertexAttribArray(A4.pos);
        gl.disableVertexAttribArray(A4.vel);
      }
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);                       // 鸟是不透明色块

      // ---- 第 8 轮: 3D 资产(3D 失败不影响 2D 路径) ----
      has3DFlag = false;
      if (isGL2) {
        prog3 = compile(VS_BIRD3, FS_BIRD3);
    progTrail3 = compile(VS_TRAIL3, FS_TRAIL3);
    if (progTrail3) {
      U4.vp = gl.getUniformLocation(progTrail3, "uVP");
      U4.len = gl.getUniformLocation(progTrail3, "uLen");
      U4.wid = gl.getUniformLocation(progTrail3, "uWid");
      U4.color = gl.getUniformLocation(progTrail3, "uColor");
      U4.alpha = gl.getUniformLocation(progTrail3, "uAlpha");
      U4.size3d = gl.getUniformLocation(progTrail3, "uSize3D");
      U4.minpx = gl.getUniformLocation(progTrail3, "uMinPx");
      U4.pxscale = gl.getUniformLocation(progTrail3, "uPxScale");
      A4.unit = gl.getAttribLocation(progTrail3, "aUnit");
      A4.pos = gl.getAttribLocation(progTrail3, "aPos");
      A4.vel = gl.getAttribLocation(progTrail3, "aVel");
      trailVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, trailVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,1, 0,-1, -1,1, -1,1, 0,-1, -1,-1]), gl.STATIC_DRAW);
    }
        if (prog3) {
          star3Buf = new Float32Array(maxN * 6);
          goose3Buf = new Float32Array(maxM * 6);
          instVBO3 = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, instVBO3);
          gl.bufferData(gl.ARRAY_BUFFER, star3Buf.byteLength, gl.DYNAMIC_DRAW);
          tex3 = makeTex(s.W, s.H);
          fbo3 = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo3);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex3, 0);
          depth3 = gl.createRenderbuffer();
          gl.bindRenderbuffer(gl.RENDERBUFFER, depth3);
          gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, s.W, s.H);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth3);
          has3DFlag = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          U3.vp = gl.getUniformLocation(prog3, "uVP");
          U3.shape = gl.getUniformLocation(prog3, "uShape");
          U3.color = gl.getUniformLocation(prog3, "uColor");
          U3.bg = gl.getUniformLocation(prog3, "uBg");
    U3.size3d = gl.getUniformLocation(prog3, "uSize3D");
    U3.minpx = gl.getUniformLocation(prog3, "uMinPx");
    U3.pxscale = gl.getUniformLocation(prog3, "uPxScale");
    U3.alt = gl.getUniformLocation(prog3, "uAlt");
          A3.unit = gl.getAttribLocation(prog3, "aUnit");
          A3.pos = gl.getAttribLocation(prog3, "aPos");
          A3.vel = gl.getAttribLocation(prog3, "aVel");
        }
      }

      U.res = gl.getUniformLocation(progBird, "uRes");
    U.pan = gl.getUniformLocation(progBird, "uPan");   // 【修正⑧b】
      U.shape = gl.getUniformLocation(progBird, "uShape");
      U.color = gl.getUniformLocation(progBird, "uColor");
      U.tex = gl.getUniformLocation(progFade, "uTex");
      U.bg = gl.getUniformLocation(progFade, "uBg");
      U.fade = gl.getUniformLocation(progFade, "uFade");
      U.copy = gl.getUniformLocation(progFade, "uCopy");
      A.unit = gl.getAttribLocation(progBird, "aUnit");
      A.inst = gl.getAttribLocation(progBird, "aInst");
      A.quad = gl.getAttribLocation(progFade, "aPos");
      gl.bindBuffer(gl.ARRAY_BUFFER, birdVBO);
      gl.enableVertexAttribArray(A.unit);
      gl.vertexAttribPointer(A.unit, 2, gl.FLOAT, false, 0, 0);      // 单位几何: 每实例共用
      gl.bindBuffer(gl.ARRAY_BUFFER, instVBO);
      gl.enableVertexAttribArray(A.inst);
      gl.vertexAttribPointer(A.inst, 3, gl.FLOAT, false, 0, 0);      // 实例: 每只鸟一组
      if (isGL2) gl.vertexAttribDivisor(A.inst, 1); else angleExt.vertexAttribDivisorANGLE(A.inst, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.enableVertexAttribArray(A.quad);
      gl.vertexAttribPointer(A.quad, 2, gl.FLOAT, false, 0, 0);
      return true;
    },

    has3D() { return !!has3DFlag; },          // 第 8 轮: 3D 管线可用性

    /* 第 8 轮: 3D 一帧 —— 深度清屏 -> 两批实例化(速度定向 + 雾) -> 拷到屏幕。
     * 无 ping-pong 残影: 相机转动会让屏幕空间拖尾糊成一片, 3D 模式靠拖尾缓冲与尸体表达动势。 */
    draw3D(s, vpM) {
      const c = s.counts();
      const P = s.P, V = s.V, Z = s.Z, VZ = s.VZ, alive = s.alive;
      let n = 0;
      const limN = Math.min(c.n, maxN);
      for (let i = 0; i < limN; i++) {
        if (!alive[i]) continue;
        const o = n * 6;
        star3Buf[o] = P[2*i]; star3Buf[o+1] = P[2*i+1]; star3Buf[o+2] = Z[i];
        star3Buf[o+3] = V[2*i]; star3Buf[o+4] = V[2*i+1]; star3Buf[o+5] = VZ[i];
        n++;
      }
      const gal = s.galive, P2 = s.P2, V2 = s.V2, Z2 = s.Z2, VZ2 = s.VZ2;
      let m = 0;
      for (let i = 0; i < Math.min(c.m, maxM); i++) {
        if (!gal[i]) continue;
        const o = m * 6;
        goose3Buf[o] = P2[2*i]; goose3Buf[o+1] = P2[2*i+1]; goose3Buf[o+2] = Z2[i];
        goose3Buf[o+3] = V2[2*i]; goose3Buf[o+4] = V2[2*i+1]; goose3Buf[o+5] = VZ2[i];
        m++;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo3);
      gl.viewport(0, 0, s.W, s.H);
      gl.clearColor(s.bg[0], s.bg[1], s.bg[2], 1);
      gl.clearDepth(1);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog3);
      gl.uniformMatrix4fv(U3.vp, false, vpM);
      gl.uniform3f(U3.bg, s.bg[0], s.bg[1], s.bg[2]);
      // 体积与高度可视化参数: uPxScale = 视口高/(2*tan(fov/2)); uAlt = 当前高度范围(供亮度映射)
      const uPxScale = s.H / (2 * Math.tan(s.fov / 2));
      gl.uniform1f(U3.size3d, s.size3dMul);
      gl.uniform1f(U3.minpx, s.size3dMinPx);
      gl.uniform1f(U3.pxscale, uPxScale);
      gl.uniform2f(U3.alt, s.zLow, s.zHigh);
      // 单位几何(6 顶点, 全实例共用)
      gl.bindBuffer(gl.ARRAY_BUFFER, birdVBO);
      gl.enableVertexAttribArray(A3.unit);
      gl.vertexAttribPointer(A3.unit, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(A3.unit, 0);
      // 实例: (x,y,z, vx,vy,vz), 24 字节步长
      gl.bindBuffer(gl.ARRAY_BUFFER, instVBO3);
      gl.enableVertexAttribArray(A3.pos);
      gl.vertexAttribPointer(A3.pos, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribDivisor(A3.pos, 1);
      gl.enableVertexAttribArray(A3.vel);
      gl.vertexAttribPointer(A3.vel, 3, gl.FLOAT, false, 24, 12);
      gl.vertexAttribDivisor(A3.vel, 1);
      if (n > 0) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, star3Buf.subarray(0, n * 6));
        gl.uniform3f(U3.shape, s.shapes.starling[0], s.shapes.starling[1], s.shapes.starling[2]);
        gl.uniform3f(U3.color, s.colors.starling[0], s.colors.starling[1], s.colors.starling[2]);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
      }
      if (m > 0) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, goose3Buf.subarray(0, m * 6));
        gl.uniform3f(U3.shape, s.shapes.goose[0], s.shapes.goose[1], s.shapes.goose[2]);
        gl.uniform3f(U3.color, s.colors.goose[0], s.colors.goose[1], s.colors.goose[2]);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, m);
      }
      /* ---- 拖尾: 同一实例缓冲(位置+速度), 单位带几何, 开混合、关深度写入 ---- */
      const tr = s.trail3;
      if (tr && tr.on && progTrail3 && A4.unit >= 0) {
        gl.useProgram(progTrail3);
        gl.uniformMatrix4fv(U4.vp, false, vpM);
        gl.uniform1f(U4.len, tr.len);
        gl.uniform1f(U4.wid, tr.w);
        gl.uniform1f(U4.alpha, tr.alpha);
        gl.uniform1f(U4.size3d, s.size3dMul);
        gl.uniform1f(U4.minpx, s.size3dMinPx);
        gl.uniform1f(U4.pxscale, uPxScale);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.bindBuffer(gl.ARRAY_BUFFER, trailVBO);
        gl.enableVertexAttribArray(A4.unit);
        gl.vertexAttribPointer(A4.unit, 2, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(A4.unit, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, instVBO3);
        gl.enableVertexAttribArray(A4.pos);
        gl.vertexAttribPointer(A4.pos, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribDivisor(A4.pos, 1);
        gl.enableVertexAttribArray(A4.vel);
        gl.vertexAttribPointer(A4.vel, 3, gl.FLOAT, false, 24, 12);
        gl.vertexAttribDivisor(A4.vel, 1);
        if (n > 0) {
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, star3Buf.subarray(0, n * 6));
          gl.uniform3f(U4.color, s.colors.starling[0], s.colors.starling[1], s.colors.starling[2]);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
        }
        if (m > 0) {
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, goose3Buf.subarray(0, m * 6));
          gl.uniform3f(U4.color, s.colors.goose[0], s.colors.goose[1], s.colors.goose[2]);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, m);
        }
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.disableVertexAttribArray(A4.pos);
        gl.disableVertexAttribArray(A4.vel);
      }
      gl.disable(gl.DEPTH_TEST);
      // 收掉 3D 属性, 避免与 2D 程序的槽位冲突
      gl.disableVertexAttribArray(A3.unit);
      gl.disableVertexAttribArray(A3.pos);
      gl.disableVertexAttribArray(A3.vel);
      // 拷到默认帧缓冲(2D 叠加层覆盖在上面)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(progFade);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex3);
      gl.uniform1i(U.tex, 0);
      gl.uniform1f(U.copy, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.enableVertexAttribArray(A.quad);
      gl.vertexAttribPointer(A.quad, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },

    info() {
      if (!gl) return null;
      return { gl2: isGL2, maxN, maxM, trail3: !!progTrail3, prog3: !!prog3, gl3d: !!has3DFlag,
               vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER) };
    },

    // 每帧调用: ①残影淡出 ②两批实例化鸟 ③拷到默认帧缓冲 ④ping-pong 交换
    draw(s) {
      const c = s.counts();
      const curFBO = curIsA ? fboA : fboB;
      const prevTex = curIsA ? texB : texA;

      /* ---- ① 用上一帧纹理做衰减, 写进当前 FBO ---- */
      gl.bindFramebuffer(gl.FRAMEBUFFER, curFBO);           // 渲染目标 = 当前离屏缓冲
      gl.viewport(0, 0, s.W, s.H);
      gl.useProgram(progFade);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, prevTex);              // 采样上一帧
      gl.uniform1i(U.tex, 0);
      gl.uniform3f(U.bg, s.bg[0], s.bg[1], s.bg[2]);
      gl.uniform1f(U.fade, s.fade);
      gl.uniform1f(U.copy, 0);                             // 0 = 衰减模式
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.vertexAttribPointer(A.quad, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      /* ---- ② 组装实例缓冲(只装活着的鸟, 3 float/只) ---- */
      const alive = s.alive, P = s.P, V = s.V;
      let n = 0;
      const limN = Math.min(c.n, maxN);
      for (let i = 0; i < limN; i++) {
        if (!alive[i]) continue;
        starBuf[n * 3] = P[2 * i]; starBuf[n * 3 + 1] = P[2 * i + 1];
        starBuf[n * 3 + 2] = Math.atan2(V[2 * i + 1], V[2 * i]);
        n++;
      }
      const gal = s.galive, P2 = s.P2, V2 = s.V2;
      let m = 0;
      const limM = Math.min(c.m, maxM);
      for (let i = 0; i < limM; i++) {
        if (!gal[i]) continue;
        gooseBuf[m * 3] = P2[2 * i]; gooseBuf[m * 3 + 1] = P2[2 * i + 1];
        gooseBuf[m * 3 + 2] = Math.atan2(V2[2 * i + 1], V2[2 * i]);
        m++;
      }

      /* ---- ③ 两次实例化绘制(旋转/缩放/投影都在着色器) ---- */
      gl.useProgram(progBird);
      gl.uniform2f(U.res, s.W, s.H);
    if (U.pan) gl.uniform2f(U.pan, s.panX || 0, s.panY || 0);   // 【修正⑧b】
      gl.bindBuffer(gl.ARRAY_BUFFER, birdVBO);               // 第 8 轮: 3D 帧可能改过槽位, 每帧重设
      gl.enableVertexAttribArray(A.unit);
      gl.vertexAttribPointer(A.unit, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, instVBO);
      gl.vertexAttribPointer(A.inst, 3, gl.FLOAT, false, 0, 0);
      if (n > 0) {
        if (isGL2) gl.bufferSubData(gl.ARRAY_BUFFER, 0, starBuf, 0, n * 3);
        else gl.bufferSubData(gl.ARRAY_BUFFER, 0, starBuf.subarray(0, n * 3));
        gl.uniform3f(U.shape, s.shapes.starling[0], s.shapes.starling[1], s.shapes.starling[2]);
        gl.uniform3f(U.color, s.colors.starling[0], s.colors.starling[1], s.colors.starling[2]);
        if (isGL2) gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
        else angleExt.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, n);
      }
      if (m > 0) {
        if (isGL2) gl.bufferSubData(gl.ARRAY_BUFFER, 0, gooseBuf, 0, m * 3);
        else gl.bufferSubData(gl.ARRAY_BUFFER, 0, gooseBuf.subarray(0, m * 3));
        gl.uniform3f(U.shape, s.shapes.goose[0], s.shapes.goose[1], s.shapes.goose[2]);
        gl.uniform3f(U.color, s.colors.goose[0], s.colors.goose[1], s.colors.goose[2]);
        if (isGL2) gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, m);
        else angleExt.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, m);
      }

      /* ---- ④ 拷到默认帧缓冲(2D 叠加层覆盖在它上面) ---- */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);            // 渲染目标 = 屏幕
      gl.useProgram(progFade);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, curIsA ? texA : texB); // 本帧刚画好的纹理
      gl.uniform1i(U.tex, 0);
      gl.uniform1f(U.copy, 1);                             // 1 = 原样拷贝
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.vertexAttribPointer(A.quad, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      curIsA = !curIsA;                                    // ping-pong 交换
    },
  };
})();
