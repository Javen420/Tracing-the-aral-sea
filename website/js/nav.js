/* Highlights the chapter in the top bar that is currently on screen. */
(function (A) {
  "use strict";
  var links = document.querySelectorAll(".chapters a");
  if (!("IntersectionObserver" in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      A.each(links, function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id); });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["history", "explore", "present", "north", "evidence"].forEach(function (id) { io.observe(A.$(id)); });
})(window.ARAL);
