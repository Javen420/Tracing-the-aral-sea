/* Plate 03: "spot the water". Six spots on the windy 21 June radar image; the answer key is the
   coherence water map. Points come from img/lab/quiz_points.json (made by the pipeline), embedded here
   so the quiz also works when the page is opened straight from disk. */
(function (A) {
  "use strict";
  var $ = A.$;
  var Q = { width: 960, height: 650, points: [
    { x: 422, y: 383, water: false, kind: "dark land", why: "Smooth dry salt flats and sand are dark in radar brightness too." },
    { x: 638, y: 302, water: true, kind: "bright water", why: "Wind-roughened water scatters the radar back, so it looks as bright as land." },
    { x: 400, y: 269, water: true, kind: "bright water", why: "Wind-roughened water scatters the radar back, so it looks as bright as land." },
    { x: 86, y: 248, water: false, kind: "dark land", why: "Smooth dry salt flats and sand are dark in radar brightness too." },
    { x: 378, y: 328, water: true, kind: "dark water", why: "Calm water reflects the beam away like a mirror, so it looks dark." },
    { x: 85, y: 407, water: false, kind: "bright land", why: "Rough ground scatters strongly, so it looks bright." }
  ] };
  var frame = $("quizFrame"), list = $("qList"), truth = $("quizTruth"), answers = {}, pins = [], rows = [], checked = false;

  Q.points.forEach(function (p, i) {
    var pin = document.createElement("button"); pin.type = "button"; pin.className = "qpin"; pin.textContent = i + 1;
    pin.style.left = (p.x / Q.width * 100) + "%"; pin.style.top = (p.y / Q.height * 100) + "%";
    pin.setAttribute("aria-label", "Spot " + (i + 1)); pin.addEventListener("click", function () { focusRow(i); });
    frame.appendChild(pin); pins.push(pin);
    var r = document.createElement("div"); r.className = "qrow";
    r.innerHTML = '<span class="num">' + (i + 1) + '</span><span class="lab small">Spot ' + (i + 1) + '</span><span class="ans"><button type="button" data-v="1">Water</button><button type="button" data-v="0">Land</button></span><span class="why" hidden></span>';
    A.each(r.querySelectorAll(".ans button"), function (b) {
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        if (checked) return; answers[i] = b.getAttribute("data-v") === "1";
        A.each(r.querySelectorAll(".ans button"), function (x) { x.setAttribute("aria-pressed", x === b); });
        pins[i].classList.add("sel");
      });
    });
    list.appendChild(r); rows.push(r);
  });

  function focusRow(i) { rows[i].querySelector("button").focus(); rows[i].scrollIntoView({ block: "nearest", behavior: A.reduceMotion ? "auto" : "smooth" }); }

  $("qCheck").addEventListener("click", function () {
    var n = Object.keys(answers).length;
    if (n < Q.points.length) { $("qMsg").textContent = "Answer all six spots first (" + n + " of 6 done)."; return; }
    checked = true; var score = 0; $("qMsg").textContent = "";
    Q.points.forEach(function (p, i) {
      var ok = answers[i] === p.water; if (ok) score++;
      pins[i].classList.remove("sel"); pins[i].classList.add(ok ? "ok" : "bad");
      var why = rows[i].querySelector(".why"); why.hidden = false;
      why.textContent = (ok ? "Right: " : "Not quite: ") + (p.water ? "water" : "land") + " (" + p.kind + "). " + p.why;
      rows[i].querySelector(".lab").textContent = ok ? "Correct" : "Missed";
    });
    truth.style.opacity = 1;
    $("qScore").textContent = score + " / 6";
    $("qMsg").textContent = score === 6 ? "Perfect. Most people miss the bright water." : "Radar brightness fools everyone; that's why we map water with coherence instead.";
  });

  $("qReset").addEventListener("click", function () {
    checked = false; answers = {}; truth.style.opacity = 0; $("qScore").textContent = ""; $("qMsg").textContent = "";
    pins.forEach(function (p) { p.className = "qpin"; });
    rows.forEach(function (r, i) {
      r.querySelector(".why").hidden = true; r.querySelector(".lab").textContent = "Spot " + (i + 1);
      A.each(r.querySelectorAll(".ans button"), function (x) { x.setAttribute("aria-pressed", "false"); });
    });
  });
})(window.ARAL);
