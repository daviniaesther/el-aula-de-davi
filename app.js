/*
 * El aula de Davi · Trazar letras y números
 *
 * Cómo funciona el trazado: cada trazo se convierte en una fila de puntos
 * separados 1 unidad. El niño "avanza" por el trazo cuando su dedo pasa
 * cerca (TOLERANCE) de un punto que está un poco por delante del progreso
 * actual (LOOKAHEAD). Así se respeta la dirección y el orden de los trazos,
 * pero se perdona que el dedo se salga un poco.
 */
(function () {
  'use strict';

  var VIEW = { x: 0, y: 0, w: 100, h: 100 }; // rejilla de las letras
  var GUIDE_WIDTH = 16;    // grosor del "camino" gris
  var FILL_WIDTH = 11.5;   // grosor del color al trazar
  var TOLERANCE = 12;      // distancia máxima del dedo al camino
  var LOOKAHEAD = 20;      // cuántos puntos por delante se aceptan
  var START_RADIUS = 15;   // cuánto hay que acercarse al punto de salida
  var DEMO_SPEED = 55;     // unidades por segundo en la demostración
  var COLORS = ['#ff6b8b', '#ffb627', '#3ec1d3', '#7c5cff', '#36c275'];
  var TILE_COLORS = ['#ff6b8b', '#f59f00', '#1fb0c4', '#7c5cff', '#2fb36a', '#ff7a45'];
  var STORAGE_KEY = 'aula-davi-letras';

  // ---------- Secciones ----------
  // Cada elemento que se traza (letra o número) tiene la misma forma:
  // key (para las estrellas), label, strokes, scale (tamaño de las cifras),
  // lo que se muestra en la tarjeta y las frases load / listen / win
  // con su texto para la voz del navegador y su audio de respaldo.
  function letterItem(l, i) {
    var sp = l.speak || l.name;
    var base = (i < 10 ? '0' : '') + i + '-';
    return {
      key: l.ch, label: l.ch, aria: 'Letra ' + l.ch, strokes: l.strokes, scale: 1,
      emoji: l.emoji, celEmoji: l.emoji, count: false,
      wordHTML: '<span class="initial">' + l.word.charAt(0) + '</span>' + l.word.slice(1),
      load: { text: sp, clip: base + 'letra' },
      listen: { text: sp + ', de ' + l.word, clip: base + 'palabra' },
      win: { text: '¡Muy bien! ' + sp + ', de ' + l.word, clip: base + 'bien' }
    };
  }

  function numberItem(d) {
    var base = 'num-' + ('00' + d.n).slice(-3);
    var apples = d.n >= 1 && d.n <= 10 ? new Array(d.n + 1).join('🍎') : '';
    return {
      key: 'n' + d.n, label: String(d.n), aria: 'Número ' + d.n, strokes: d.strokes, scale: d.scale,
      emoji: apples, celEmoji: apples || '🎉', count: !!apples,
      wordHTML: d.name,
      load: { text: d.name, clip: base },
      listen: { text: d.name, clip: base },
      win: { text: '¡Muy bien! ' + d.name, clip: base + '-bien' }
    };
  }

  var MODES = {
    letras: window.LETTERS.map(letterItem),
    numeros: window.NUMBERS.map(numberItem)
  };

  // ---------- Elementos ----------
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('board');
  var ctx = canvas.getContext('2d');
  var confettiCanvas = $('confetti');
  var cctx = confettiCanvas.getContext('2d');
  var alphabetEl = $('alphabet');
  var celebrateEl = $('celebrate');

  // ---------- Estado ----------
  var saved = loadSaved();
  var state = {
    mode: 'letras',
    index: 0,
    ws: 1,           // escala de grosores (las cifras de números largos son más pequeñas)
    strokes: [],
    current: 0,      // trazo en el que estamos
    progress: 0,     // índice del punto alcanzado dentro del trazo actual
    tracing: false,
    pointerId: null,
    lastPt: null,
    done: false,
    demo: null,
    missAt: -1e9,    // cuándo tocó fuera del punto de salida (para avisar)
    doneAt: 0,
    particles: []
  };
  var view = { s: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 };
  var demoTimer = 0;
  var celebrateTimer = 0;

  // ---------- Utilidades ----------
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  function resample(pts, step) {
    var out = [[pts[0][0], pts[0][1]]];
    var need = step;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      var seg = dist(a, b), pos = 0;
      while (pos + need <= seg) {
        pos += need;
        var f = pos / seg;
        out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
        need = step;
      }
      need -= seg - pos;
    }
    var last = pts[pts.length - 1];
    if (dist(out[out.length - 1], last) > 0.3) out.push([last[0], last[1]]);
    return out;
  }

  function loadSaved() {
    var data = { stars: {}, muted: false, mode: 'letras', pos: { letras: 0, numeros: 0 } };
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        data.stars = parsed.stars || {};
        data.muted = !!parsed.muted;
        if (parsed.mode === 'numeros') data.mode = 'numeros';
        if (parsed.pos) {
          data.pos.letras = parsed.pos.letras | 0;
          data.pos.numeros = parsed.pos.numeros | 0;
        } else {
          data.pos.letras = parsed.index | 0; // formato antiguo
        }
      }
    } catch (e) { /* sin almacenamiento: seguimos sin guardar */ }
    return data;
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (e) { /* nada */ }
  }

  // ---------- Sonido ----------
  var audio = null;
  var lastTick = 0;

  function ensureAudio() {
    if (audio) {
      if (audio.state === 'suspended') audio.resume();
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audio = new AC();
  }

  function tone(freq, dur, opts) {
    if (!audio || saved.muted) return;
    opts = opts || {};
    var t = audio.currentTime + (opts.delay || 0);
    var osc = audio.createOscillator();
    var gain = audio.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(opts.vol || 0.18, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  var sfx = {
    tick: function (frac) {
      var now = performance.now();
      if (now - lastTick < 70) return;
      lastTick = now;
      tone(420 + frac * 520, 0.07, { type: 'triangle', vol: 0.06 });
    },
    stroke: function () {
      tone(660, 0.14, { type: 'triangle', vol: 0.16 });
      tone(990, 0.2, { type: 'triangle', vol: 0.14, delay: 0.09 });
    },
    miss: function () { tone(260, 0.18, { type: 'sine', vol: 0.12, to: 200 }); },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone(f, 0.28, { type: 'triangle', vol: 0.16, delay: i * 0.11 });
      });
      tone(1319, 0.5, { type: 'sine', vol: 0.1, delay: 0.46 });
    },
    click: function () { tone(520, 0.08, { type: 'sine', vol: 0.1, to: 700 }); }
  };

  // ---------- Voz ----------
  // Primero se usa la voz del navegador. Si no hay voz en español o no
  // llega a sonar, se reproduce el audio grabado de la carpeta audio/
  // (generado con espeak-ng: NN-letra.wav, NN-palabra.wav, NN-bien.wav).
  var hasSpeech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  var voice = null;
  var voicesLoaded = false;
  var speechWorks = null;   // null: aún no se sabe; true/false tras el primer intento
  var utterance = null;     // referencia viva (Chrome la pierde si no se guarda)
  var speakTimer = 0;
  var clipPlayer = null;

  function pickVoice() {
    var voices = speechSynthesis.getVoices();
    if (voices.length) voicesLoaded = true;
    voice = voices.find(function (v) { return /^es[-_]ES/i.test(v.lang); }) ||
            voices.find(function (v) { return /^es/i.test(v.lang); }) || null;
  }

  if (hasSpeech) {
    pickVoice();
    if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', pickVoice);
  }

  function playClip(clip) {
    if (!clip) return;
    if (clipPlayer) clipPlayer.pause();
    clipPlayer = new Audio('audio/' + clip + '.wav');
    var p = clipPlayer.play();
    if (p && p.catch) p.catch(function () { /* el navegador no deja reproducir */ });
  }

  function stopVoice() {
    clearTimeout(speakTimer);
    if (clipPlayer) clipPlayer.pause();
    if (hasSpeech && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
  }

  function say(text, clip) {
    if (saved.muted) return;
    stopVoice();
    if (!hasSpeech || speechWorks === false || (voicesLoaded && !voice)) {
      playClip(clip);
      return;
    }
    // Chrome se "traga" la frase si se habla justo después de cancel().
    speakTimer = setTimeout(function () {
      var started = false;
      var u = new SpeechSynthesisUtterance(text);
      utterance = u;
      u.lang = 'es-ES';
      if (voice) u.voice = voice;
      u.rate = 0.85;
      u.pitch = 1.15;
      u.onstart = function () { started = true; speechWorks = true; };
      u.onerror = function (e) {
        if (started || e.error === 'interrupted' || e.error === 'canceled') return;
        speechWorks = false;
        if (utterance === u) playClip(clip);
      };
      try {
        speechSynthesis.resume();
        speechSynthesis.speak(u);
      } catch (err) {
        speechWorks = false;
        playClip(clip);
        return;
      }
      // Si en un momento no ha empezado a hablar, usamos el audio grabado.
      speakTimer = setTimeout(function () {
        if (started || speechWorks || utterance !== u) return;
        speechWorks = false;
        speechSynthesis.cancel();
        playClip(clip);
      }, 1500);
    }, 80);
  }

  function sayPhrase(phrase) { say(phrase.text, phrase.clip); }

  // ---------- Elemento actual ----------
  function items() { return MODES[state.mode]; }
  function item() { return items()[state.index]; }

  function setEmoji(el, it, emoji) {
    el.textContent = emoji;
    el.hidden = !emoji;
    el.classList.toggle('count', it.count);
  }

  function loadItem(i, opts) {
    opts = opts || {};
    var list = items();
    state.index = (i + list.length) % list.length;
    var l = item();
    state.ws = l.scale === 1 ? 1 : l.scale > 0.6 ? 0.75 : 0.6;
    state.strokes = l.strokes.map(function (pts, k) {
      return { pts: resample(pts, 1), color: COLORS[k % COLORS.length] };
    });
    state.current = 0;
    state.progress = 0;
    state.tracing = false;
    state.pointerId = null;
    state.done = false;
    state.demo = null;
    state.particles = [];
    saved.mode = state.mode;
    saved.pos[state.mode] = state.index;
    persist();

    $('bigLetter').textContent = l.label;
    setEmoji($('wordEmoji'), l, l.emoji);
    $('wordText').innerHTML = l.wordHTML;
    updateAlphabet();
    hideCelebrate();

    clearTimeout(demoTimer);
    if (!opts.silent) {
      sayPhrase(l.load);
      demoTimer = setTimeout(startDemo, 900);
    }
  }

  function restartItem() {
    loadItem(state.index, { silent: true });
    clearTimeout(demoTimer);
    demoTimer = setTimeout(startDemo, 300);
  }

  // ---------- Abecedario ----------
  function buildAlphabet() {
    alphabetEl.textContent = '';
    items().forEach(function (l, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'letter-tile' + (l.label.length > 2 ? ' long' : '');
      b.style.setProperty('--tile', TILE_COLORS[i % TILE_COLORS.length]);
      b.textContent = l.label;
      b.setAttribute('aria-label', l.aria);
      b.addEventListener('click', function () {
        ensureAudio();
        sfx.click();
        loadItem(i);
      });
      alphabetEl.appendChild(b);
    });
  }

  function updateAlphabet() {
    var tiles = alphabetEl.children;
    var count = 0;
    for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      var key = items()[i].key;
      tile.classList.toggle('active', i === state.index);
      var badge = tile.querySelector('.badge');
      if (saved.stars[key]) {
        count++;
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = '⭐';
          tile.appendChild(badge);
        }
      } else if (badge) {
        badge.remove();
      }
    }
    $('starCount').textContent = count;
    var active = tiles[state.index];
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  // ---------- Lienzo ----------
  function resize() {
    var r = canvas.getBoundingClientRect();
    view.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    view.w = r.width;
    view.h = r.height;
    canvas.width = Math.round(r.width * view.dpr);
    canvas.height = Math.round(r.height * view.dpr);
    var s = Math.min(r.width / VIEW.w, r.height / VIEW.h) * 0.86;
    view.s = s;
    view.ox = (r.width - VIEW.w * s) / 2 - VIEW.x * s;
    view.oy = (r.height - VIEW.h * s) / 2 - VIEW.y * s + r.height * 0.02;
  }

  function toLetter(e) {
    var r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left - view.ox) / view.s, (e.clientY - r.top - view.oy) / view.s];
  }

  function useLetterSpace() {
    ctx.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, view.dpr * view.ox, view.dpr * view.oy);
  }

  // Texto en coordenadas de la letra pero con tamaño en píxeles reales
  // (algunos navegadores dibujan mal fuentes diminutas escaladas).
  function drawText(text, x, y, sizeUnits, color, opts) {
    opts = opts || {};
    ctx.save();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.font = (opts.weight || 700) + ' ' + Math.round(sizeUnits * view.s) + 'px ' +
      '"Fredoka", ui-rounded, system-ui, sans-serif';
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = opts.baseline || 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, x * view.s + view.ox, y * view.s + view.oy);
    ctx.restore();
  }

  function tracePath(pts, from, to) {
    ctx.beginPath();
    ctx.moveTo(pts[from][0], pts[from][1]);
    for (var i = from + 1; i <= to; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }

  function drawChevron(pts, i, color) {
    var a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)];
    var ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    var p = pts[i];
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.rotate(ang);
    ctx.scale(state.ws, state.ws);
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.lineTo(1.5, 0);
    ctx.lineTo(-2, 3);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  function drawStar(x, y, r, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 ? r * 0.45 : r;
      var a = (i * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function draw(now) {
    var t = now / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    useLetterSpace();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var strokes = state.strokes;

    // Camino de la letra (borde y relleno claro)
    strokes.forEach(function (st) {
      tracePath(st.pts, 0, st.pts.length - 1);
      ctx.strokeStyle = '#e3d6f7';
      ctx.lineWidth = (GUIDE_WIDTH + 2.5) * state.ws;
      ctx.stroke();
    });
    strokes.forEach(function (st) {
      tracePath(st.pts, 0, st.pts.length - 1);
      ctx.strokeStyle = '#faf7ff';
      ctx.lineWidth = GUIDE_WIDTH * state.ws;
      ctx.stroke();
    });

    // Trazos terminados
    for (var i = 0; i < state.current && i < strokes.length; i++) {
      tracePath(strokes[i].pts, 0, strokes[i].pts.length - 1);
      ctx.strokeStyle = strokes[i].color;
      ctx.lineWidth = FILL_WIDTH * state.ws;
      ctx.stroke();
    }

    // Letra terminada: brillo que late
    if (state.done) {
      var glow = 0.5 + 0.5 * Math.sin((now - state.doneAt) / 180);
      strokes.forEach(function (st) {
        tracePath(st.pts, 0, st.pts.length - 1);
        ctx.strokeStyle = 'rgba(255, 255, 255,' + (0.25 * glow) + ')';
        ctx.lineWidth = FILL_WIDTH * 0.35 * state.ws;
        ctx.stroke();
      });
    }

    var cur = strokes[state.current];
    if (cur && !state.done) {
      var pts = cur.pts, n = pts.length;

      // Parte ya trazada del trazo actual
      if (state.progress > 0) {
        tracePath(pts, 0, state.progress);
        ctx.strokeStyle = cur.color;
        ctx.lineWidth = FILL_WIDTH * state.ws;
        ctx.stroke();
      }

      // Flechitas que indican la dirección
      // (solo en el tramo siguiente, para no llenar la letra de flechas)
      var lastChevron = Math.min(n - 5, state.progress + 70);
      for (var k = state.progress + 9; k < lastChevron; k += 11) drawChevron(pts, k, '#b9a6ec');

      // Números de los trazos que faltan
      for (var j = state.current + 1; j < strokes.length; j++) {
        var sp = strokes[j].pts[0];
        ctx.beginPath();
        ctx.arc(sp[0], sp[1], 4.2 * state.ws, 0, Math.PI * 2);
        ctx.fillStyle = '#e3d6f7';
        ctx.fill();
        drawText(String(j + 1), sp[0], sp[1] + 0.3, 5.2 * state.ws, '#8f7cc9');
      }

      // Meta: estrellita al final del trazo
      var end = pts[n - 1];
      drawStar(end[0], end[1], (4.2 + 0.4 * Math.sin(t * 4)) * state.ws, '#ffc93c', Math.sin(t * 2) * 0.2);

      // Punto de salida (o cabeza del trazo mientras se dibuja)
      var head = pts[state.progress];
      var missing = now - state.missAt < 900;
      var pulse = 1 + 0.12 * Math.sin(t * 6) + (missing ? 0.35 * Math.sin((now - state.missAt) / 50) : 0);
      if (!state.tracing) {
        ctx.beginPath();
        ctx.arc(head[0], head[1], 9 * state.ws * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(54, 194, 117, .18)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(head[0], head[1], 5.6 * state.ws, 0, Math.PI * 2);
      ctx.fillStyle = state.tracing ? cur.color : '#36c275';
      ctx.fill();
      ctx.lineWidth = 1.4 * state.ws;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      if (state.progress === 0) drawText(String(state.current + 1), head[0], head[1] + 0.3, 6.4 * state.ws, '#fff');
    }

    // Demostración: mano que recorre la letra
    var demo = state.demo;
    if (demo) {
      ctx.globalAlpha = demo.alpha;
      for (var d = state.current; d <= demo.stroke && d < strokes.length; d++) {
        var st = strokes[d];
        var upto = d < demo.stroke ? st.pts.length - 1 : Math.floor(demo.pos);
        if (d === state.current && upto <= state.progress) continue;
        if (upto > 0) {
          tracePath(st.pts, d === state.current ? state.progress : 0, upto);
          ctx.strokeStyle = st.color;
          ctx.globalAlpha = demo.alpha * 0.45;
          ctx.lineWidth = FILL_WIDTH * state.ws;
          ctx.stroke();
          ctx.globalAlpha = demo.alpha;
        }
      }
      var hs = strokes[Math.min(demo.stroke, strokes.length - 1)];
      var hp = hs.pts[Math.min(Math.floor(demo.pos), hs.pts.length - 1)];
      drawText('👆', hp[0] + 1.5 * state.ws, hp[1] - 1, 15 * Math.max(state.ws, 0.75), '#000', { baseline: 'top' });
      ctx.globalAlpha = 1;
    }

    // Chispitas
    useLetterSpace();
    state.particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life);
      drawStar(p.x, p.y, p.r * (0.6 + 0.4 * p.life), p.color, p.rot);
    });
    ctx.globalAlpha = 1;
  }

  function update(dt) {
    // Partículas
    for (var i = state.particles.length - 1; i >= 0; i--) {
      var p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt;
      p.rot += p.vr * dt;
      p.life -= dt * p.decay;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Demostración
    var demo = state.demo;
    if (demo) {
      if (demo.wait > 0) {
        demo.wait -= dt;
      } else if (demo.finished) {
        demo.alpha -= dt * 2;
        if (demo.alpha <= 0) state.demo = null;
      } else {
        demo.pos += DEMO_SPEED * dt;
        var st = state.strokes[demo.stroke];
        if (demo.pos >= st.pts.length - 1) {
          demo.pos = st.pts.length - 1;
          if (demo.stroke + 1 < state.strokes.length) {
            demo.stroke++;
            demo.pos = 0;
            demo.wait = 0.35;
          } else {
            demo.finished = true;
            demo.wait = 0.6;
          }
        }
      }
    }
  }

  function sparkle(p, count, spread) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = (0.3 + Math.random()) * spread;
      state.particles.push({
        x: p[0], y: p[1],
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - spread * 0.3,
        r: 1.6 + Math.random() * 2,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
        life: 1, decay: 1.2 + Math.random(),
        color: COLORS[(Math.random() * COLORS.length) | 0]
      });
    }
    if (state.particles.length > 220) state.particles.splice(0, state.particles.length - 220);
  }

  // ---------- Trazado ----------
  // En los números de varias cifras todo es más pequeño, pero sin dejar de
  // ser generoso con el dedo.
  function tolerance() { return Math.max(9, TOLERANCE * state.ws); }
  function startRadius() { return Math.max(11, START_RADIUS * state.ws); }

  function startDemo() {
    if (state.done || state.tracing) return;
    state.demo = { stroke: state.current, pos: state.progress, wait: 0.2, alpha: 1, finished: false };
  }

  function stopDemo() {
    clearTimeout(demoTimer);
    state.demo = null;
  }

  function advance(p) {
    var cur = state.strokes[state.current];
    if (!cur) return;
    var pts = cur.pts, n = pts.length;
    var last = Math.min(n - 1, state.progress + LOOKAHEAD);
    var best = -1;
    for (var j = state.progress; j <= last; j++) {
      if (dist(pts[j], p) <= tolerance()) best = j;
    }
    if (best > state.progress) {
      state.progress = best;
      sfx.tick(best / (n - 1));
      if (Math.random() < 0.5) sparkle(pts[best], 1, 14);
    }
    if (state.progress >= n - 3) completeStroke(p);
  }

  function completeStroke(p) {
    var cur = state.strokes[state.current];
    sparkle(cur.pts[cur.pts.length - 1], 14, 30);
    state.current++;
    state.progress = 0;
    if (state.current >= state.strokes.length) {
      finishItem();
      return;
    }
    sfx.stroke();
    // Si el siguiente trazo empieza justo donde está el dedo, se puede seguir sin levantarlo.
    if (dist(p, state.strokes[state.current].pts[0]) > startRadius()) state.tracing = false;
  }

  function finishItem() {
    var l = item();
    state.done = true;
    state.doneAt = performance.now();
    state.tracing = false;
    saved.stars[l.key] = true;
    persist();
    updateAlphabet();
    var stars = document.querySelector('.stars');
    stars.classList.remove('bump');
    void stars.offsetWidth;
    stars.classList.add('bump');

    sfx.win();
    state.strokes.forEach(function (st) {
      for (var i = 0; i < st.pts.length; i += 12) sparkle(st.pts[i], 2, 26);
    });
    setTimeout(function () { sayPhrase(l.win); }, 450);
    clearTimeout(celebrateTimer);
    celebrateTimer = setTimeout(showCelebrate, 1100);
  }

  canvas.addEventListener('pointerdown', function (e) {
    ensureAudio();
    if (state.pointerId !== null || state.done) return;
    e.preventDefault();
    stopDemo();
    state.pointerId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    var p = toLetter(e);
    state.lastPt = p;
    var head = state.strokes[state.current].pts[state.progress];
    if (dist(p, head) <= startRadius()) {
      state.tracing = true;
      advance(p);
    } else {
      state.tracing = false;
      state.missAt = performance.now();
      sfx.miss();
    }
    sparkle(p, 3, 12);
  });

  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerId !== state.pointerId || state.done) return;
    var p = toLetter(e);
    var prev = state.lastPt || p;
    if (!state.tracing) {
      // Si el dedo llega al punto de salida, empezamos.
      var head = state.strokes[state.current].pts[state.progress];
      if (dist(p, head) <= startRadius() * 0.8) state.tracing = true;
    }
    if (state.tracing) {
      // Rellenamos el hueco entre dos eventos para que un movimiento rápido no se pierda.
      var steps = Math.max(1, Math.ceil(dist(prev, p) / 2));
      for (var i = 1; i <= steps && state.tracing && !state.done; i++) {
        var f = i / steps;
        advance([prev[0] + (p[0] - prev[0]) * f, prev[1] + (p[1] - prev[1]) * f]);
      }
    }
    if (Math.random() < 0.35) sparkle(p, 1, 8);
    state.lastPt = p;
  });

  function endPointer(e) {
    if (e.pointerId !== state.pointerId) return;
    state.pointerId = null;
    state.tracing = false;
    state.lastPt = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- Celebración y confeti ----------
  var confetti = [];
  var confettiRunning = false;

  function showCelebrate() {
    var l = item();
    setEmoji($('celEmoji'), l, l.celEmoji);
    $('celWord').innerHTML = l.wordHTML;
    celebrateEl.hidden = false;
    launchConfetti();
    $('goNextBtn').focus({ preventScroll: true });
  }

  function hideCelebrate() {
    clearTimeout(celebrateTimer);
    celebrateEl.hidden = true;
  }

  function launchConfetti() {
    var w = window.innerWidth, h = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = w * dpr;
    confettiCanvas.height = h * dpr;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var colors = COLORS.concat(['#ffffff', '#ffd23f']);
    for (var i = 0; i < 140; i++) {
      var fromLeft = i % 2 === 0;
      confetti.push({
        x: fromLeft ? -10 : w + 10,
        y: h * (0.55 + Math.random() * 0.4),
        vx: (fromLeft ? 1 : -1) * (180 + Math.random() * 420),
        vy: -(420 + Math.random() * 520),
        w: 7 + Math.random() * 7, h: 10 + Math.random() * 8,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
        color: colors[(Math.random() * colors.length) | 0],
        life: 3 + Math.random() * 1.5
      });
    }
    if (!confettiRunning) {
      confettiRunning = true;
      var last = performance.now();
      requestAnimationFrame(function step(now) {
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        cctx.clearRect(0, 0, w, h);
        for (var i = confetti.length - 1; i >= 0; i--) {
          var c = confetti[i];
          c.vy += 900 * dt;
          c.vx *= 0.99;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.rot += c.vr * dt;
          c.life -= dt;
          if (c.life <= 0 || c.y > h + 40) { confetti.splice(i, 1); continue; }
          cctx.save();
          cctx.translate(c.x, c.y);
          cctx.rotate(c.rot);
          cctx.scale(1, Math.cos(c.rot * 1.7));
          cctx.fillStyle = c.color;
          cctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
          cctx.restore();
        }
        if (confetti.length) requestAnimationFrame(step);
        else { confettiRunning = false; cctx.clearRect(0, 0, w, h); }
      });
    }
  }

  // ---------- Botones ----------
  function go(delta) {
    ensureAudio();
    sfx.click();
    loadItem(state.index + delta);
  }

  $('prevBtn').addEventListener('click', function () { go(-1); });
  $('nextBtn').addEventListener('click', function () { go(1); });
  $('goNextBtn').addEventListener('click', function () { go(1); });
  $('againBtn').addEventListener('click', function () { ensureAudio(); sfx.click(); restartItem(); });
  $('resetBtn').addEventListener('click', function () { ensureAudio(); sfx.click(); restartItem(); });

  $('demoBtn').addEventListener('click', function () {
    ensureAudio();
    if (state.done) restartItem();
    else startDemo();
  });

  function speakWord() {
    ensureAudio();
    sayPhrase(item().listen);
    var card = $('wordCard');
    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
  }
  $('listenBtn').addEventListener('click', speakWord);
  $('wordCard').addEventListener('click', speakWord);

  function renderSoundBtn() {
    var b = $('soundBtn');
    b.textContent = saved.muted ? '🔕' : '🔔';
    b.setAttribute('aria-label', saved.muted ? 'Poner el sonido' : 'Quitar el sonido');
  }
  $('soundBtn').addEventListener('click', function () {
    saved.muted = !saved.muted;
    if (saved.muted) stopVoice();
    persist();
    renderSoundBtn();
    ensureAudio();
    sfx.click();
  });

  // Cambiar de sección (ABC / 123)
  var tabs = document.querySelectorAll('.tab');

  function setMode(mode, opts) {
    if (!MODES[mode]) mode = 'letras';
    state.mode = mode;
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-mode') === mode;
      tabs[i].classList.toggle('active', on);
      tabs[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    document.body.setAttribute('data-mode', mode);
    if (location.hash !== '#' + mode) {
      try { history.replaceState(null, '', '#' + mode); } catch (e) { /* nada */ }
    }
    buildAlphabet();
    loadItem(saved.pos[mode] || 0, opts);
  }

  Array.prototype.forEach.call(tabs, function (tab) {
    tab.addEventListener('click', function () {
      var mode = tab.getAttribute('data-mode');
      if (mode === state.mode) return;
      ensureAudio();
      sfx.click();
      setMode(mode);
    });
  });

  // Teclado (para mayores): flechas, letras y cifras
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key.length === 1) {
      var k = e.key.toUpperCase();
      var idx = items().findIndex(function (l) { return l.label === k; });
      if (idx >= 0) { ensureAudio(); loadItem(idx); }
    }
  });

  // ---------- Arranque ----------
  renderSoundBtn();
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);

  var hashMode = location.hash.slice(1);
  setMode(MODES[hashMode] ? hashMode : saved.mode, { silent: true });
  demoTimer = setTimeout(startDemo, 700);

  var lastFrame = performance.now();
  requestAnimationFrame(function frame(now) {
    var dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    update(dt);
    draw(now);
    requestAnimationFrame(frame);
  });
})();
