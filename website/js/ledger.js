/* Chapter 3: filterable list of completed / reported / target / measured items. */
(function (A) {
  "use strict";
  var NAMES = { done: "Completed", reported: "Reported", target: "Target", measured: "Measured here" };
  var box = A.$("ledger"), buttons = document.querySelectorAll(".filter button");

  function draw(filter) {
    box.innerHTML = "";
    A.LEDGER.filter(function (r) { return filter === "all" || r.f === filter; }).forEach(function (r) {
      var d = document.createElement("div"); d.className = "ledger-row";
      d.innerHTML = '<span class="when"></span><span><span class="chip ' + r.f + '">' + NAMES[r.f] + '</span></span><span><span class="txt"></span> <a class="small"></a></span>';
      d.querySelector(".when").textContent = r.w;
      d.querySelector(".txt").textContent = r.t;
      var a = d.querySelector("a"); a.href = r.u; a.textContent = r.src;
      box.appendChild(d);
    });
  }

  A.each(buttons, function (b) {
    b.addEventListener("click", function () {
      A.each(buttons, function (x) { x.setAttribute("aria-pressed", x === b); });
      draw(b.getAttribute("data-f"));
    });
  });
  draw("all");
})(window.ARAL);
