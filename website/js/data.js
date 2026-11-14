/* All content and measurements shown on the site.
   To update after re-running the pipeline, edit WIN (from data/coherence_water_area.csv)
   and the change numbers in index.html (from data/change_summary.json). */
(function (A) {
  "use strict";

  /* ---------- Image locations: one place to change folder names ---------- */
  A.paths = {
    radar:     function (view, date) { return "img/radar/" + view + "_" + date + ".jpg"; },       // GCOV HH brightness
    coherence: function (view, tag)  { return "img/coherence/" + view + "_" + tag + ".jpg"; },    // GUNW coherence
    water:     function (view, tag)  { return "img/water/" + view + "_" + tag + ".png"; },        // water outline overlay
    classes:   function (tag)        { return "img/classes/" + tag + ".png"; },                   // water + uncertain shoreline
    change:    function (view)       { return "img/change/" + view + "_first_vs_last.png"; },     // lost / gained / both
    history:   function (file)       { return "img/history/" + file; }                            // NASA historical images
  };

  /* ---------- Chapter 1: timeline ---------- */
  A.TIMELINE = [
    { yr: "1950s–60s", t: "Rivers diverted to grow cotton", kind: "done", label: "History",
      x: "Soviet projects diverted the Syr Darya and Amu Darya, the two rivers that fed the Aral, to turn desert into farmland. The sea has been shrinking ever since.",
      src: "NASA Earth Observatory", url: "https://earthobservatory.nasa.gov/images/77193", img: "1960s.jpg",
      credit: "Amu Darya delta in 1964. KH-5 Argon (USAF/USGS), via NASA SVS" },
    { yr: "22 Aug 1964", t: "An early satellite view", kind: "done", label: "Image",
      x: "An Argon reconnaissance satellite photographed the Aral Sea before the water level dropped. It was then the fourth largest lake in the world.",
      src: "NASA Scientific Visualization Studio", url: "https://svs.gsfc.nasa.gov/10862", img: "1964.jpg",
      credit: "KH-5 Argon, 22 Aug 1964 (USAF/USGS), via NASA SVS" },
    { yr: "1977 · 1989 · 2006", t: "Depletion across three decades", kind: "done", label: "Image series",
      x: "Landsat images from 1977, 1989 and 2006 show the shoreline retreating and Vozrozhdeniya Island growing until it joined the mainland.",
      src: "NASA Scientific Visualization Studio", url: "https://svs.gsfc.nasa.gov/10862", img: "1977_1989_2006.jpg",
      credit: "Landsat false colour (USGS/NASA), via NASA SVS" },
    { yr: "1987–89", t: "The sea splits in two", kind: "done", label: "History",
      x: "After the level fell by about 13 m, the Aral divided into a Small (North) Aral, fed by the Syr Darya, and a Large (South) Aral, fed by the Amu Darya.",
      src: "Aladin, Aral 2009 abstracts", url: "https://zin.ru/conferences/Aral2009/doc/ABSTRACTS%20ARAL'09.pdf", img: "1989_split.jpg",
      credit: "The separated basins in 2000 and 2009. MODIS (NASA), via NASA SVS" },
    { yr: "1992", t: "A first sand dike in the north", kind: "done", label: "History",
      x: "A dike in Berg's Strait stopped North Aral water spilling south. Salinity in the north stopped rising and began to fall.",
      src: "Aladin, Aral 2009 abstracts", url: "https://zin.ru/conferences/Aral2009/doc/ABSTRACTS%20ARAL'09.pdf", img: "1992_dike.jpg",
      credit: "North Aral and the former strait in Aug 2000. MODIS on Terra, NASA Earth Observatory" },
    { yr: "2000", t: "The south splits again", kind: "done", label: "Image",
      x: "By the start of NASA's Terra image series, the South Aral had itself split into western and eastern lobes.",
      src: "NASA Earth Observatory", url: "https://earthobservatory.nasa.gov/images/84437/the-aral-sea-loses-its-eastern-lobe", img: "2000.jpg",
      credit: "MODIS on Terra, 25 Aug 2000. NASA Earth Observatory (Jesse Allen)" },
    { yr: "2005", t: "Kok-Aral Dam completed", kind: "done", label: "Completed",
      x: "An $85.8 million dam, supported by a World Bank loan, separated the North Aral from its saltier southern half and held back the Syr Darya's water.",
      src: "NASA Earth Observatory", url: "https://earthobservatory.nasa.gov/images/7645/north-aral-sea-recovery", img: "2005.jpg",
      credit: "MODIS on Terra, 15 Apr 2005. NASA Earth Observatory (Jesse Allen)" },
    { yr: "2005–2007", t: "The north visibly recovers", kind: "done", label: "Image",
      x: "MODIS images two years apart show the North Aral's water level rising, much of it in the first year after the dam.",
      src: "MODIS on Terra, NASA Earth Observatory", url: "https://earthobservatory.nasa.gov/images/7645/north-aral-sea-recovery", img: "2007.jpg",
      credit: "MODIS on Terra, 14 Apr 2007. NASA Earth Observatory (Jesse Allen)" },
    { yr: "Aug 2014", t: "The south's eastern basin dries", kind: "done", label: "History",
      x: "For the first time in modern history, the eastern basin of the South Aral dried completely.",
      src: "NASA Earth Observatory", url: "https://earthobservatory.nasa.gov/images/84437/the-aral-sea-loses-its-eastern-lobe", img: "2014.jpg",
      credit: "MODIS on Terra, 19 Aug 2014. NASA Earth Observatory (Jesse Allen)" },
    { yr: "30 Jul 2025", t: "NISAR launches", kind: "done", label: "Mission",
      x: "The NASA–ISRO NISAR radar satellite lifted off from Satish Dhawan Space Centre in India. It scans nearly all of Earth's land and ice twice every 12 days, through cloud and darkness.",
      src: "NASA Science", url: "https://science.nasa.gov/photojournal/nisar-in-orbit-artists-concept", img: "2025_nisar_launch.jpg",
      credit: "Artist's concept, NASA/JPL-Caltech (PIA26613)" },
    { yr: "2026", t: "Phase two of the restoration", kind: "target", label: "Plans and reports",
      x: "Kazakhstan plans to raise the North Aral to 34 km³ and about 3,913 km². It reports 1.4 km³ directed into the sea since October 2025.",
      src: "Trend, Jan 2026; Astana Times, Jul 2026", url: "https://www.trend.az/casia/kazakhstan/4144205.html", img: "2026_nisar.jpg",
      credit: "NISAR radar brightness (GCOV HH), 19 Oct 2026. Processed by the team" },
    { yr: "Jun–Oct 2026", t: "Our NISAR analysis", kind: "measured", label: "Measured here",
      x: "Nine 12-day NISAR coherence windows map the North Aral at 3,071 km² of open water in late June and 2,939 km² by mid October. Orange marks the 133 km² of shallow margin that dried; blue stayed water throughout.",
      src: "This project", url: "#north", img: "2026_analysis.jpg",
      credit: "NISAR GUNW coherence, 21 Jun–3 Jul vs 7–19 Oct 2026. Processed by the team" }
  ];

  /* ---------- NISAR passes (GCOV, track 107 descending, ~15:06 UTC) ---------- */
  A.PASSES = [
    { id: "20260621", s: "21 Jun", l: "21 June 2026",      wx: "Wind on the North Aral" },
    { id: "20260703", s: "3 Jul",  l: "3 July 2026",       wx: "Heavy rain beforehand" },
    { id: "20260715", s: "15 Jul", l: "15 July 2026",      wx: "Windy" },
    { id: "20260727", s: "27 Jul", l: "27 July 2026",      wx: "Windy over the north" },
    { id: "20260820", s: "20 Aug", l: "20 August 2026",    wx: "Calm" },
    { id: "20260901", s: "1 Sep",  l: "1 September 2026",  wx: "Calm" },
    { id: "20260913", s: "13 Sep", l: "13 September 2026", wx: "Not checked" },
    { id: "20261007", s: "7 Oct",  l: "7 October 2026",    wx: "Windy over the north" },
    { id: "20261019", s: "19 Oct", l: "19 October 2026",   wx: "Calm" }
  ];

  /* ---------- 12-day coherence windows (GUNW). Areas in km², range = threshold ±0.02. All passed the quality check. ----------
     [ref, sec, north, northLow, northHigh, southWest, southWestLow, southWestHigh] */
  A.WIN = [
    ["20260621", "20260703", 3071.2, 3055.0, 3080.9, 1771.9, 1745.5, 1780.9],
    ["20260703", "20260715", 3063.3, 3045.3, 3072.4, 1767.4, 1754.5, 1774.1],
    ["20260715", "20260727", 3019.7, 3011.9, 3025.3, 1769.6, 1764.1, 1773.9],
    ["20260727", "20260820", 2994.5, 2985.2, 3001.1, 1764.7, 1757.2, 1768.9],
    ["20260820", "20260901", 2947.3, 2938.1, 2955.3, 1753.5, 1749.6, 1756.4],
    ["20260901", "20260913", 2921.6, 2913.4, 2927.6, 1752.0, 1747.4, 1756.0],
    ["20260913", "20260925", 2922.0, 2914.5, 2927.1, 1744.4, 1740.2, 1747.2],
    ["20260925", "20261007", 2951.4, 2943.5, 2959.0, 1742.3, 1736.8, 1745.5],
    ["20261007", "20261019", 2938.6, 2929.8, 2944.4, 1738.6, 1735.7, 1741.2]
  ].map(function (r) {
    return { ref: r[0], sec: r[1], tag: r[0] + "_" + r[1], n: r[2], nlo: r[3], nhi: r[4], s: r[5], slo: r[6], shi: r[7] };
  });

  A.OFFICIAL_NORTH_KM2 = 3065;   // Times of Central Asia, phase-two description

  A.winLabel = function (w) { return A.shortDate(w.ref) + "–" + A.shortDate(w.sec); };
  /* the 12-day window that ends on a pass (the first pass uses the first window) */
  A.winFor = function (pass) {
    for (var i = 0; i < A.WIN.length; i++) if (A.WIN[i].sec === pass.id) return A.WIN[i];
    return A.WIN[0];
  };

  /* ---------- Chapter 3: evidence ledger ---------- */
  A.LEDGER = [
    { f: "done", w: "2005", t: "Kok-Aral Dam completed, separating the North Aral from the south.", src: "NASA Earth Observatory", u: "https://earthobservatory.nasa.gov/images/7645/north-aral-sea-recovery" },
    { f: "reported", w: "Jan 2026", t: "North Aral volume rose from 18.4 km³ (early 2023) to about 23 km³.", src: "Trend, 21 Jan 2026", u: "https://www.trend.az/casia/kazakhstan/4144205.html" },
    { f: "target", w: "Jan 2026", t: "Phase two aims for 34 km³ and about 3,913 km² within 4–5 years, including rebuilding the Kok-Aral Dam to raise the level to 44 m.", src: "Times of Central Asia", u: "https://timesca.com/?p=42561" },
    { f: "reported", w: "Jul 2026", t: "1.4 km³ directed into the North Aral through the Syr Darya since 1 Oct 2025 (cumulative, not a daily record).", src: "Astana Times", u: "https://astanatimes.com/2026/07/kazakhstan-steps-up-aral-restoration-water-infrastructure-and-conservation-reforms/" },
    { f: "reported", w: "10 Aug 2026", t: "North Aral volume 23.40 km³.", src: "Trend, 19 Aug 2026", u: "https://www.trend.az/casia/kazakhstan/4216239.html" },
    { f: "measured", w: "21 Jun–3 Jul", t: "NISAR coherence maps 3,071 km² of open water in the North Aral (3,055–3,081).", src: "This project, GUNW", u: "#evidence" },
    { f: "measured", w: "7–19 Oct", t: "NISAR coherence maps 2,939 km² (2,930–2,944): 133 km² of shallow margin lost since June, under 1 km² gained.", src: "This project, GUNW", u: "#evidence" }
  ];
})(window.ARAL);
