/* Plate 01: drag-to-compare history. The slider crossfades continuously between consecutive images;
   the card shows the entry nearest the slider. */
(function (A) {
  "use strict";
  var $ = A.$, TL = A.TIMELINE, N = TL.length;
  var range = $("histRange"), imA = $("histA"), imB = $("histB"), years = $("histYears"), stamp = $("histStamp");
  var STEP = 100, cur = -1, pairA = -1, pairB = -1;
  range.max = (N - 1) * STEP;

  TL.forEach(function (e, i) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = e.yr.split(" ").slice(-1)[0].replace("–", "–");
    b.title = e.yr + ": " + e.t; b.setAttribute("aria-label", e.yr + ": " + e.t);
    b.addEventListener("click", function () { glide(i * STEP); });
    years.appendChild(b);
    (new Image()).src = A.paths.history(e.img);
  });
  years.style.gridTemplateColumns = "repeat(" + N + ", minmax(0, 1fr))";

  function card(i) {
    if (i === cur) return; cur = i; var e = TL[i];
    $("histYr").textContent = e.yr; $("histTitle").textContent = e.t; $("histText").textContent = e.x;
    var chip = $("histChip"); chip.className = "chip " + (e.kind === "target" ? "target" : e.kind === "measured" ? "measured" : "done"); chip.textContent = e.label;
    var src = $("histSrc"); src.textContent = "Source: "; var a = document.createElement("a"); a.href = e.url; a.textContent = e.src; src.appendChild(a);
    $("histCredit").textContent = "Image: " + e.credit;
    stamp.textContent = e.yr.toUpperCase();
    A.each(years.children, function (b, j) { b.classList.toggle("on", j === i); });
    $("histPrev").disabled = i === 0; $("histNext").disabled = i === N - 1;
  }

  function render() {
    var v = +range.value, i = Math.floor(v / STEP), f = (v - i * STEP) / STEP;
    if (i >= N - 1) { i = N - 1; f = 0; }
    var j = Math.min(i + 1, N - 1);
    if (pairA !== i) { imA.src = A.paths.history(TL[i].img); imA.alt = TL[i].t + " (" + TL[i].yr + ")"; pairA = i; }
    if (pairB !== j) { imB.src = A.paths.history(TL[j].img); imB.alt = TL[j].t + " (" + TL[j].yr + ")"; pairB = j; }
    imB.style.opacity = f;
    card(Math.round(v / STEP));
  }

  var anim = null;
  function glide(to) {
    if (anim) cancelAnimationFrame(anim);
    var from = +range.value, t0 = performance.now(), dur = A.reduceMotion ? 0 : Math.min(1400, 250 + Math.abs(to - from) * 1.2);
    function tick(t) {
      var k = dur ? Math.min(1, (t - t0) / dur) : 1, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      range.value = from + (to - from) * e; render();
      if (k < 1) anim = requestAnimationFrame(tick);
    }
    anim = requestAnimationFrame(tick);
  }

  range.addEventListener("input", render);
  range.addEventListener("change", function () { glide(Math.round(+range.value / STEP) * STEP); });   // snap on release
  $("histPrev").addEventListener("click", function () { glide(Math.max(0, cur - 1) * STEP); });
  $("histNext").addEventListener("click", function () { glide(Math.min(N - 1, cur + 1) * STEP); });
  render();
})(window.ARAL);
