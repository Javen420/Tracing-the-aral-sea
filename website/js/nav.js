/* Highlights the plate in the masthead that is currently on screen. */
(function (A) {
  "use strict";
  var nav = document.querySelector(".plates-nav"), links = nav.querySelectorAll("a");
  if (!("IntersectionObserver" in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      A.each(links, function (a) {
        var on = a.getAttribute("href") === "#" + e.target.id;
        a.classList.toggle("on", on);
        if (on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - 40;
      });
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  ["history", "story", "quiz", "lab", "check", "north", "evidence"].forEach(function (id) { io.observe(A.$(id)); });
})(window.ARAL);
