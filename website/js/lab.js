/* Plate 04: threshold lab. Coherence for the North Aral (960×650 px, ~161 m pixels) is stored as an
   8-bit PNG (value = 1 + 254 × coherence, 0 = no data). Moving the slider re-runs the same steps as
   coherence_water.py in the browser: below cut-off → connected to the lake → enclosed gaps filled. */
(function (A) {
  "use strict";
  var $ = A.$, W = A.WIN, cv = $("labCanvas"), ctx = cv.getContext("2d");
  var WD = 960, HT = 650, PIX_KM2 = (155000 / 960) * (105000 / 650) / 1e6;
  var SEED = { x0: 341, x1: 446, y0: 217, y1: 309 }, MAX_HOLE = Math.round(50 / PIX_KM2);
  var sel = $("labWin"), thr = $("labThr"), coh = null, win = W[W.length - 1], pending = false, refArea = null;

  W.forEach(function (w, i) {
    var o = document.createElement("option"); o.value = i; o.textContent = A.winLabel(w) + " 2026" + (w.days > 12 ? " (24 days)" : "");
    sel.appendChild(o);
  });
  sel.value = W.length - 1;

  function load(i) {
    win = W[i]; var im = new Image();
    im.onload = function () {
      ctx.drawImage(im, 0, 0, WD, HT);
      try { coh = ctx.getImageData(0, 0, WD, HT).data; }
      catch (e) { coh = null; $("labNote").textContent = "Your browser blocked reading the image from disk. Run the site with npm start (a local server) to use the lab."; return; }
      // like-for-like reference: the lab's own area at our cut-off (red line), so both numbers match there
      thr.value = win.nthr; mark(); refArea = null; draw();
      refArea = lastArea; $("labRef").textContent = A.fmt(refArea);
      $("labFull").textContent = "Full-resolution pipeline (60 m, smoothed): " + A.fmt(win.n) + " km² at the same cut-off.";
    };
    im.src = A.paths.lab(win.tag);
  }

  var lastArea = 0;
  function mark() {
    var lo = +thr.min, hi = +thr.max, f = (win.nthr - lo) / (hi - lo);
    // thumb centre runs from thumb/2 to (width - thumb/2); 18px thumb is set in styles.css (.thr-wrap --thumb)
    $("labMark").style.left = "calc(9px + (100% - 18px) * " + f + ")";
  }

  function draw() {
    if (!coh) return;
    var t = +thr.value, cut = Math.round(1 + 254 * t), n = WD * HT, i, x, y;
    var low = new Uint8Array(n), lake = new Uint8Array(n), stack = new Int32Array(n), sp = 0;
    for (i = 0; i < n; i++) { var v = coh[i * 4]; low[i] = v > 0 && v <= cut ? 1 : 0; }
    // 1. flood-fill low coherence from the lake reference box
    for (y = SEED.y0; y <= SEED.y1; y++) for (x = SEED.x0; x <= SEED.x1; x++) { i = y * WD + x; if (low[i] && !lake[i]) { lake[i] = 1; stack[sp++] = i; } }
    while (sp) { i = stack[--sp]; x = i % WD; y = (i - x) / WD;
      if (x > 0 && low[i - 1] && !lake[i - 1]) { lake[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < WD - 1 && low[i + 1] && !lake[i + 1]) { lake[i + 1] = 1; stack[sp++] = i + 1; }
      if (y > 0 && low[i - WD] && !lake[i - WD]) { lake[i - WD] = 1; stack[sp++] = i - WD; }
      if (y < HT - 1 && low[i + WD] && !lake[i + WD]) { lake[i + WD] = 1; stack[sp++] = i + WD; } }
    // 2. fill enclosed gaps smaller than 50 km² (label each gap, then fill the small ones)
    var seen = new Uint8Array(n), comp = new Int32Array(n);
    for (var s = 0; s < n; s++) {
      if (lake[s] || seen[s]) continue;
      var cn = 0, edge = false; sp = 0; stack[sp++] = s; seen[s] = 1;
      while (sp) { i = stack[--sp]; comp[cn++] = i; x = i % WD; y = (i - x) / WD;
        if (x === 0 || y === 0 || x === WD - 1 || y === HT - 1) edge = true;
        if (x > 0 && !lake[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[sp++] = i - 1; }
        if (x < WD - 1 && !lake[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[sp++] = i + 1; }
        if (y > 0 && !lake[i - WD] && !seen[i - WD]) { seen[i - WD] = 1; stack[sp++] = i - WD; }
        if (y < HT - 1 && !lake[i + WD] && !seen[i + WD]) { seen[i + WD] = 1; stack[sp++] = i + WD; } }
      if (!edge && cn < MAX_HOLE) for (var k = 0; k < cn; k++) lake[comp[k]] = 2;
    }
    // 3. paint: grey coherence, dark for unconnected low coherence, blue for lake
    var out = ctx.createImageData(WD, HT), o = out.data, count = 0;
    for (i = 0; i < n; i++) {
      var g = coh[i * 4], j = i * 4;
      if (lake[i]) { o[j] = 47; o[j + 1] = 120; o[j + 2] = 176; count++; }
      else if (g === 0) { o[j] = 24; o[j + 1] = 33; o[j + 2] = 36; }
      else if (low[i]) { o[j] = o[j + 1] = o[j + 2] = 34; }
      else { var c = 120 + Math.round(g * 0.52); o[j] = c; o[j + 1] = c - 4; o[j + 2] = c - 14; }
      o[j + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    var area = count * PIX_KM2; lastArea = area;
    $("labKm").textContent = A.fmt(area);
    $("labThrVal").textContent = t.toFixed(2);
    var base = refArea == null ? area : refArea, d = area - base, pct = d / base * 100;
    $("labNote").textContent = Math.abs(t - win.nthr) < 0.005
      ? "This is our cut-off (red line). Drag the slider to see how the shoreline and area respond."
      : (d > 0 ? "Looser cut-off: " : "Stricter cut-off: ") + (d > 0 ? "+" : "") + A.fmt(d) + " km² (" + (pct > 0 ? "+" : "") + pct.toFixed(1) + "%). " +
        (t > 0.3 ? "Too loose: changing land, like wet mud and reeds, starts leaking in." : t < 0.11 ? "Too strict: real water drops out, because coherence over water is about 0.10, not zero." : "Small moves near our value barely change the shoreline; that's what the ±0.02 band in Plate 06 shows.");
  }

  thr.addEventListener("input", function () { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; draw(); }); });
  sel.addEventListener("change", function () { load(+sel.value); });
  $("labReset").addEventListener("click", function () { thr.value = win.nthr; draw(); });
  A.onVisible(cv, function () { load(+sel.value); });
})(window.ARAL);
