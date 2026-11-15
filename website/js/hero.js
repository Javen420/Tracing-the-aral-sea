/* Plate 00: auto-playing time-lapse of the 9 NISAR 12-day windows with a ticking area counter,
   ending on the June-to-October loss map. Steps through A.WIN (same windows, labels and areas as
   Plates 04 and 06); each frame shows the radar pass at the end of its window. */
(function (A) {
  "use strict";
  var $ = A.$, P = A.PASSES, W = A.WIN;
  var a = $("heroA"), b = $("heroB"), chg = $("heroChange"), km = $("heroKm"), win = $("heroWin"), delta = $("heroDelta");
  var stamp = $("heroStamp"), stamp2 = $("heroStamp2"), ticks = $("heroTicks"), btn = $("heroPlay");
  var i = 0, playing = !A.reduceMotion, timer = null;

  // radar image for a window: the pass that closes it (13–25 Sep has no 25 Sep pass, so use 13 Sep)
  function passFor(w) { return P.indexOf(w.sec) >= 0 ? w.sec : w.ref; }
  W.forEach(function () { ticks.appendChild(document.createElement("span")); });
  W.forEach(function (w) { (new Image()).src = A.paths.radar("north", passFor(w)); });   // preload the 9 frames (~1.2 MB)

  function show(k) {
    var w = W[k], last = k === W.length - 1;
    b.src = A.paths.radar("north", passFor(w)); b.style.opacity = 1;
    setTimeout(function () { a.src = b.src; b.style.opacity = 0; }, 650);
    stamp.textContent = "NISAR · " + A.winLabel(w).toUpperCase() + " 2026";
    A.countTo(km, w.n);
    km._v = km._v == null ? w.n : km._v;
    win.textContent = A.winLabel(w) + " 2026";
    A.each(ticks.children, function (t, j) { t.classList.toggle("on", j <= k); });
    chg.style.opacity = last ? 1 : 0; stamp2.style.opacity = last ? 1 : 0;
    delta.textContent = last ? "−" + Math.round(A.CHANGE.lost) + " km² since June" : "";
  }

  function next() { i = (i + 1) % W.length; show(i); timer = setTimeout(next, i === W.length - 1 ? 4200 : 1400); }
  function play() { playing = true; btn.textContent = "Pause"; btn.setAttribute("aria-label", "Pause the time-lapse"); clearTimeout(timer); timer = setTimeout(next, 900); }
  function pause() { playing = false; btn.textContent = "Play"; btn.setAttribute("aria-label", "Play the time-lapse"); clearTimeout(timer); }
  btn.addEventListener("click", function () { if (playing) pause(); else play(); });

  km._v = W[0].n; show(0);
  if (playing) play(); else { show(W.length - 1); btn.textContent = "Play"; }
})(window.ARAL);
