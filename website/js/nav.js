/* Highlights the plate in the masthead that is currently on screen. */
(function (A) {
  "use strict";
  var nav = document.querySelector(".plates-nav"), links = nav.querySelectorAll("a");
  // Masthead height can change (menu wraps on mid-size screens), so publish it as --mast-h for sticky elements.
  var mast = document.querySelector(".mast");
  function setMast() { document.documentElement.style.setProperty("--mast-h", Math.ceil(mast.getBoundingClientRect().height) + "px"); }
  setMast(); window.addEventListener("resize", setMast);
  if ("ResizeObserver" in window) new ResizeObserver(setMast).observe(mast);
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
