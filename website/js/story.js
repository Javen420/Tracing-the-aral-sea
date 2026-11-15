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
  var G = {
    1: "<b>Radar brightness</b> (backscatter): how much of the radar signal bounces back to the satellite. Rough surfaces send more back and look bright; smooth ones look dark.",
    2: "<b>L-band</b>: NISAR uses microwaves about 24 cm long. They pass through cloud and work day or night, so every pass is usable.",
    3: "<b>Coherence</b>: a score from 0 to 1 for how similar the radar echo is between two passes 12 days apart. 1 = unchanged (desert, rock); near 0 = changed completely (moving water).",
    4: "<b>How the area is measured</b>: the map is a grid of 60 × 60 m cells (0.0036 km² each). Water cells connected to the lake are counted: area = cells × 0.0036 km². This is surface area, not water volume.",
    5: "<b>12-day window</b>: each map uses two passes 12 days apart, so it shows where water was during that window, not on a single day.",
    6: "<b>Change map</b>: the June and October maps compared cell by cell. Red = water in June, dry by October; blue = newly wet.",
    7: "<b>F1 score</b>: overlap between two maps, 0 to 1. F1 = 2 × both ÷ (2 × both + radar-only + optical-only). Only the cloud-free part of the photo is compared."
  };
  var gloss = $("storyGloss");
  var current = 0;

  function go(n) {
    if (n === current) return; current = n; var s = S[n];
    A.each(layers, function (im) { im.classList.toggle("show", im.getAttribute("data-s").split(" ").indexOf(String(n)) >= 0); });
    A.each(steps, function (st) { st.classList.toggle("active", +st.getAttribute("data-step") === n); });
    stamp.textContent = s.stamp; legend.textContent = s.legend; pin.hidden = !s.pin; if (gloss) gloss.innerHTML = G[n];
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
