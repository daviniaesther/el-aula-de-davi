/*
 * Números del 0 al 100 para trazar.
 *
 * Los dígitos se definen igual que las letras (trazos de puntos [x, y] en
 * una rejilla de 100 × 100). Los números de varias cifras se montan
 * encogiendo cada dígito y colocándolos uno al lado del otro; se trazan
 * de izquierda a derecha.
 */
(function () {
  'use strict';

  function P() {
    var pts = [];
    for (var i = 0; i < arguments.length; i += 2) pts.push([arguments[i], arguments[i + 1]]);
    return pts;
  }

  function arc(cx, cy, rx, ry, a0, a1) {
    var n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 4));
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var a = ((a0 + (a1 - a0) * i / n) * Math.PI) / 180;
      pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return pts;
  }

  function S() {
    return [].concat.apply([], arguments);
  }

  var DIGITS = [
    // 0: óvalo desde arriba, hacia la izquierda
    [arc(50, 50, 25, 40, -90, -450)],
    // 1: subida corta y bajada recta
    [P(34, 26, 54, 10, 54, 90)],
    // 2: curva, diagonal y base
    [S(arc(50, 33, 23, 23, -160, 20), P(71.6, 40.9, 26, 90, 76, 90))],
    // 3: dos barrigas
    [S(arc(48, 30, 22, 20, -150, 90), arc(48, 70, 24, 20, -90, 150))],
    // 4: diagonal y raya; luego el palo
    [P(60, 10, 22, 64, 80, 64), P(60, 10, 60, 90)],
    // 5: palo y barriga; luego el sombrero
    [S(P(32, 10, 28.8, 47.3), arc(48, 64, 25, 26, -140, 150)), P(32, 10, 72, 10)],
    // 6: bajada curva y vuelta abajo
    [S(arc(52, 52, 26, 40, -60, -180), arc(51, 68, 25, 22, 180, -180))],
    // 7: raya y diagonal
    [P(24, 10, 76, 10, 40, 90)],
    // 8: una sola línea que se cruza en el centro
    [S(arc(50, 29, 20, 19, -90, -270), arc(50, 69, 23, 21, -90, 270), arc(50, 29, 20, 19, 90, -90))],
    // 9: bolita y palo
    [S(arc(50, 32, 23, 22, 0, -360), P(73, 32, 72, 90))]
  ];

  // Colocación según el número de cifras: escala y centro de cada cifra.
  var LAYOUT = {
    1: { scale: 1, centers: [50] },
    2: { scale: 0.68, centers: [28, 72] },
    3: { scale: 0.5, centers: [20, 50, 80] }
  };

  var UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho',
    'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
    'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  var TENS = { 3: 'treinta', 4: 'cuarenta', 5: 'cincuenta', 6: 'sesenta', 7: 'setenta', 8: 'ochenta', 9: 'noventa' };

  function numberName(n) {
    if (n === 100) return 'cien';
    if (n < 30) return UNITS[n];
    var u = n % 10;
    return TENS[(n - u) / 10] + (u ? ' y ' + UNITS[u] : '');
  }

  function build(n) {
    var chars = String(n).split('');
    var layout = LAYOUT[chars.length];
    var strokes = [];
    chars.forEach(function (c, i) {
      var cx = layout.centers[i];
      DIGITS[+c].forEach(function (stroke) {
        strokes.push(stroke.map(function (p) {
          return [cx + (p[0] - 50) * layout.scale, 50 + (p[1] - 50) * layout.scale];
        }));
      });
    });
    return { n: n, name: numberName(n), scale: layout.scale, strokes: strokes };
  }

  var numbers = [];
  for (var n = 0; n <= 100; n++) numbers.push(build(n));
  window.NUMBERS = numbers;
})();
