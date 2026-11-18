// ============================================================
// Glassvidia — loading screen + login interactions
// ============================================================
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------
  // 1) LOADING SCREEN — "colours up" the name, then the tagline
  // ------------------------------------------------------------
  var pre      = document.getElementById('preloader');
  var nameEl   = document.getElementById('pl-name');
  var tagEl    = document.getElementById('pl-tag');
  var countEl  = document.getElementById('pl-count');
  var barFill  = document.getElementById('pl-bar-fill');

  // timings in ms (shortened automatically for reduced-motion users)
  var k = reduceMotion ? 0.3 : 1;
  var NAME_START = 300 * k,  NAME_DUR = 1500 * k;
  var TAG_START  = 1350 * k, TAG_DUR  = 1250 * k;
  var HOLD       = 380 * k;

  var pageLoaded = document.readyState === 'complete';
  if (!pageLoaded) window.addEventListener('load', function () { pageLoaded = true; });

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  // --p runs from -6 (nothing) to 106 (fully revealed); see .pl-fill mask in style.css
  function setFill(el, t) { el.style.setProperty('--p', (-6 + t * 112).toFixed(2)); }

  function enterSite() {
    document.body.classList.add('ready');
    // let the stagger finish, then make hover/active states instant
    setTimeout(function () { document.body.classList.add('settled'); }, 2600);
  }

  function exitPreloader() {
    pre.classList.add('is-exit');
    window.dispatchEvent(new Event('classmate:reveal')); // background starts blooming
    setTimeout(enterSite, reduceMotion ? 100 : 750);
    setTimeout(function () {
      pre.classList.add('is-gone');
      pre.setAttribute('aria-hidden', 'true');
    }, reduceMotion ? 700 : 1900);
  }

  if (pre && nameEl && tagEl) {
    var start = null, leaving = false;

    var tick = function (now) {
      if (start === null) start = now;
      var el = now - start;

      var nT = easeInOut(clamp01((el - NAME_START) / NAME_DUR));
      var tT = easeInOut(clamp01((el - TAG_START) / TAG_DUR));
      setFill(nameEl, nT);
      setFill(tagEl, tT);

      var overall = nT * 0.62 + tT * 0.38;
      if (countEl) countEl.textContent = ('00' + Math.round(overall * 100)).slice(-3);
      if (barFill) barFill.style.transform = 'scaleX(' + overall.toFixed(4) + ')';

      if (!leaving && tT >= 1 && pageLoaded) {
        leaving = true;
        if (countEl) countEl.textContent = '100';
        setTimeout(exitPreloader, HOLD);
      }
      if (!leaving) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  } else {
    // No loader in the DOM – just show the page
    enterSite();
  }

  // ------------------------------------------------------------
  // 2) CARD — smooth 3D tilt + cursor spotlight
  // ------------------------------------------------------------
  var card = document.getElementById('login-card');

  if (card && !reduceMotion && window.matchMedia('(hover: hover)').matches) {
    var tRX = 0, tRY = 0, cRX = 0, cRY = 0;

    window.addEventListener('mousemove', function (e) {
      var nx = e.clientX / window.innerWidth - 0.5;
      var ny = e.clientY / window.innerHeight - 0.5;
      tRY = nx * 7;
      tRX = -ny * 5;

      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
    });

    document.addEventListener('mouseleave', function () { tRX = 0; tRY = 0; });

    var loop = function () {
      cRX += (tRX - cRX) * 0.07;
      cRY += (tRY - cRY) * 0.07;
      if (Math.abs(tRX - cRX) > 0.002 || Math.abs(tRY - cRY) > 0.002) {
        card.style.transform =
          'perspective(1100px) rotateX(' + cRX.toFixed(3) + 'deg) rotateY(' + cRY.toFixed(3) + 'deg)';
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------
  // 3) FORM & INTERACTIONS
  // ------------------------------------------------------------
  var togglePw = document.getElementById('toggle-password');
  var pwInput = document.getElementById('password');
  if (togglePw && pwInput) {
    togglePw.addEventListener('click', function () {
      var isPw = pwInput.type === 'password';
      pwInput.type = isPw ? 'text' : 'password';
      togglePw.classList.toggle('is-visible', isPw);
      var label = isPw ? 'Hide password' : 'Show password';
      togglePw.setAttribute('aria-label', label);
      togglePw.setAttribute('title', label);
    });
  }

  var form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('.login-btn');
      var label = btn.querySelector('.btn-label');
      if (btn.classList.contains('is-loading')) return;

      btn.classList.add('is-loading');
      label.textContent = 'Signing in';

      setTimeout(function () {
        btn.classList.remove('is-loading');
        btn.classList.add('is-done');
        label.textContent = 'Signed in';
        console.log('Login submitted (demo)');
        setTimeout(function () {
          document.body.classList.add('agri-active');
          document.getElementById('agri-app').setAttribute('aria-hidden', 'false');
          document.querySelector('.login-wrapper').setAttribute('aria-hidden', 'true');
          window.dispatchEvent(new Event('classmate:agri-enter'));
        }, 650);
      }, 1400);
    });
  }

  // ------------------------------------------------------------
  // 4) AGRISENCE CORP. — offline disease-finder demo interactions
  // ------------------------------------------------------------
  var leafInput = document.getElementById('leaf-file');
  var dropzone = document.getElementById('agri-dropzone');
  var uploadVisual = document.getElementById('upload-visual');
  var uploadTitle = document.getElementById('upload-title');
  var uploadSubtitle = document.getElementById('upload-subtitle');
  var analyzeBtn = document.getElementById('analyze-leaf');
  var reportEmpty = document.getElementById('report-empty');
  var reportContent = document.getElementById('report-content');
  var currentImageUrl = null;

  function setLeaf(file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) return;
    if (currentImageUrl) URL.revokeObjectURL(currentImageUrl);
    currentImageUrl = URL.createObjectURL(file);
    uploadVisual.style.backgroundImage = 'url("' + currentImageUrl + '")';
    dropzone.classList.add('has-image');
    uploadTitle.textContent = file.name;
    uploadSubtitle.textContent = 'Image selected · click to replace';
    analyzeBtn.disabled = false;
    reportEmpty.hidden = false;
    reportContent.hidden = true;
  }
  if (leafInput) leafInput.addEventListener('change', function () { setLeaf(leafInput.files && leafInput.files[0]); });
  if (dropzone) {
    dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('dragover'); });
    dropzone.addEventListener('drop', function (e) { e.preventDefault(); dropzone.classList.remove('dragover'); setLeaf(e.dataTransfer.files && e.dataTransfer.files[0]); });
  }
  if (analyzeBtn) analyzeBtn.addEventListener('click', function () {
    if (!currentImageUrl || analyzeBtn.disabled) return;
    var label = analyzeBtn.querySelector('span:first-child');
    analyzeBtn.disabled = true; label.textContent = 'Reviewing image…';
    setTimeout(function () {
      // Intentionally a UI prototype: no model runs and no disease is inferred from the upload.
      reportEmpty.hidden = true; reportContent.hidden = false;
      document.getElementById('disease-name').textContent = 'Sample leaf assessment';
      document.getElementById('confidence').textContent = 'Demo';
      document.getElementById('confidence-fill').style.width = '62%';
      document.getElementById('report-summary').textContent = 'This is a sample report to preview the interface. It does not inspect your image or identify a disease.';
      var list = document.getElementById('care-list');
      list.innerHTML = '<li>Compare visible symptoms with a trusted crop-health guide.</li><li>Check both sides of the leaf and nearby plants.</li><li>For treatment decisions, consult a local agronomist or extension officer.</li>';
      label.textContent = 'Analysis preview ready';
      setTimeout(function () { analyzeBtn.disabled = false; label.textContent = 'Run demo again'; }, 900);
    }, 950);
  });
  var resetBtn = document.getElementById('reset-analysis');
  if (resetBtn) resetBtn.addEventListener('click', function () { reportContent.hidden = true; reportEmpty.hidden = false; });
  var logoutBtn = document.getElementById('agri-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', function () {
    document.body.classList.remove('agri-active');
    document.getElementById('agri-app').setAttribute('aria-hidden', 'true');
    document.querySelector('.login-wrapper').setAttribute('aria-hidden', 'false');
    var loginBtn = document.querySelector('.login-btn');
    if (loginBtn) { loginBtn.classList.remove('is-done','is-loading'); loginBtn.querySelector('.btn-label').textContent = 'Sign In'; }
  });

  // ------------------------------------------------------------
  // 5) THEME SWITCH — circular reveal + synthesized sound
  //    (all sound is generated live with WebAudio: no audio files)
  // ------------------------------------------------------------
  var root = document.documentElement;
  var themeBtn = document.getElementById('theme-toggle');
  var soundBtn = document.getElementById('sound-toggle');
  var metaTheme = document.querySelector('meta[name="theme-color"]');

  function store(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  function isLight() { return root.dataset.theme === 'light'; }

  // ---- Sound engine ------------------------------------------------
  function createSoundEngine(ctx) {
    var master = ctx.createGain();
    master.gain.value = 1.15;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);

    // Procedural reverb tail (stereo decaying noise)
    function impulse(seconds, decay) {
      var len = Math.floor(ctx.sampleRate * seconds);
      var buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var d = buf.getChannelData(c);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }
    var verb = ctx.createConvolver();
    verb.buffer = impulse(2.4, 2.8);
    var wet = ctx.createGain(); wet.gain.value = 0.6;
    var dry = ctx.createGain(); dry.gain.value = 0.85;
    wet.connect(verb); verb.connect(master);
    dry.connect(master);

    function out(node) { node.connect(dry); node.connect(wet); }

    // 2 s of white noise, reused by the whooshes
    var noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    (function () {
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    })();

    // Glass-bell: a sine plus an inharmonic partial that fades quickly
    function bell(freq, when, vol, dur, bright, pan) {
      var g = ctx.createGain();
      var o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
      var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.76;
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, when);
      g2.gain.exponentialRampToValueAtTime(0.4 * bright, when + 0.008);
      g2.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.3);
      o1.connect(g); o2.connect(g2); g2.connect(g);

      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

      var node = g;
      if (ctx.createStereoPanner) {
        var p = ctx.createStereoPanner(); p.pan.value = pan || 0;
        g.connect(p); node = p;
      }
      out(node);
      o1.start(when); o2.start(when);
      o1.stop(when + dur + 0.1); o2.stop(when + dur + 0.1);
    }

    // Filtered-noise sweep (rising = sunrise, falling = nightfall)
    function sweep(when, dur, f0, f1, vol, q) {
      var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(f0, when);
      bp.frequency.exponentialRampToValueAtTime(f1, when + dur);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vol, when + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      src.connect(bp); bp.connect(g); out(g);
      src.start(when); src.stop(when + dur + 0.05);
    }

    // Deep swell
    function sub(when, dur, f0, f1, vol) {
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f0, when);
      o.frequency.exponentialRampToValueAtTime(f1, when + dur);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vol, when + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g); g.connect(master);
      o.start(when); o.stop(when + dur + 0.05);
    }

    // Soft chord bloom
    function pad(freqs, when, vol, attack, dur, cutoff) {
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vol, when + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      lp.connect(g); out(g);
      freqs.forEach(function (f, i) {
        var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        o.detune.value = (i - 1) * 4;
        o.connect(lp);
        o.start(when); o.stop(when + dur + 0.1);
      });
    }

    // Tiny "tock" the instant you press
    function tick(when, freq) {
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(freq, when);
      o.frequency.exponentialRampToValueAtTime(freq * 0.45, when + 0.05);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.09, when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
      o.connect(g); g.connect(dry);
      o.start(when); o.stop(when + 0.08);
    }

    return {
      // Sunrise: airy riser, ascending glass-bell arpeggio, bright chord bloom, sparkles
      toLight: function () {
        var t = ctx.currentTime + 0.02;
        tick(t, 1900);
        sweep(t, 1.05, 400, 7000, 0.1, 0.9);
        [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98].forEach(function (f, i) {
          bell(f, t + 0.06 + i * 0.085, 0.13, 1.9, 1, i % 2 ? 0.35 : -0.35);
        });
        pad([523.25, 783.99, 1318.51], t + 0.5, 0.05, 0.25, 2.3, 3200);
        [2093, 2637, 3136, 3520].forEach(function (f, i) {
          bell(f, t + 0.5 + i * 0.13, 0.04, 1.0, 0.3, (i - 1.5) * 0.4);
        });
      },
      // Nightfall: falling air, deep swell, descending soft bells, dark chord, star twinkles
      toDark: function () {
        var t = ctx.currentTime + 0.02;
        tick(t, 950);
        sweep(t, 1.15, 5200, 220, 0.08, 0.8);
        sub(t, 1.4, 120, 46, 0.3);
        [880, 659.25, 523.25, 440, 329.63, 220].forEach(function (f, i) {
          bell(f, t + 0.05 + i * 0.1, 0.12, 2.2, 0.45, i % 2 ? -0.3 : 0.3);
        });
        pad([220, 329.63, 493.88], t + 0.35, 0.055, 0.3, 2.5, 1400);
        [2637, 3136, 3951].forEach(function (f, i) {
          bell(f, t + 0.55 + i * 0.22, 0.032, 0.9, 0.2, (i - 1) * 0.5);
        });
      }
    };
  }

  window.GlassvidiaAudio = { createSoundEngine: createSoundEngine }; // exposed for testing

  var audioCtx = null, engine = null;
  var soundOn = load('cm-sound') !== 'off';

  function paintSoundBtn() {
    if (!soundBtn) return;
    soundBtn.dataset.muted = String(!soundOn);
    soundBtn.setAttribute('aria-label', soundOn ? 'Mute sounds' : 'Unmute sounds');
  }
  paintSoundBtn();

  function ensureAudio() {
    if (engine) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      audioCtx = new AC();
      engine = createSoundEngine(audioCtx);
      return true;
    } catch (e) { return false; }
  }

  function playThemeSound(toLight) {
    if (!soundOn || !ensureAudio()) return;
    var go = function () { toLight ? engine.toLight() : engine.toDark(); };
    if (audioCtx.state === 'suspended') audioCtx.resume().then(go); else go();
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', function () {
      soundOn = !soundOn;
      store('cm-sound', soundOn ? 'on' : 'off');
      paintSoundBtn();
      if (soundOn && ensureAudio()) {
        // short confirmation blip
        var go = function () {
          var t = audioCtx.currentTime + 0.01;
          var o = audioCtx.createOscillator(), g = audioCtx.createGain();
          o.type = 'sine'; o.frequency.value = 880;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
          o.connect(g); g.connect(audioCtx.destination);
          o.start(t); o.stop(t + 0.4);
        };
        if (audioCtx.state === 'suspended') audioCtx.resume().then(go); else go();
      }
    });
  }

  // ---- Visuals -----------------------------------------------------
  function applyTheme(light, instant) {
    root.dataset.theme = light ? 'light' : 'dark';
    store('cm-theme', light ? 'light' : 'dark');
    if (metaTheme) metaTheme.setAttribute('content', light ? '#ececec' : '#000000');
    if (themeBtn) {
      themeBtn.setAttribute('aria-pressed', String(light));
      themeBtn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    }
    window.dispatchEvent(new CustomEvent('classmate:theme', { detail: { light: light, instant: !!instant } }));
  }

  function burst(toLight, x, y) {
    var el = document.createElement('div');
    el.className = 'burst ' + (toLight ? 'to-light' : 'to-dark');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    var n = toLight ? 16 : 10;
    for (var i = 0; i < n; i++) {
      var s = document.createElement('i');
      var a = (360 / n) * i + (Math.random() * 14 - 7);
      s.style.setProperty('--a', a.toFixed(1) + 'deg');
      s.style.setProperty('--d', (toLight ? 64 + Math.random() * 40 : 56 + Math.random() * 84).toFixed(0) + 'px');
      s.style.setProperty('--dl', (Math.random() * 0.18).toFixed(2) + 's');
      s.style.setProperty('--t', (0.8 + Math.random() * 0.4).toFixed(2) + 's');
      el.appendChild(s);
    }
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1700);
  }

  function ring(x, y, radius) {
    var el = document.createElement('div');
    el.className = 'theme-ring';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    var s = (radius * 2) / 100;
    var a = el.animate(
      [{ transform: 'scale(0.1)', opacity: 0.95 }, { transform: 'scale(' + s + ')', opacity: 0 }],
      { duration: 1100, easing: 'cubic-bezier(0.65, 0, 0.2, 1)' }
    );
    a.onfinish = function () { el.remove(); };
  }

  var switching = false;

  function toggleTheme() {
    if (switching) return;
    switching = true;
    var toLight = !isLight();

    var rect = themeBtn.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    var radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    playThemeSound(toLight);
    if (navigator.vibrate) navigator.vibrate([8, 40, 14]);

    var done = function () { setTimeout(function () { switching = false; }, 250); };

    if (reduceMotion) {
      applyTheme(toLight, true);
      done();
      return;
    }

    if (document.startViewTransition) {
      var vt = document.startViewTransition(function () {
        root.classList.add('theme-instant');
        applyTheme(toLight, true); // swap instantly; the circle reveals it
        return new Promise(function (res) {
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              root.classList.remove('theme-instant');
              res();
            });
          });
        });
      });
      vt.ready.then(function () {
        burst(toLight, x, y);
        root.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 1250, easing: 'cubic-bezier(0.65, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(function () {});
      vt.finished.then(done, done);
    } else {
      // Fallback: expanding ring + smooth colour/shader fade
      root.classList.add('theme-anim');
      burst(toLight, x, y);
      ring(x, y, radius);
      applyTheme(toLight, false);
      setTimeout(function () { root.classList.remove('theme-anim'); }, 900);
      setTimeout(done, 900);
    }
  }

  if (themeBtn) {
    themeBtn.setAttribute('aria-pressed', String(isLight()));
    themeBtn.setAttribute('aria-label', isLight() ? 'Switch to dark mode' : 'Switch to light mode');
    if (metaTheme && isLight()) metaTheme.setAttribute('content', '#ececec');
    themeBtn.addEventListener('click', toggleTheme);
  }
})();
