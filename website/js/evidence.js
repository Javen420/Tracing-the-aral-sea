/* Plate 07: validation table and measurements CSV. */
(function (A) {
  "use strict";
  var $ = A.$, W = A.WIN;

  var h = '<thead><tr><th>Window</th><th>Basin</th><th>Sentinel-2</th><th>Days apart</th><th>Cloud-free</th><th>F1</th><th>IoU</th><th>Area diff</th></tr></thead><tbody>';
  W.forEach(function (w) {
    [["North", w.s2N], ["South-west", w.s2S]].forEach(function (b) {
      var s = b[1], tier = s.usable < 70 || s.gap > 6;
      h += '<tr' + (tier ? ' class="tier"' : "") + '><td>' + A.winLabel(w) + '</td><td>' + b[0] + '</td><td>' + A.shortDate(s.date) + '</td><td>' + s.gap +
           '</td><td>' + Math.round(s.usable) + '%</td><td' + (s.f1 < 0.95 ? ' class="lo"' : "") + '>' + s.f1.toFixed(3) + '</td><td>' + s.iou.toFixed(3) +
           '</td><td>' + (s.dA > 0 ? "+" : "") + s.dA.toFixed(1) + '%</td></tr>';
    });
  });
  h += '<tr><td><b>Pooled</b></td><td>North</td><td></td><td></td><td></td><td><b>' + A.S2_POOLED.N.f1.toFixed(3) + '</b></td><td>' + A.S2_POOLED.N.iou.toFixed(3) + '</td><td></td></tr>';
  h += '<tr><td><b>Pooled</b></td><td>South-west</td><td></td><td></td><td></td><td><b>' + A.S2_POOLED.S.f1.toFixed(3) + '</b></td><td>' + A.S2_POOLED.S.iou.toFixed(3) + '</td><td></td></tr></tbody>';
  $("vtable").innerHTML = h;

  var rows = ["window_start,window_end,days,basin,nisar_water_km2,low_km2,high_km2,coherence_cutoff,s2_date,s2_f1,s2_iou"];
  W.forEach(function (w) {
    rows.push([w.ref, w.sec, w.days, "North", w.n, w.nlo, w.nhi, w.nthr, w.s2N.date, w.s2N.f1, w.s2N.iou].join(","));
    rows.push([w.ref, w.sec, w.days, "South_West", w.s, w.slo, w.shi, w.sthr, w.s2S.date, w.s2S.f1, w.s2S.iou].join(","));
  });
  var csv = rows.join("\n"); $("csv").textContent = csv;
  $("copyCsv").addEventListener("click", function () {
    var msg = $("copyMsg");
    function fail() { msg.textContent = "Copy was blocked. Select the text above instead."; }
    try { navigator.clipboard.writeText(csv).then(function () { msg.textContent = "Copied."; }, fail); } catch (e) { fail(); }
  });
})(window.ARAL);
