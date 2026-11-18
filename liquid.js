// ============================================================
// ClassMate — Monochrome liquid-chrome background (WebGL)
// Domain-warped noise is treated as a height field, lit like
// polished liquid metal, and rendered in pure greyscale.
// ============================================================
(function () {
  'use strict';

  var canvas = document.getElementById('liquid-canvas');
  if (!canvas) return;

  var gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance'
  });

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fallback() {
    console.warn('WebGL unavailable – using static monochrome background');
    canvas.style.display = 'none';
    var light = document.documentElement.dataset.theme === 'light';
    document.body.style.background = light
      ? 'radial-gradient(ellipse at 30% 20%, #ffffff 0%, #e4e4e6 55%, #c9c9cd 100%)'
      : 'radial-gradient(ellipse at 30% 20%, #3a3a3a 0%, #121212 48%, #000 100%)';
  }

  if (!gl) { fallback(); return; }

  // ---------- Shaders ----------
  var vertexSrc = [
    'attribute vec2 a_position;',
    'void main() { gl_Position = vec4(a_position, 0.0, 1.0); }'
  ].join('\n');

  var fragmentSrc = [
    'precision highp float;',
    'uniform float u_time;',
    'uniform vec2  u_resolution;',
    'uniform vec2  u_mouse;',
    'uniform float u_intro;',
    'uniform float u_theme;', // 0 = dark chrome, 1 = pearl silver

    // --- simplex noise (Ashima / Ian McEwan) ---
    'vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }',
    'vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }',
    'vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }',

    'float snoise(vec2 v) {',
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439,',
    '                     -0.577350269189626, 0.024390243902439);',
    '  vec2 i  = floor(v + dot(v, C.yy));',
    '  vec2 x0 = v - i + dot(i, C.xx);',
    '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
    '  vec4 x12 = x0.xyxy + C.xxzz;',
    '  x12.xy -= i1;',
    '  i = mod289(i);',
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));',
    '  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);',
    '  m = m * m; m = m * m;',
    '  vec3 x = 2.0 * fract(p * C.www) - 1.0;',
    '  vec3 h = abs(x) - 0.5;',
    '  vec3 ox = floor(x + 0.5);',
    '  vec3 a0 = x - ox;',
    '  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);',
    '  vec3 g;',
    '  g.x  = a0.x * x0.x + h.x * x0.y;',
    '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
    '  return 130.0 * dot(m, g);',
    '}',

    'float fbm(vec2 p) {',
    '  float f = 0.0;',
    '  float a = 0.5;',
    '  for (int i = 0; i < 4; i++) {',
    '    f += a * snoise(p);',
    '    p = p * 2.03 + vec2(11.3, 7.1);',
    '    a *= 0.5;',
    '  }',
    '  return f;',
    '}',

    'float fbmSoft(vec2 p) {',
    '  float f = 0.0;',
    '  float a = 0.55;',
    '  for (int i = 0; i < 3; i++) {',
    '    f += a * snoise(p);',
    '    p = p * 1.9 + vec2(11.3, 7.1);',
    '    a *= 0.38;',
    '  }',
    '  return f;',
    '}',

    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',

    // Height of the liquid surface (+ a soft swell that follows the cursor)
    'float field(vec2 x, vec2 w, vec2 m) {',
    '  float h = fbmSoft(x + 1.8 * w);',
    '  vec2 d = x - m;',
    '  h += 0.34 * exp(-dot(d, d) * 1.8);',
    '  return h;',
    '}',

    'void main() {',
    '  vec2 frag = gl_FragCoord.xy;',
    '  vec2 uv = frag / u_resolution;',
    '  float asp = u_resolution.x / u_resolution.y;',
    '  vec2 p = (frag - 0.5 * u_resolution) / u_resolution.y * 1.35;',
    '  vec2 m = (u_mouse - 0.5) * vec2(asp, 1.0) * 1.35;',

    '  float t = u_time * 0.055;',

    // Domain warp (low-frequency, computed once)
    '  vec2 q = vec2(fbmSoft(p * 0.8 + vec2(0.0, t)),',
    '                fbmSoft(p * 0.8 + vec2(5.2, 1.3) - vec2(t, 0.0)));',
    '  vec2 r = vec2(fbmSoft(p + 1.6 * q + vec2(1.7, 9.2) + t * 1.3),',
    '                fbmSoft(p + 1.6 * q + vec2(8.3, 2.8) - t));',

    // Surface normal via finite differences
    '  float e = 0.04;',
    '  float h0 = field(p, r, m);',
    '  float hx = field(p + vec2(e, 0.0), r, m);',
    '  float hy = field(p + vec2(0.0, e), r, m);',
    '  vec2 grad = vec2(hx - h0, hy - h0) / e;',
    '  vec3 n = normalize(vec3(-grad * 0.48, 1.0));',

    // Chrome: reflect the view ray into a simple studio environment
    '  vec3 rv = reflect(vec3(0.0, 0.0, -1.0), n);',
    '  float bands = 0.5 + 0.5 * sin(rv.y * 5.2 + rv.x * 2.1 + 0.9 + h0 * 1.5);',
    '  bands = pow(bands, 2.6);',
    '  float softbox = smoothstep(0.35, 1.0, rv.y * 0.75 - rv.x * 0.35 + 0.28);',

    // Key light drifts with the cursor
    '  vec3 L = normalize(vec3(-0.45 + (u_mouse.x - 0.5) * 0.9, 0.55 + (u_mouse.y - 0.5) * 0.9, 0.75));',
    '  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 48.0);',
    '  float diff = max(dot(n, L), 0.0);',

    '  float c = bands * 0.62 + softbox * 0.30 + spec * 0.85 + diff * 0.05;',
    '  c = clamp(c, 0.0, 1.2);',

    // Shared geometry for both looks
    '  vec2 cc = uv - 0.5;',
    '  cc.x *= asp * 0.75;',
    '  float vig = 1.0 - smoothstep(0.25, 1.05, length(cc));',
    '  float pool = exp(-dot(cc, cc) * 5.0);',
    '  vec2 md = (uv - u_mouse) * vec2(asp, 1.0);',
    '  float glow = exp(-dot(md, md) * 7.0);',

    // DARK: moody black chrome, kept dim so the glass card stays legible
    '  float cd = c * 0.546;',
    '  cd *= 0.12 + 0.88 * vig;',
    '  cd *= 1.0 - 0.38 * pool;',
    '  cd += 0.045 * glow;',

    // LIGHT: pearl silver – the same liquid, chrome bands read as soft graphite lines
    '  float cl = 0.96 - clamp(c, 0.0, 1.0) * 0.46;',
    '  cl *= 1.0 - 0.2 * (1.0 - vig);',
    '  cl += 0.05 * pool;',
    '  cl += 0.05 * glow;',

    '  c = mix(cd, cl, u_theme);',

    // Intro: light blooms outward from the centre
    '  float reveal = smoothstep(0.0, 1.0, u_intro * 2.0 - length(uv - 0.5) * 1.15);',
    '  c *= reveal;',

    // Gentle contrast + dither (prevents banding in the dark ramps)
    '  c = pow(clamp(c, 0.0, 1.0), 1.08);',
    '  c += (hash(frag + fract(u_time)) - 0.5) / 255.0;',

    '  gl_FragColor = vec4(vec3(c), 1.0);',
    '}'
  ].join('\n');

  // ---------- Compile / link ----------
  function createShader(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  var vs = createShader(gl.VERTEX_SHADER, vertexSrc);
  var fs = createShader(gl.FRAGMENT_SHADER, fragmentSrc);
  if (!vs || !fs) { fallback(); return; }

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    fallback();
    return;
  }

  gl.useProgram(program);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1, 1,
    -1,  1,  1, -1,  1, 1
  ]), gl.STATIC_DRAW);

  var posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  var uTime  = gl.getUniformLocation(program, 'u_time');
  var uRes   = gl.getUniformLocation(program, 'u_resolution');
  var uMouse = gl.getUniformLocation(program, 'u_mouse');
  var uIntro = gl.getUniformLocation(program, 'u_intro');
  var uTheme = gl.getUniformLocation(program, 'u_theme');

  // ---------- Resolution (adaptive – the liquid is smooth, so lower res is fine) ----------
  var quality = 0.8; // fraction of device pixels actually shaded

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.max(1, Math.floor(window.innerWidth * dpr * quality));
    var h = Math.max(1, Math.floor(window.innerHeight * dpr * quality));
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  }

  window.addEventListener('resize', resize);
  resize();

  // ---------- Mouse (smoothed) ----------
  var mouse = { x: 0.5, y: 0.5 };
  var target = { x: 0.5, y: 0.5 };

  window.addEventListener('mousemove', function (e) {
    target.x = e.clientX / window.innerWidth;
    target.y = 1.0 - e.clientY / window.innerHeight;
  });

  window.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (!t) return;
    target.x = t.clientX / window.innerWidth;
    target.y = 1.0 - t.clientY / window.innerHeight;
  }, { passive: true });

  // ---------- Intro (starts when the loader opens) ----------
  var introStart = null;
  function startIntro() { if (introStart === null) introStart = performance.now(); }
  window.addEventListener('classmate:reveal', startIntro);
  setTimeout(startIntro, 15000); // safety net

  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  // ---------- Theme (0 dark → 1 light) ----------
  var themeNow = document.documentElement.dataset.theme === 'light' ? 1 : 0;
  var themeTarget = themeNow;
  window.addEventListener('classmate:theme', function (e) {
    themeTarget = e.detail && e.detail.light ? 1 : 0;
    if (e.detail && e.detail.instant) themeNow = themeTarget;
  });

  // ---------- Render loop ----------
  var t0 = performance.now();
  var speed = reduceMotion ? 0.25 : 1.0;
  var last = t0, slow = 0, frames = 0;

  function render(now) {
    var time = ((now - t0) / 1000) * speed;

    mouse.x += (target.x - mouse.x) * 0.045;
    mouse.y += (target.y - mouse.y) * 0.045;

    var intro = 0;
    if (introStart !== null) intro = easeOutCubic(Math.min(1, (now - introStart) / 2800));

    gl.uniform1f(uTime, time);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    themeNow += (themeTarget - themeNow) * 0.07;
    if (Math.abs(themeTarget - themeNow) < 0.001) themeNow = themeTarget;

    gl.uniform1f(uIntro, intro);
    gl.uniform1f(uTheme, themeNow);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Adaptive quality: if the GPU struggles, shade fewer pixels
    var dt = now - last;
    last = now;
    frames++;
    if (frames > 30 && dt > 34) slow++; else if (dt <= 24) slow = Math.max(0, slow - 1);
    if (slow > 25 && quality > 0.5) {
      quality = Math.max(0.5, quality - 0.15);
      slow = 0;
      resize();
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
