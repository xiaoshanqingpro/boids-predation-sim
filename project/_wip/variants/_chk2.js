
"use strict";
/* ============================================================================
 * WebGL 娓叉煋鍚庣(浠诲姟 2) 鈥斺€?鍏ㄩ儴 GL 浠ｇ爜闆嗕腑鍦ㄦ湰 <script> 鍖哄潡, 闆朵緷璧? * ----------------------------------------------------------------------------
 * 鍒嗗伐: 鏈尯鍧楀彧鐢?鏁伴噺闅?N 澧為暱"鐨勪笢瑗?鈥斺€?妞嬮笩 / 闆?瀹炰緥鍖? + 鎷栧熬娈嬪奖;
 *       鐚涚/鏍囩/鑳介噺鏉?姝讳骸娑熸吉/灏忓湴鍥?瑙嗛噹鍦?閰嶅悎杞寸嚎/濞佹厬閿ヨ繖浜涙暟閲?<= 10 鐨? *       瀹炰綋浠嶇敱涓诲尯鍧楃殑 2D 鍙犲姞灞傜粯鍒?Canvas2D 瀹屽叏澶熺敤, 涓嶅€煎緱杩?WebGL)銆? *
 * 姣忓抚绠＄嚎(api.draw):
 *   鈶?娈嬪奖娣″嚭: 鎶婁笂涓€甯х汗鐞?prev 鐢?fade 鐗囧厓鐫€鑹插櫒鐢昏繘褰撳墠 fboCur
 *        outColor.rgb = prev.rgb * (1 - FADE) + BG * FADE     (FADE = 0.16)
 *      涓庢棫鐗堟瘡甯?ctx.fillRect(0,0,W,H) + rgba(10,12,18,0.16) 鏁板绛変环銆? *   鈶?涓ゆ壒瀹炰緥鍖? 鍚屼竴涓崟浣?">" 鍑犱綍(涓や釜涓夎褰?= 6 椤剁偣), 涓ゆ drawArraysInstanced
 *        妞嬮笩 instanceCount = aliveCount, 棰滆壊 rgb(200,215,235), 褰㈢姸 (2.2,1.4,1.4)
 *        闆?  instanceCount = galiveCount, 棰滆壊 rgb(255,200,110), 褰㈢姸 (3.2,1.8,2.0)
 *      瀹炰緥灞炴€?= (x, y, angle) 涓変釜 float, 姣忓抚 bufferSubData 鍙紶娲荤潃鐨勯偅浜?
 *      鏃嬭浆(uShape 缂╂斁 + cos/sin)涓庢姇褰?y 缈昏浆)鍏ㄥ湪椤剁偣鐫€鑹插櫒閲? CPU 鍙畻 angle銆? *      椤剁偣(鍗曚綅绌洪棿): 榧诲皷(+1, 0), 宸﹀彸缈煎悇 (+/-1 渚?涓や釜椤剁偣, 缈肩鍘?卤0.28,
 *      鍚戦蓟灏栨敹鎴愬皷 鈥斺€?瑙嗚涓婄瓑浠蜂簬鍘熸潵 drawArrow 鎻忓嚭鏉ョ殑 ">"銆? *   鈶?鎷峰埌榛樿甯х紦鍐?鍙犲姞灞?canvas 瑕嗙洊鍦ㄥ畠涓婇潰)銆? *   鈶?prev / cur 涓ゅ紶绾圭悊 ping-pong 浜ゆ崲; preserveDrawingBuffer = false銆? * ========================================================================== */
(function () {
  let gl = null, isGL2 = false, canvas = null, scene = null, angleExt = null;
  let progFade = null, progBird = null;
  let quadVBO = null, birdVBO = null, instVBO = null;
  let texA = null, texB = null, fboA = null, fboB = null, curIsA = true;
  let starBuf = null, gooseBuf = null, maxN = 0, maxM = 0;
  // 绗?8 杞? 3D 绠＄嚎(閫忚 + 娣卞害 + 闆? 浠?WebGL2)
  let prog3 = null, instVBO3 = null, star3Buf = null, goose3Buf = null;
  let progTrail3 = null, trailVBO = null, A4 = { unit: -1, pos: -1, vel: -1 }, U4 = {};
  let tex3 = null, fbo3 = null, depth3 = null, has3DFlag = false;
  const U3 = {}, A3 = {};
  const U = {}, A = {};

  /* ---- 鐫€鑹插櫒婧愮爜(GL2 鐢?#version 300 es + in/out, GL1 鐢?attribute/varying) ---- */
  const VS_BIRD = `#version 300 es
  in vec2 aUnit;                 // 鍗曚綅 ">" 鐨?6 涓《鐐?  in vec3 aInst;                 // 瀹炰緥灞炴€? (x, y, angle)
  uniform vec2 uRes;             // 瑙嗗彛灏哄(涓栫晫鍧愭爣 1:1 鍍忕礌)
  uniform vec3 uShape;           // (灏栫闀? 灏鹃暱, 缈煎睍) 鈥斺€?涓?drawArrow 鍙傛暟涓€鑷?  void main() {
    // 鍗曚綅褰㈢姸 -> 鎸夊舰鐘跺弬鏁版斁澶? aUnit.x > 0 鏄蓟灏?鍓嶄几 uShape.x), 鍚﹀垯灏鹃儴(-uShape.y)
    vec2 p = vec2(aUnit.x > 0.0 ? uShape.x : -uShape.y, aUnit.y * uShape.z);
    float ca = cos(aInst.z), sa = sin(aInst.z);          // 鏃嬭浆鍦ㄨ繖閲屽仛
    vec2 w = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca) + aInst.xy;
    // 涓栫晫鍧愭爣(鍘熺偣宸︿笂) -> 瑁佸壀绌洪棿: y 缈昏浆鐢ㄦ姇褰辩煩闃靛紡鐨勪竴琛? 涓嶉€愰《鐐圭炕
    gl_Position = vec4(w.x / uRes.x * 2.0 - 1.0, 1.0 - w.y / uRes.y * 2.0, 0.0, 1.0);
  }`;
  const FS_BIRD = `#version 300 es
  precision mediump float;
  uniform vec3 uColor;
  out vec4 outColor;
  void main() { outColor = vec4(uColor, 1.0); }`;
  const VS_BIRD1 = `
  attribute vec2 aUnit; attribute vec3 aInst;
  uniform vec2 uRes; uniform vec3 uShape;
  void main() {
    vec2 p = vec2(aUnit.x > 0.0 ? uShape.x : -uShape.y, aUnit.y * uShape.z);
    float ca = cos(aInst.z), sa = sin(aInst.z);
    vec2 w = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca) + aInst.xy;
    gl_Position = vec4(w.x / uRes.x * 2.0 - 1.0, 1.0 - w.y / uRes.y * 2.0, 0.0, 1.0);
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
    // uCopy = 1 -> 鍘熸牱鎷疯礉(blit); 0 -> 琛板噺: c*(1-FADE) + BG*FADE
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

  /* ---- 绗?8 杞? 3D 鐫€鑹插櫒(瀹炰緥灞炴€?= 浣嶇疆 xyz + 閫熷害 xyz, 閫熷害寤烘浜ゅ熀瀹氬悜) ---- */
  const VS_BIRD3 = `#version 300 es
  in vec2 aUnit;                 // 鍗曚綅 ">" 鐨?6 涓《鐐?涓?2D 鍏辩敤)
  in vec3 aPos;                  // 瀹炰緥: 浣嶇疆
  in vec3 aVel;                  // 瀹炰緥: 閫熷害(鍐冲畾鏈濆悜)
  uniform mat4 uVP;
  uniform vec3 uShape;
  uniform vec2 uAlt;             // (鏈€浣庨珮, 鏈€楂橀珮): 鎶婇珮搴︽槧灏勬垚浜害
  uniform float uSize3D;         // 涓夌淮浣撶Н鍊嶆暟: 2D 鐨勫昂瀵告槸灞忓箷鍍忕礌灏哄害, 鐩存帴鎷胯繘閫忚浼氬皬鍒扮湅涓嶈
  uniform float uMinPx;          // 杩滃涓嶅啀鍙樺皬鐨勯槇鍊?閬垮厤杩滈笩鍙湁闆剁偣鍑犲儚绱?
  uniform float uPxScale;        // 瑙嗗彛楂?/ (2*tan(fov/2)): 璺濈 1 澶勬瘡涓栫晫鍗曚綅瀵瑰簲澶氬皯鍍忕礌
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
    vFog = clamp(1.45 - c0.w * 0.00105, 0.30, 1.0);   // 闆?涓嬮檺鎶珮: 杩滃涔熺湅寰楄)
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
    // 楂樺害鐩存帴鏄犲皠鎴愭槑鏆? 瓒婇珮瓒婁寒 鈥斺€?淇鐪嬩笉鍑虹殑 Z 鍙樺寲鍦ㄤ笁缁撮噷涓€鐪煎彲瑙?    outColor = vec4(mix(uBg, uColor * (0.70 + 0.65 * vAlt), vFog), 1.0);
  }`;
  /* ---- 绗?8 杞箣涓? 楦熺殑鎷栧熬(閫熷害鎷栧熬鏉? ----
   * 姣忎釜瀹炰緥鐢讳竴鏉′粠褰撳墠浣嶇疆娌块€熷害鍙嶆柟鍚戜几鍑虹殑缁嗗甫, 闀垮害 鈭?閫熷害, 澶撮儴浜€佸熬閮ㄦ笎闅愬埌 0銆?   * 鐢ㄩ€熷害鑰屼笉鏄綅缃巻鍙? 鐪佹帀姣忓彧楦熺殑鍘嗗彶缂撳啿, 鐩告満杞姩鏃朵篃涓嶄細鍍忓睆骞曟畫褰遍偅鏍风硦鐗囥€?*/
  const VS_TRAIL3 = `#version 300 es
  in vec2 aUnit;                 // 鍗曚綅甯? x鈭坽0(澶?, -1(灏?}, y = 卤1(鍗婅竟)
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
    float hw = uWid * k * (1.0 + 0.9 * aUnit.x);       // 灏鹃儴鐣ユ敹绐?half 鏄?GLSL 淇濈暀瀛? 涓嶈兘鐢?
    gl_Position = uVP * vec4(base + side * (aUnit.y * hw), 1.0);
    vA = 1.0 + aUnit.x;                                // 澶?= 1, 灏?= 0
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
      console.warn("椤剁偣鐫€鑹插櫒缂栬瘧澶辫触:", gl.getShaderInfoLog(vs)); return null;
    }
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc); gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn("鐗囧厓鐫€鑹插櫒缂栬瘧澶辫触:", gl.getShaderInfoLog(fs)); return null;
    }
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn("鐫€鑹插櫒绋嬪簭閾炬帴澶辫触:", gl.getProgramInfoLog(p)); return null;
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
    // 鍒濆鍖? 鎷?WebGL2(浼樺厛) / WebGL1 + ANGLE_instanced_arrays, 寤虹▼搴?缂撳啿/FBO
    init(s, cv, force) {
      scene = s; canvas = cv;
      if (!canvas || !canvas.getContext) return false;
      const opts = { alpha: false, antialias: false, depth: true, stencil: false,   // 绗?8 杞? 3D 闇€瑕佹繁搴?                     preserveDrawingBuffer: false, powerPreference: "high-performance" };
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
        if (!angleExt) { console.warn("缂哄皯 ANGLE_instanced_arrays, 鍥為€€ Canvas2D"); return false; }
      }

      progBird = compile(isGL2 ? VS_BIRD : VS_BIRD1, isGL2 ? FS_BIRD : FS_BIRD1);
      progFade = compile(isGL2 ? VS_QUAD : VS_QUAD1, isGL2 ? FS_QUAD : FS_QUAD1);
      if (!progBird || !progFade) return false;

      // 鍗曚綅 ">" 鍑犱綍: 涓や釜涓夎褰㈠叡 6 椤剁偣(榧诲皷 + 宸﹀彸缈?, 闈欐€佷笂浼犱竴娆?      const UNIT = new Float32Array([
        1, 0, -1, 0.72, -1, 1.28,       // 宸﹁噦: 榧诲皷 -> 宸︾考澶栫紭 -> 宸︾考鍐呯紭
        1, 0, -1, -1.28, -1, -0.72,     // 鍙宠噦: 榧诲皷 -> 鍙崇考澶栫紭 -> 鍙崇考鍐呯紭
      ]);
      birdVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, birdVBO);
      gl.bufferData(gl.ARRAY_BUFFER, UNIT, gl.STATIC_DRAW);

      // 鍏ㄥ睆鍥涜竟褰?涓や釜涓夎褰?, 娈嬪奖娣″嚭涓庢渶缁堟嫹璐濆叡鐢?      quadVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.bufferData(gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

      maxN = s.maxN || 20000; maxM = s.maxM || 60;
      starBuf = new Float32Array(maxN * 3);
      gooseBuf = new Float32Array(maxM * 3);
      instVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, instVBO);
      gl.bufferData(gl.ARRAY_BUFFER, starBuf.byteLength, gl.DYNAMIC_DRAW);   // 鎸夋渶澶?N 棰勭暀

      texA = makeTex(s.W, s.H); texB = makeTex(s.W, s.H);
      fboA = makeFBO(texA); fboB = makeFBO(texB);
      if (!fboA || !fboB) { console.warn("绂诲睆甯х紦鍐蹭笉瀹屾暣, 鍥為€€ Canvas2D"); return false; }

      // 涓ゅ紶绾圭悊閮芥竻鎴愯儗鏅壊, 鍚﹀垯绗竴甯х殑娈嬪奖鏄粦鐨?      for (let k = 0; k < 2; k++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, k ? fboB : fboA);
        gl.viewport(0, 0, s.W, s.H);
        gl.clearColor(s.bg[0], s.bg[1], s.bg[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      /* ---- 鎷栧熬: 鍚屼竴瀹炰緥缂撳啿(浣嶇疆+閫熷害), 鍗曚綅甯﹀嚑浣? 寮€娣峰悎銆佸叧娣卞害鍐欏叆 ---- */
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
      gl.disable(gl.BLEND);                       // 楦熸槸涓嶉€忔槑鑹插潡

      // ---- 绗?8 杞? 3D 璧勪骇(3D 澶辫触涓嶅奖鍝?2D 璺緞) ----
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
      gl.vertexAttribPointer(A.unit, 2, gl.FLOAT, false, 0, 0);      // 鍗曚綅鍑犱綍: 姣忓疄渚嬪叡鐢?      gl.bindBuffer(gl.ARRAY_BUFFER, instVBO);
      gl.enableVertexAttribArray(A.inst);
      gl.vertexAttribPointer(A.inst, 3, gl.FLOAT, false, 0, 0);      // 瀹炰緥: 姣忓彧楦熶竴缁?      if (isGL2) gl.vertexAttribDivisor(A.inst, 1); else angleExt.vertexAttribDivisorANGLE(A.inst, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.enableVertexAttribArray(A.quad);
      gl.vertexAttribPointer(A.quad, 2, gl.FLOAT, false, 0, 0);
      return true;
    },

    has3D() { return !!has3DFlag; },          // 绗?8 杞? 3D 绠＄嚎鍙敤鎬?
    /* 绗?8 杞? 3D 涓€甯?鈥斺€?娣卞害娓呭睆 -> 涓ゆ壒瀹炰緥鍖?閫熷害瀹氬悜 + 闆? -> 鎷峰埌灞忓箷銆?     * 鏃?ping-pong 娈嬪奖: 鐩告満杞姩浼氳灞忓箷绌洪棿鎷栧熬绯婃垚涓€鐗? 3D 妯″紡闈犳嫋灏剧紦鍐蹭笌灏镐綋琛ㄨ揪鍔ㄥ娍銆?*/
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
      // 浣撶Н涓庨珮搴﹀彲瑙嗗寲鍙傛暟: uPxScale = 瑙嗗彛楂?(2*tan(fov/2)); uAlt = 褰撳墠楂樺害鑼冨洿(渚涗寒搴︽槧灏?
      const uPxScale = s.H / (2 * Math.tan(s.fov / 2));
      gl.uniform1f(U3.size3d, s.size3dMul);
      gl.uniform1f(U3.minpx, s.size3dMinPx);
      gl.uniform1f(U3.pxscale, uPxScale);
      gl.uniform2f(U3.alt, s.zLow, s.zHigh);
      // 鍗曚綅鍑犱綍(6 椤剁偣, 鍏ㄥ疄渚嬪叡鐢?
      gl.bindBuffer(gl.ARRAY_BUFFER, birdVBO);
      gl.enableVertexAttribArray(A3.unit);
      gl.vertexAttribPointer(A3.unit, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(A3.unit, 0);
      // 瀹炰緥: (x,y,z, vx,vy,vz), 24 瀛楄妭姝ラ暱
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
      /* ---- 鎷栧熬: 鍚屼竴瀹炰緥缂撳啿(浣嶇疆+閫熷害), 鍗曚綅甯﹀嚑浣? 寮€娣峰悎銆佸叧娣卞害鍐欏叆 ---- */
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
      // 鏀舵帀 3D 灞炴€? 閬垮厤涓?2D 绋嬪簭鐨勬Ы浣嶅啿绐?      gl.disableVertexAttribArray(A3.unit);
      gl.disableVertexAttribArray(A3.pos);
      gl.disableVertexAttribArray(A3.vel);
      // 鎷峰埌榛樿甯х紦鍐?2D 鍙犲姞灞傝鐩栧湪涓婇潰)
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

    // 姣忓抚璋冪敤: 鈶犳畫褰辨贰鍑?鈶′袱鎵瑰疄渚嬪寲楦?鈶㈡嫹鍒伴粯璁ゅ抚缂撳啿 鈶ing-pong 浜ゆ崲
    draw(s) {
      const c = s.counts();
      const curFBO = curIsA ? fboA : fboB;
      const prevTex = curIsA ? texB : texA;

      /* ---- 鈶?鐢ㄤ笂涓€甯х汗鐞嗗仛琛板噺, 鍐欒繘褰撳墠 FBO ---- */
      gl.bindFramebuffer(gl.FRAMEBUFFER, curFBO);           // 娓叉煋鐩爣 = 褰撳墠绂诲睆缂撳啿
      gl.viewport(0, 0, s.W, s.H);
      gl.useProgram(progFade);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, prevTex);              // 閲囨牱涓婁竴甯?      gl.uniform1i(U.tex, 0);
      gl.uniform3f(U.bg, s.bg[0], s.bg[1], s.bg[2]);
      gl.uniform1f(U.fade, s.fade);
      gl.uniform1f(U.copy, 0);                             // 0 = 琛板噺妯″紡
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.vertexAttribPointer(A.quad, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      /* ---- 鈶?缁勮瀹炰緥缂撳啿(鍙娲荤潃鐨勯笩, 3 float/鍙? ---- */
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

      /* ---- 鈶?涓ゆ瀹炰緥鍖栫粯鍒?鏃嬭浆/缂╂斁/鎶曞奖閮藉湪鐫€鑹插櫒) ---- */
      gl.useProgram(progBird);
      gl.uniform2f(U.res, s.W, s.H);
      gl.bindBuffer(gl.ARRAY_BUFFER, birdVBO);               // 绗?8 杞? 3D 甯у彲鑳芥敼杩囨Ы浣? 姣忓抚閲嶈
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

      /* ---- 鈶?鎷峰埌榛樿甯х紦鍐?2D 鍙犲姞灞傝鐩栧湪瀹冧笂闈? ---- */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);            // 娓叉煋鐩爣 = 灞忓箷
      gl.useProgram(progFade);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, curIsA ? texA : texB); // 鏈抚鍒氱敾濂界殑绾圭悊
      gl.uniform1i(U.tex, 0);
      gl.uniform1f(U.copy, 1);                             // 1 = 鍘熸牱鎷疯礉
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.vertexAttribPointer(A.quad, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      curIsA = !curIsA;                                    // ping-pong 浜ゆ崲
    },
  };
})();

