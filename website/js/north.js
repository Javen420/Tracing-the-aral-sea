/* Plate 06: nine small-multiple plates (one per coherence window) and the area chart,
   with radar values, the ±0.02 threshold band and Sentinel-2 comparison points. */
(function (A) {
  "use strict";
  var $ = A.$, WIN = A.WIN, sel = WIN.length - 1, basin = "N", grid = $("plates9");

  WIN.forEach(function (w, i) {
    var b = document.createElement("button"); b.type = "button"; b.className = "p9";
    b.innerHTML = '<span class="im"><img alt="" loading="lazy"><img alt="" loading="lazy"></span><span class="meta"><span class="d"></span><span class="v"></span></span>';
    var ims = b.querySelectorAll("img");
    ims[0].src = A.paths.coherence("north", w.tag); ims[1].src = A.paths.water("north", w.tag);
    b.querySelector(".d").textContent = A.winLabel(w) + (w.days > 12 ? " · 24 d" : "");
    if (w.days > 12) b.querySelector(".d").className = "d long";
    b.querySelector(".v").textContent = A.km(w.n);
    b.setAttribute("aria-label", "Window " + A.winLabel(w) + ": North Aral " + A.km(w.n));
    b.addEventListener("click", function () { sel = i; update(); });
    w._b = b; grid.appendChild(b);
  });

  function update() { WIN.forEach(function (w, i) { w._b.setAttribute("aria-pressed", i === sel); }); draw(); }

  function draw() {
    var svg = $("chart"), W = 520, H = 340, L = 64, R = 16, T = 22, B = 56, N = basin === "N";
    var k = N ? ["n", "nlo", "nhi"] : ["s", "slo", "shi"], s2k = N ? "s2N" : "s2S";
    var y0 = N ? 2850 : 1650, y1 = N ? 3150 : 1850, stepv = N ? 50 : 50, colW = (W - L - R) / WIN.length;
    function x(i) { return L + colW * (i + 0.5); }
    function y(v) { return T + (H - T - B) * (1 - (v - y0) / (y1 - y0)); }
    function clampY(v) { return Math.max(T, Math.min(H - B, y(v))); }
    var s = '<defs><pattern id="hp" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="7" fill="#B8860B" opacity=".55"/></pattern></defs>';
    for (var v = y0; v <= y1 + 0.1; v += stepv) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#C8BB9C" stroke-width="1"/>' +
           '<text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="12" fill="#5B5345" font-family="IBM Plex Mono, monospace">' + v.toLocaleString("en-US") + "</text>";
    }
    s += '<text x="' + L + '" y="12" font-size="12" fill="#5B5345" font-family="IBM Plex Mono, monospace">km² open water</text>';
    // uncertainty band
    var top = WIN.map(function (w, i) { return x(i) + "," + y(w[k[2]]); }), bot = WIN.map(function (w, i) { return x(i) + "," + y(w[k[1]]); }).reverse();
    s += '<polygon points="' + top.concat(bot).join(" ") + '" fill="url(#hp)" stroke="none"/>';
    if (N) { var yo = y(A.OFFICIAL_NORTH_KM2); s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yo + '" y2="' + yo + '" stroke="#1D5E8A" stroke-dasharray="5 4"/><text x="' + (W - R) + '" y="' + (yo - 7) + '" text-anchor="end" font-size="12" fill="#1D5E8A">Officially reported ≈3,065</text>'; }
    s += '<path d="M' + WIN.map(function (w, i) { return x(i) + "," + y(w[k[0]]); }).join("L") + '" fill="none" stroke="#1F1C17" stroke-width="2.2"/>';
    WIN.forEach(function (w, i) {
      var cx = x(i), on = i === sel, s2 = w[s2k], col = on ? "#1F1C17" : "#5B5345";
      if (on) s += '<rect x="' + (cx - colW / 2) + '" y="' + T + '" width="' + colW + '" height="' + (H - T - B) + '" fill="#1D5E8A" opacity=".08"/>';
      // optical area scaled to the full basin: radar area × (optical/radar in the cloud-free part)
      var optFull = w[k[0]] * (s2.optical / s2.radar);
      s += '<circle cx="' + cx + '" cy="' + clampY(optFull) + '" r="5.5" fill="#FBF8F1" stroke="#7B4FC9" stroke-width="2"' + (s2.usable < 70 ? ' stroke-dasharray="2 2"' : "") + '><title>Sentinel-2 ' + A.shortDate(s2.date) + ': ~' + A.fmt(optFull) + ' km² (F1 ' + s2.f1.toFixed(2) + ')</title></circle>';
      s += '<circle cx="' + cx + '" cy="' + y(w[k[0]]) + '" r="' + (on ? 7 : 5) + '" fill="#1F1C17" stroke="#FBF8F1" stroke-width="2"><title>NISAR ' + A.winLabel(w) + ': ' + A.km(w[k[0]]) + '</title></circle>';
      s += '<text x="' + cx + '" y="' + (H - B + 18) + '" text-anchor="middle" font-size="11.5" fill="' + col + '" font-weight="' + (on ? 700 : 400) + '" font-family="IBM Plex Mono, monospace">' + A.shortDate(w.ref) + '</text>';
      s += '<text x="' + cx + '" y="' + (H - B + 33) + '" text-anchor="middle" font-size="11.5" fill="' + col + '" font-weight="' + (on ? 700 : 400) + '" font-family="IBM Plex Mono, monospace">' + A.shortDate(w.sec) + '</text>';
      if (on) s += '<text x="' + Math.min(cx, W - R - 4) + '" y="' + (y(w[k[2]]) - 12) + '" text-anchor="' + (i > WIN.length - 3 ? "end" : "middle") + '" font-size="14" font-weight="700" fill="#1F1C17" font-family="IBM Plex Mono, monospace">' + A.fmt(w[k[0]]) + '</text>';
    });
    svg.innerHTML = s;
    var f = WIN[0][k[0]], l = WIN[WIN.length - 1][k[0]], w = WIN[sel];
    $("chartNote").textContent = (N ? "North Aral" : "South-west basin") + ": " + A.fmt(f) + " → " + A.fmt(l) + " km² (" + ((l - f) / f * 100).toFixed(1) + "%) from late June to mid October. " +
      (N ? "Most loss is in shallow bays; the area rebounds slightly in late September." : "Steep western shores mean the area barely changes even when the level falls.") +
      " Selected: " + A.winLabel(w) + ", Sentinel-2 agreement F1 " + w[s2k].f1.toFixed(2) + ".";
  }

  function setBasin(b) { basin = b; $("bN").setAttribute("aria-pressed", b === "N"); $("bS").setAttribute("aria-pressed", b === "S"); draw(); }
  $("bN").addEventListener("click", function () { setBasin("N"); });
  $("bS").addEventListener("click", function () { setBasin("S"); });
  update();
})(window.ARAL);
