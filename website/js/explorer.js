/* Centre stage: radar explorer with brightness / coherence layers, fade and swipe. */
(function (A) {
  "use strict";
  var $ = A.$, P = A.PASSES;
  var st = { view: "full", layer: "hh", mode: "fade", a: 0, b: P.length - 1, fade: 100, swipe: 50, water: true };
  var vBase = $("vBase"), vTop = $("vTop"), vWater = $("vWater"), selA = $("selA"), selB = $("selB"), fade = $("fadeRange");

  P.forEach(function (p, i) {
    [selA, selB].forEach(function (sel) {
      var o = document.createElement("option"); o.value = i; o.textContent = p.l; sel.appendChild(o);
    });
  });

  var ticks = $("ticks");
  P.forEach(function (p, i) {
    var b = document.createElement("button"); b.type = "button"; b.className = "tick real";
    b.innerHTML = "<i></i><span></span>"; b.querySelector("span").textContent = p.s; b.setAttribute("aria-label", p.l);
    b.addEventListener("click", function () {
      if (i === 0) { st.a = 0; st.b = 1; st.fade = 0; } else { st.b = i; st.a = i - 1; st.fade = 100; }
      stop(); render();
    });
    p._tick = b; ticks.appendChild(b);
  });

  function image(p) {
    return st.layer === "hh" ? A.paths.radar(st.view, p.id) : A.paths.coherence(st.view, A.winFor(p).tag);
  }

  function render() {
    if (st.a >= st.b) { if (st.b > 0) st.a = st.b - 1; else { st.a = 0; st.b = 1; } }
    var pa = P[st.a], pb = P[st.b], wb = A.winFor(pb), coh = st.layer === "coh";

    vBase.src = image(pa); vTop.src = image(pb); vWater.src = A.paths.water(st.view, wb.tag);
    vBase.alt = "NISAR " + (coh ? "coherence, " : "radar image, ") + pa.l;
    vTop.alt = "NISAR " + (coh ? "coherence, " : "radar image, ") + pb.l;
    vWater.alt = "Mapped water, " + A.winLabel(wb);

    selA.value = st.a; selB.value = st.b; fade.value = st.mode === "fade" ? st.fade : st.swipe;
    var showB = st.mode === "fade" ? st.fade / 100 : 1;
    vTop.style.opacity = showB; vWater.style.opacity = st.water ? showB : 0;
    var clip = st.mode === "swipe" ? "inset(0 0 0 " + st.swipe + "%)" : "none";
    vTop.style.clipPath = clip; vWater.style.clipPath = clip;
    $("swLine").hidden = $("swKnob").hidden = st.mode !== "swipe";
    $("swLine").style.left = st.swipe + "%"; $("swKnob").style.left = st.swipe + "%";
    $("fadeLbl").textContent = st.mode === "fade" ? "Show the later pass: " + st.fade + "%" : "Swipe position: " + st.swipe + "%";

    $("tagA").textContent = coh ? A.winLabel(A.winFor(pa)) : pa.s;
    $("tagB").textContent = coh ? A.winLabel(wb) : pb.s;
    $("tagA").style.opacity = (st.mode === "fade" && st.fade > 60) ? 0.35 : 1;
    $("tagB").style.opacity = (st.mode === "fade" && st.fade < 40) ? 0.35 : 1;

    $("lgGrad").style.background = coh ? "linear-gradient(90deg,#000,#fff)" : "";
    $("lgLo").textContent = coh ? "0 · changed (water)" : "Smooth · calm water";
    $("lgHi").textContent = coh ? "1 · unchanged" : "Rough · dry ground";

    var north = st.view === "north";
    $("lblS").hidden = north;
    $("lblN").style.left = north ? "40%" : "62%"; $("lblN").style.top = north ? "10%" : "9%";
    $("extFull").setAttribute("aria-pressed", !north); $("extNorth").setAttribute("aria-pressed", north);
    $("lyrHH").setAttribute("aria-pressed", !coh); $("lyrCoh").setAttribute("aria-pressed", coh);
    $("modeFade").setAttribute("aria-pressed", st.mode === "fade"); $("modeSwipe").setAttribute("aria-pressed", st.mode === "swipe");
    P.forEach(function (p) { p._tick.classList.toggle("on", p === pb); });

    $("dcDate").textContent = pb.l;
    $("dcChip").innerHTML = '<span class="chip measured">Water mapped from coherence</span>';
    $("dcWx").textContent = pb.wx; $("dcWin").textContent = A.winLabel(wb);
    $("dcN").textContent = A.km(wb.n); $("dcS").textContent = A.km(wb.s);
  }

  fade.addEventListener("input", function () { if (st.mode === "fade") st.fade = +fade.value; else st.swipe = +fade.value; stop(); render(); });
  selA.addEventListener("change", function () { st.a = +selA.value; if (st.a >= st.b) st.b = Math.min(st.a + 1, P.length - 1); render(); });
  selB.addEventListener("change", function () { st.b = +selB.value; render(); });
  $("chkWater").addEventListener("change", function (e) { st.water = e.target.checked; render(); });
  $("extFull").addEventListener("click", function () { st.view = "full"; render(); });
  $("extNorth").addEventListener("click", function () { st.view = "north"; render(); });
  $("lyrHH").addEventListener("click", function () { st.layer = "hh"; render(); });
  $("lyrCoh").addEventListener("click", function () { st.layer = "coh"; render(); });
  $("modeFade").addEventListener("click", function () { st.mode = "fade"; render(); });
  $("modeSwipe").addEventListener("click", function () { st.mode = "swipe"; render(); });

  // drag on the image to move the swipe line
  var viewer = $("viewer"), dragging = false;
  function setSwipe(ev) {
    var r = viewer.getBoundingClientRect();
    st.swipe = Math.max(0, Math.min(100, Math.round((ev.clientX - r.left) / r.width * 100))); render();
  }
  viewer.addEventListener("pointerdown", function (ev) { if (st.mode !== "swipe") return; dragging = true; viewer.setPointerCapture(ev.pointerId); setSwipe(ev); });
  viewer.addEventListener("pointermove", function (ev) { if (dragging) setSwipe(ev); });
  viewer.addEventListener("pointerup", function () { dragging = false; });

  // play: fade through every pass in turn
  var timer = null, playIco = $("playIco");
  function stop() {
    if (!timer) return;
    clearInterval(timer); timer = null;
    playIco.setAttribute("d", "M5 3l10 6-10 6z"); $("play").setAttribute("aria-label", "Play through all passes");
  }
  $("play").addEventListener("click", function () {
    if (timer) { stop(); return; }
    st.mode = "fade"; st.a = 0; st.b = 1; st.fade = 0; render();
    playIco.setAttribute("d", "M4 3h4v12H4zM10 3h4v12h-4z"); this.setAttribute("aria-label", "Pause");
    var step = A.reduceMotion ? 50 : 2;
    timer = setInterval(function () {
      st.fade += step;
      if (st.fade >= 100) {
        st.fade = 100;
        if (st.b < P.length - 1) { st.a = st.b; st.b++; st.fade = 0; } else { render(); stop(); return; }
      }
      render();
    }, A.reduceMotion ? 600 : 40);
  });

  // preload radar images so fades don't flash
  ["full", "north"].forEach(function (v) { P.forEach(function (p) { (new Image()).src = A.paths.radar(v, p.id); }); });
  render();
})(window.ARAL);
