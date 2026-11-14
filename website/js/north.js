/* Chapter 3: 12-day windows, North Aral map with change overlay, and the area chart. */
(function (A) {
  "use strict";
  var $ = A.$, WIN = A.WIN, sel = WIN.length - 1, basin = "N";

  // window strip
  var strip = $("strip");
  WIN.forEach(function (w, i) {
    var b = document.createElement("button"); b.type = "button"; b.className = "pass";
    b.innerHTML = '<span class="thumb"><img alt=""></span><span class="pd"></span><span class="small"></span>';
    b.querySelector("img").src = A.paths.coherence("north", w.tag);
    b.querySelector(".pd").textContent = A.winLabel(w);
    b.querySelector(".small").textContent = A.km(w.n);
    b.setAttribute("aria-label", "12 days from " + A.shortDate(w.ref) + " to " + A.shortDate(w.sec) + ": North Aral " + A.km(w.n));
    b.addEventListener("click", function () { sel = i; update(); });
    w._b = b; strip.appendChild(b);
  });

  function passFor(id) { for (var i = 0; i < A.PASSES.length; i++) if (A.PASSES[i].id === id) return A.PASSES[i]; return null; }

  function update() {
    var w = WIN[sel], p = passFor(w.sec), chg = $("chkChange").checked;
    WIN.forEach(function (q, i) { q._b.setAttribute("aria-pressed", i === sel); });
    $("nImg").src = p ? A.paths.radar("north", p.id) : A.paths.coherence("north", w.tag);
    $("nImg").alt = "NISAR image of the North Aral, " + (p ? p.l : A.winLabel(w));
    $("nWater").src = A.paths.water("north", w.tag); $("nWater").alt = "Mapped water, " + A.winLabel(w);
    $("nChange").src = A.paths.change("north");
    $("nChange").style.opacity = chg ? 1 : 0; $("nWater").style.opacity = chg ? 0 : 1; $("chgKey").hidden = !chg;
    $("nCap").textContent = chg
      ? "Water present 21 Jun–3 Jul compared with 7–19 Oct. Orange: lost; teal: gained; blue: in both."
      : "12 days from " + A.shortDate(w.ref) + " to " + A.shortDate(w.sec) + " 2026. North Aral open water: " + A.km(w.n) +
        " (" + A.km(w.nlo) + " to " + A.km(w.nhi) + ")." +
        (p ? " Background: radar brightness on " + p.l + "." : " Background: coherence (no brightness image for 25 Sep).");
    drawChart();
  }
  $("chkChange").addEventListener("change", update);

  // hand-drawn SVG chart (no library)
  function drawChart() {
    var svg = $("chart"), W = 440, H = 300, L = 56, R = 14, T = 18, B = 46, N = basin === "N";
    var key = N ? ["n", "nlo", "nhi"] : ["s", "slo", "shi"];
    var y0 = N ? 2850 : 1700, y1 = N ? 3120 : 1800, stepv = N ? 50 : 20, colW = (W - L - R) / WIN.length;
    function x(i) { return L + colW * (i + 0.5); }
    function y(v) { return T + (H - T - B) * (1 - (v - y0) / (y1 - y0)); }
    var s = "";
    for (var v = y0; v <= y1 + 0.1; v += stepv) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#CFE3D8"/>' +
           '<text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#47635B" font-family="IBM Plex Mono, monospace">' + v.toLocaleString("en-US") + "</text>";
    }
    var mid = T + (H - T - B) / 2;
    s += '<text x="12" y="' + mid + '" font-size="11" fill="#47635B" transform="rotate(-90 12 ' + mid + ')" text-anchor="middle">Open water, km²</text>';
    if (N) {
      var yo = y(A.OFFICIAL_NORTH_KM2);
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yo + '" y2="' + yo + '" stroke="#1F6FA6" stroke-dasharray="4 4"/>' +
           '<text x="' + (W - R) + '" y="' + (yo - 6) + '" text-anchor="end" font-size="11" fill="#1F6FA6">Officially reported ≈3,065</text>';
    }
    s += '<path d="M' + WIN.map(function (w, i) { return x(i) + "," + y(w[key[0]]); }).join("L") + '" fill="none" stroke="#0C6E5F" stroke-width="2" opacity=".6"/>';
    WIN.forEach(function (w, i) {
      var cx = x(i), on = i === sel, col = on ? "#10302A" : "#47635B", fw = on ? 700 : 400;
      s += '<text x="' + cx + '" y="' + (H - B + 16) + '" text-anchor="middle" font-size="10" fill="' + col + '" font-weight="' + fw + '">' + A.shortDate(w.ref) + "</text>";
      s += '<text x="' + cx + '" y="' + (H - B + 29) + '" text-anchor="middle" font-size="10" fill="' + col + '" font-weight="' + fw + '">' + A.shortDate(w.sec) + "</text>";
      if (on) s += '<rect x="' + (cx - colW / 2) + '" y="' + T + '" width="' + colW + '" height="' + (H - T - B) + '" fill="#0C6E5F" opacity=".07"/>';
      s += '<line x1="' + cx + '" x2="' + cx + '" y1="' + y(w[key[1]]) + '" y2="' + y(w[key[2]]) + '" stroke="#0C6E5F" stroke-width="4" stroke-linecap="round" opacity=".3"/>';
      s += '<circle cx="' + cx + '" cy="' + y(w[key[0]]) + '" r="' + (on ? 6.5 : 4.5) + '" fill="#0C6E5F" stroke="#fff" stroke-width="2"/>';
      if (on) s += '<text x="' + cx + '" y="' + (y(w[key[2]]) - 9) + '" text-anchor="' + (i > WIN.length - 3 ? "end" : "middle") + '" font-size="12" font-weight="600" fill="#10302A" font-family="IBM Plex Mono, monospace">' + Math.round(w[key[0]]).toLocaleString("en-US") + "</text>";
    });
    svg.innerHTML = s;
    var f = WIN[0][key[0]], l = WIN[WIN.length - 1][key[0]];
    $("chartNote").textContent = (N ? "North Aral" : "South-west basin") + ": " + Math.round(f).toLocaleString("en-US") + " → " +
      Math.round(l).toLocaleString("en-US") + " km² (" + ((l - f) / f * 100).toFixed(1) + "%) from late June to mid October." +
      (N ? " Most loss is in shallow bays; area partly rebounds in late September."
         : " Steep western shores mean area barely changes even when the level falls.");
  }

  function setBasin(b) {
    basin = b; $("bN").setAttribute("aria-pressed", b === "N"); $("bS").setAttribute("aria-pressed", b === "S"); drawChart();
  }
  $("bN").addEventListener("click", function () { setBasin("N"); });
  $("bS").addEventListener("click", function () { setBasin("S"); });
  update();
})(window.ARAL);
