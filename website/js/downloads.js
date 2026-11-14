/* Evidence section: measurement table as CSV, with a copy button.
   The same numbers, plus the water boundaries, are in data/ for download. */
(function (A) {
  "use strict";
  var rows = ["window_start,window_end,basin,method,quality,water_km2,low_km2,high_km2"];
  A.WIN.forEach(function (w) {
    rows.push([w.ref, w.sec, "North", "GUNW coherence", "pass", w.n, w.nlo, w.nhi].join(","));
    rows.push([w.ref, w.sec, "South_West", "GUNW coherence", "pass", w.s, w.slo, w.shi].join(","));
  });
  var csv = rows.join("\n");
  A.$("csv").textContent = csv;

  A.$("copyCsv").addEventListener("click", function () {
    var msg = A.$("copyMsg");
    function fail() { msg.textContent = "Copy was blocked. Select the text above instead."; }
    try { navigator.clipboard.writeText(csv).then(function () { msg.textContent = "Copied."; }, fail); }
    catch (e) { fail(); }
  });
})(window.ARAL);
