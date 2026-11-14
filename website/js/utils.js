/* Shared helpers. Every other script reads from the global ARAL namespace.
   Plain scripts (no modules) so the site also works when opened straight from disk. */
window.ARAL = window.ARAL || {};

(function (A) {
  "use strict";

  A.$ = function (id) { return document.getElementById(id); };
  A.each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  A.reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* "20260703" -> "3 Jul" */
  A.shortDate = function (id) { return (+id.slice(6)) + " " + MON[+id.slice(4, 6) - 1]; };

  /* 2938.6 -> "2,939 km²" */
  A.km = function (v) { return Math.round(v).toLocaleString("en-US") + " km²"; };

  /* Build an element from an HTML string (trusted, static markup only). */
  A.el = function (html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  };
})(window.ARAL);
