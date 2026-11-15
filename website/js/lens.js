/* Plate 05: radar vs Sentinel-2. A circular lens (or a swipe line) reveals the optical image
   under the radar; the disagreement layer pulses where the two water maps differ. */
(function (A) {
  "use strict";
  var $ = A.$, W = A.WIN, frame = $("lensFrame"), base = $("lensBase"), opt = $("lensOpt"), agree = $("lensAgree");
  var ring = $("lensRing"), line = $("lensLine"), sel = $("lnWin");
  // Lens mode: a small round window holding a second copy of the optical image. Moving it only changes
  // transforms (GPU), so nothing is repainted while the pointer moves. Swipe mode clips the full image.
  var win = document.createElement("div"), winImg = document.createElement("img");
  win.className = "lens-win"; winImg.alt = ""; winImg.setAttribute("aria-hidden", "true"); win.appendChild(winImg);
  frame.insertBefore(win, ring);
  var st = { basin: "N", mode: "lens", i: W.length - 1, x: 0.55, y: 0.45, agree: false, r: 90 };

  W.forEach(function (w, i) { var o = document.createElement("option"); o.value = i; o.textContent = A.winLabel(w) + " 2026"; sel.appendChild(o); });
  sel.value = st.i;

  function update() {
    var w = W[st.i], s2 = st.basin === "N" ? w.s2N : w.s2S, view = st.basin === "N" ? "north" : "full";
    frame.classList.toggle("ratio-north", view === "north"); frame.classList.toggle("ratio-full", view === "full");
    frame.style.maxWidth = view === "full" ? "520px" : ""; frame.style.margin = view === "full" ? "0 auto" : "";
    base.src = A.paths.radar(view, w.sec === "20260925" ? "20261007" : w.sec);
    opt.src = winImg.src = A.paths.optical(view, s2.date);
    agree.src = A.paths.agree(view, w.tag);
    base.alt = "NISAR radar brightness, " + A.shortDate(w.sec); opt.alt = "Sentinel-2 true colour, " + A.shortDate(s2.date);
    $("lensTagR").textContent = "NISAR · " + A.winLabel(w).toUpperCase();
    $("lensTagO").textContent = "SENTINEL-2 · " + A.shortDate(s2.date).toUpperCase();
    $("lnF1").textContent = s2.f1.toFixed(2);
    $("lnDA").textContent = (s2.dA > 0 ? "+" : "") + s2.dA.toFixed(1) + "%";
    $("lnUse").textContent = Math.round(s2.usable) + "%";
    var notes = [];
    notes.push("Sentinel-2 photo taken " + (s2.gap === 0 ? "in the middle of" : s2.gap + (s2.gap === 1 ? " day" : " days") + " from the middle of") + " the radar window.");
    if (s2.usable < 70) notes.push("Clouds hid part of the basin; only the clear " + Math.round(s2.usable) + "% was compared.");
    if (s2.f1 < 0.95) notes.push("Low agreement: Sentinel-2 sees extra water or wet mud on the shallow shore that the radar does not count.");
    if (st.basin === "S") notes.push("South-west view shows the whole former sea; the basin is the long lake on the left.");
    $("lnNote").textContent = notes.join(" ");
    box = null; clip();
  }

  // Cached frame size: measured on load/resize/scroll, not on every pointer move (avoids forced layout).
  var box = null, rad = 90, raf = 0;
  function measure() { box = frame.getBoundingClientRect(); rad = Math.max(60, Math.min(120, box.width * 0.16));
    ring.style.width = ring.style.height = win.style.width = win.style.height = (rad * 2) + "px";
    ring.style.margin = win.style.margin = (-rad) + "px 0 0 " + (-rad) + "px";
    winImg.style.width = box.width + "px"; winImg.style.height = box.height + "px"; }

  function clip() {
    if (!box) measure();
    var px = st.x * 100, py = st.y * 100, X = st.x * box.width, Y = st.y * box.height;
    if (st.mode === "lens") {
      opt.style.visibility = "hidden"; win.hidden = false;
      ring.style.transform = win.style.transform = "translate3d(" + X + "px," + Y + "px,0)";
      winImg.style.transform = "translate3d(" + (rad - X) + "px," + (rad - Y) + "px,0)"; ring.hidden = false; line.hidden = true;
    } else {
      opt.style.visibility = ""; win.hidden = true;
      opt.style.clipPath = "inset(0 0 0 " + px + "%)"; line.style.transform = "translate3d(" + X + "px,0,0)"; line.hidden = false; ring.hidden = true;
    }
    agree.style.opacity = st.agree ? 1 : 0; agree.classList.toggle("pulse", st.agree && !A.reduceMotion);
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; clip(); }); }

  function move(ev) {
    if (!box) measure();
    st.x = Math.max(0, Math.min(1, (ev.clientX - box.left) / box.width)); st.y = Math.max(0, Math.min(1, (ev.clientY - box.top) / box.height)); schedule();
  }
  var dragging = false;
  frame.addEventListener("pointerenter", measure);
  // Mouse: lens and swipe line follow the pointer, no click needed. Touch/pen: drag.
  frame.addEventListener("pointermove", function (ev) { if (ev.pointerType === "mouse" || dragging) move(ev); });
  frame.addEventListener("pointerdown", function (ev) { measure(); dragging = true; if (st.mode === "swipe") { try { frame.setPointerCapture(ev.pointerId); } catch (e) {} } move(ev); });
  window.addEventListener("pointerup", function () { dragging = false; });
  window.addEventListener("scroll", function () { box = null; }, { passive: true });
  frame.tabIndex = 0; frame.setAttribute("aria-label", "Radar and Sentinel-2 comparison. Use arrow keys to move the lens or swipe line.");
  frame.addEventListener("keydown", function (ev) {
    var d = 0.04, k = ev.key;
    if (k === "ArrowLeft") st.x -= d; else if (k === "ArrowRight") st.x += d; else if (k === "ArrowUp") st.y -= d; else if (k === "ArrowDown") st.y += d; else return;
    ev.preventDefault(); st.x = Math.max(0, Math.min(1, st.x)); st.y = Math.max(0, Math.min(1, st.y)); schedule();
  });

  function seg(a, b, on) { $(a).setAttribute("aria-pressed", on); $(b).setAttribute("aria-pressed", !on); }
  $("lnN").addEventListener("click", function () { st.basin = "N"; seg("lnN", "lnS", true); update(); });
  $("lnS").addEventListener("click", function () { st.basin = "S"; st.x = 0.18; st.y = 0.6; seg("lnN", "lnS", false); update(); });
  $("lnLens").addEventListener("click", function () { st.mode = "lens"; frame.classList.remove("swipe"); seg("lnLens", "lnSwipe", true); clip(); });
  $("lnSwipe").addEventListener("click", function () { st.mode = "swipe"; st.x = 0.5; frame.classList.add("swipe"); seg("lnLens", "lnSwipe", false); clip(); });
  $("lnAgree").addEventListener("change", function (e) { st.agree = e.target.checked; clip(); });
  sel.addEventListener("change", function () { st.i = +sel.value; update(); });
  window.addEventListener("resize", function () { box = null; schedule(); });
  update();
})(window.ARAL);
