/* Plate 02: scroll-driven story. The map is sticky; each text step that reaches the middle of the
   screen switches which image layers are visible and updates the live counter. */
(function (A) {
  "use strict";
  var $ = A.$, frame = $("storyFrame"), layers = frame.querySelectorAll("img[data-s]"), steps = document.querySelectorAll("#storySteps .step");
  var km = $("storyKm"), stamp = $("storyStamp"), legend = $("storyLegend"), pin = $("storyPin");
  var S = {
    1: { stamp: "NISAR · BRIGHTNESS · 21 JUN", legend: "Dark = smooth · Bright = rough", km: null, pin: true },
    2: { stamp: "NISAR · BRIGHTNESS · 20 AUG", legend: "Calm day: the lake goes dark", km: null },
    3: { stamp: "NISAR · COHERENCE · 21 JUN–3 JUL", legend: "Black = changed · White = unchanged", km: null },
    4: { stamp: "WATER · 21 JUN–3 JUL", legend: "Open water, North Aral", km: A.WIN[0].n },
    5: { stamp: "WATER · 7–19 OCT", legend: "Open water, North Aral", km: A.WIN[8].n },
    6: { stamp: "CHANGE · JUN → OCT", legend: "Water lost since late June", km: -A.CHANGE.lost, loss: true },
    7: { stamp: "SENTINEL-2 · 12 OCT", legend: "Agreement with Sentinel-2 (F1)", km: 0.98, f1: true }
  };
  var current = 0;

  function go(n) {
    if (n === current) return; current = n; var s = S[n];
    A.each(layers, function (im) { im.classList.toggle("show", im.getAttribute("data-s").split(" ").indexOf(String(n)) >= 0); });
    A.each(steps, function (st) { st.classList.toggle("active", +st.getAttribute("data-step") === n); });
    stamp.textContent = s.stamp; legend.textContent = s.legend; pin.hidden = !s.pin;
    km.style.color = s.loss ? "var(--loss)" : "var(--water)";
    if (s.km == null) { km.textContent = "—"; km._v = null; return; }
    if (s.f1) { km._v = 0; A.countTo(km, s.km, { format: function (v) { return "F1 " + v.toFixed(2); } }); return; }
    if (s.loss) { km._v = 0; A.countTo(km, s.km, { ms: 1100, format: function (v) { return "−" + A.fmt(-v) + " km²"; } }); return; }
    if (km._v == null || km._v < 0) km._v = s.km * 0.9;
    A.countTo(km, s.km, { format: function (v) { return A.km(v); } });
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) go(+e.target.getAttribute("data-step")); });
    }, { rootMargin: "-45% 0px -45% 0px" });
    A.each(steps, function (st) { io.observe(st); });
  }
  go(1);
})(window.ARAL);
