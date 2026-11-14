/* Chapter 2: show / hide the water and uncertain-shoreline classes.
   The class image has blue water and amber shoreline; SVG colour filters (in index.html) isolate one class. */
(function (A) {
  "use strict";
  var $ = A.$, img = $("clsImg");
  function update() {
    var w = $("cWater").checked, u = $("cUnc").checked;
    img.style.opacity = (w || u) ? 1 : 0;
    img.style.filter = (!w && u) ? "url(#onlyAmber)" : (w && !u) ? "url(#onlyBlue)" : "none";
  }
  $("cWater").addEventListener("change", update);
  $("cUnc").addEventListener("change", update);
})(window.ARAL);
