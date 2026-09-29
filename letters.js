/*
 * Letras mayúsculas para trazar.
 *
 * Cada letra tiene una lista de trazos y cada trazo es una lista de puntos
 * [x, y] sobre una rejilla de 100 × 100 (la y crece hacia abajo).
 * El orden de los puntos marca la dirección en la que se debe trazar,
 * y el orden de los trazos es el orden en que se hacen.
 *
 * `speak` (opcional) es cómo escribir el nombre para que la voz del
 * navegador lo pronuncie bien (p. ej. "ge" lo lee "gue").
 */
(function () {
  'use strict';

  // Polilínea: P(x1, y1, x2, y2, ...)
  function P() {
    var pts = [];
    for (var i = 0; i < arguments.length; i += 2) pts.push([arguments[i], arguments[i + 1]]);
    return pts;
  }

  // Arco de elipse. Ángulos en grados: 0 = derecha, 90 = abajo, -90 = arriba.
  // Si a1 < a0 el arco va en sentido antihorario (como se escribe la C o la O).
  function arc(cx, cy, rx, ry, a0, a1) {
    var n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 4));
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var a = ((a0 + (a1 - a0) * i / n) * Math.PI) / 180;
      pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return pts;
  }

  // Une varias piezas en un único trazo continuo.
  function S() {
    return [].concat.apply([], arguments);
  }

  // La virgulilla de la Ñ.
  function tilde() {
    var pts = [];
    for (var i = 0; i <= 24; i++) {
      var t = i / 24;
      pts.push([34 + 32 * t, 8 - 3.5 * Math.sin(t * 2 * Math.PI)]);
    }
    return pts;
  }

  var O = arc(50, 50, 34, 40, -90, -450);

  window.LETTERS = [
    { ch: 'A', name: 'a', word: 'Abeja', emoji: '🐝', strokes: [
      P(50, 10, 18, 90),
      P(50, 10, 82, 90),
      P(31, 62, 69, 62)
    ] },
    { ch: 'B', name: 'be', speak: 'bé', word: 'Ballena', emoji: '🐳', strokes: [
      P(25, 10, 25, 90),
      S(P(25, 10, 52, 10), arc(52, 29, 19, 19, -90, 90), P(52, 48, 25, 48)),
      S(P(25, 48, 55, 48), arc(55, 69, 21, 21, -90, 90), P(55, 90, 25, 90))
    ] },
    { ch: 'C', name: 'ce', word: 'Casa', emoji: '🏠', strokes: [
      arc(54, 50, 32, 40, -40, -320)
    ] },
    { ch: 'D', name: 'de', word: 'Dinosaurio', emoji: '🦕', strokes: [
      P(25, 10, 25, 90),
      S(P(25, 10, 42, 10), arc(42, 50, 36, 40, -90, 90), P(42, 90, 25, 90))
    ] },
    { ch: 'E', name: 'e', word: 'Elefante', emoji: '🐘', strokes: [
      P(28, 10, 28, 90),
      P(28, 10, 74, 10),
      P(28, 50, 66, 50),
      P(28, 90, 74, 90)
    ] },
    { ch: 'F', name: 'efe', word: 'Fresa', emoji: '🍓', strokes: [
      P(30, 10, 30, 90),
      P(30, 10, 74, 10),
      P(30, 50, 66, 50)
    ] },
    { ch: 'G', name: 'ge', speak: 'G', word: 'Gato', emoji: '🐱', strokes: [
      S(arc(54, 50, 32, 40, -40, -360), P(86, 50, 60, 50))
    ] },
    { ch: 'H', name: 'hache', word: 'Helado', emoji: '🍦', strokes: [
      P(25, 10, 25, 90),
      P(75, 10, 75, 90),
      P(25, 50, 75, 50)
    ] },
    { ch: 'I', name: 'i', word: 'Isla', emoji: '🏝️', strokes: [
      P(50, 10, 50, 90)
    ] },
    { ch: 'J', name: 'jota', word: 'Jirafa', emoji: '🦒', strokes: [
      S(P(64, 10, 64, 64), arc(44, 64, 20, 26, 0, 180))
    ] },
    { ch: 'K', name: 'ka', word: 'Koala', emoji: '🐨', strokes: [
      P(28, 10, 28, 90),
      P(74, 10, 28, 56),
      P(28, 56, 76, 90)
    ] },
    { ch: 'L', name: 'ele', word: 'León', emoji: '🦁', strokes: [
      P(30, 10, 30, 90, 74, 90)
    ] },
    { ch: 'M', name: 'eme', word: 'Manzana', emoji: '🍎', strokes: [
      P(18, 90, 18, 10),
      P(18, 10, 50, 62, 82, 10),
      P(82, 10, 82, 90)
    ] },
    { ch: 'N', name: 'ene', word: 'Nube', emoji: '☁️', strokes: [
      P(25, 90, 25, 10),
      P(25, 10, 75, 90),
      P(75, 90, 75, 10)
    ] },
    { ch: 'Ñ', name: 'eñe', word: 'Ñu', emoji: '🦬', strokes: [
      P(25, 90, 25, 26),
      P(25, 26, 75, 90),
      P(75, 90, 75, 26),
      tilde()
    ] },
    { ch: 'O', name: 'o', word: 'Oso', emoji: '🐻', strokes: [
      O
    ] },
    { ch: 'P', name: 'pe', word: 'Pato', emoji: '🦆', strokes: [
      P(27, 10, 27, 90),
      S(P(27, 10, 50, 10), arc(50, 31, 22, 21, -90, 90), P(50, 52, 27, 52))
    ] },
    { ch: 'Q', name: 'cu', speak: 'cú', word: 'Queso', emoji: '🧀', strokes: [
      O,
      P(60, 68, 82, 90)
    ] },
    { ch: 'R', name: 'erre', word: 'Ratón', emoji: '🐭', strokes: [
      P(27, 10, 27, 90),
      S(P(27, 10, 50, 10), arc(50, 31, 22, 21, -90, 90), P(50, 52, 27, 52)),
      P(46, 52, 76, 90)
    ] },
    { ch: 'S', name: 'ese', word: 'Sol', emoji: '☀️', strokes: [
      S(arc(50, 30, 26, 20, -20, -270), arc(50, 70, 28, 20, -90, 160))
    ] },
    { ch: 'T', name: 'te', word: 'Tortuga', emoji: '🐢', strokes: [
      P(18, 10, 82, 10),
      P(50, 10, 50, 90)
    ] },
    { ch: 'U', name: 'u', word: 'Uvas', emoji: '🍇', strokes: [
      S(P(25, 10, 25, 60), arc(50, 60, 25, 30, 180, 0), P(75, 60, 75, 10))
    ] },
    { ch: 'V', name: 'uve', word: 'Vaca', emoji: '🐮', strokes: [
      P(18, 10, 50, 90, 82, 10)
    ] },
    { ch: 'W', name: 'uve doble', word: 'Wafle', emoji: '🧇', strokes: [
      P(10, 10, 29, 90, 50, 36, 71, 90, 90, 10)
    ] },
    { ch: 'X', name: 'equis', word: 'Xilófono', emoji: '🎶', strokes: [
      P(22, 10, 78, 90),
      P(78, 10, 22, 90)
    ] },
    { ch: 'Y', name: 'i griega', word: 'Yoyó', emoji: '🪀', strokes: [
      P(20, 10, 50, 50),
      P(80, 10, 50, 50, 50, 90)
    ] },
    { ch: 'Z', name: 'zeta', word: 'Zapato', emoji: '👟', strokes: [
      P(22, 10, 78, 10, 22, 90, 78, 90)
    ] }
  ];
})();
