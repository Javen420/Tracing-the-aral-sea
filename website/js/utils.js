/* Shared helpers. Every other script reads from the global ARAL namespace.
   Plain scripts (no modules) so the site also works from a simple static server. */
window.ARAL = window.ARAL || {};

(function (A) {
  "use strict";

  A.$ = function (id) { return document.getElementById(id); };
  A.each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  A.reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /* "20260703" or "2026-07-03" -> "3 Jul" */
  A.shortDate = function (id) { id = id.replace(/-/g, ""); return (+id.slice(6)) + " " + MON[+id.slice(4, 6) - 1]; };
  A.fmt = function (v) { return Math.round(v).toLocaleString("en-US"); };
  A.km = function (v) { return A.fmt(v) + " km²"; };

  /* Animate a number in an element from its current value to `to`. */
  A.countTo = function (el, to, opts) {
    opts = opts || {};
    var from = el._v == null ? to : el._v, dur = A.reduceMotion ? 0 : (opts.ms || 700), t0 = performance.now();
    var fmt = opts.format || A.fmt;
    if (el._raf) cancelAnimationFrame(el._raf);
    function tick(t) {
      var k = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3), v = from + (to - from) * e;
      el.textContent = fmt(v); el._v = v;
      if (k < 1) el._raf = requestAnimationFrame(tick);
    }
    el._raf = requestAnimationFrame(tick);
  };

  /* Run fn once when the element first scrolls into view. */
  A.onVisible = function (el, fn) {
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: "200px" });
    io.observe(el);
  };
})(window.ARAL);
