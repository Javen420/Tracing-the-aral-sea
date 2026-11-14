/* Chapter 1: clickable history timeline. */
(function (A) {
  "use strict";
  var $ = A.$, TL = A.TIMELINE, list = $("tlList"), idx = 0;

  TL.forEach(function (e, i) {
    var li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.className = "tl-btn";
    b.innerHTML = '<span class="yr"></span><span class="tt"></span>';
    b.querySelector(".yr").textContent = e.yr;
    b.querySelector(".tt").textContent = e.t;
    b.addEventListener("click", function () { show(i); });
    li.appendChild(b); list.appendChild(li);
  });

  function show(i) {
    idx = i; var e = TL[i];
    A.each(list.querySelectorAll(".tl-btn"), function (b, j) { b.setAttribute("aria-current", j === i ? "true" : "false"); });
    $("tlYear").textContent = e.yr; $("tlTitle").textContent = e.t; $("tlText").textContent = e.x;
    var chip = $("tlChip"); chip.className = "chip " + (e.kind === "target" ? "target" : e.kind === "measured" ? "measured" : "done"); chip.textContent = e.label;
    var src = $("tlSrc"); src.textContent = "Source: ";
    var a = document.createElement("a"); a.href = e.url; a.textContent = e.src; src.appendChild(a);
    $("tlCredit").textContent = e.credit ? "Image: " + e.credit : "";

    // every entry has an image slot; files in img/history/ are placeholders until replaced
    var m = $("tlMedia"), im = new Image();
    im.alt = e.t + " (" + e.yr + ")";
    im.src = A.paths.history(e.img);
    im.onerror = function () { im.src = A.paths.history("placeholder.svg"); im.onerror = null; };
    m.innerHTML = ""; m.appendChild(im);

    $("tlPrev").disabled = i === 0;
    $("tlNext").disabled = i === TL.length - 1;
  }

  $("tlPrev").addEventListener("click", function () { if (idx > 0) show(idx - 1); });
  $("tlNext").addEventListener("click", function () { if (idx < TL.length - 1) show(idx + 1); });
  show(0);
})(window.ARAL);
