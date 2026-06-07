document.addEventListener("DOMContentLoaded", function () {
  // ── Counter-up animation for hero stats ──
  const counters = document.querySelectorAll("[data-counter]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (counters.length > 0 && !reduce) {
    const animateCounter = (el) => {
      const target = parseInt(el.dataset.counter, 10) || 0;
      const suffix = el.dataset.suffix || "";
      const duration = 1200;
      const start = performance.now();
      const format = (n) => {
        if (target >= 1000) return (n / 1000).toFixed(1) + "k";
        return String(Math.round(n));
      };
      const tick = (now) => {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = suffix + format(target * eased);
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          el.classList.add("is-visible");
        }
      };
      // First frame: start at 0 hidden, then reveal on first tick
      el.textContent = suffix + format(0);
      requestAnimationFrame((t) => {
        el.classList.add("is-visible");
        tick(t);
      });
    };
    counters.forEach(animateCounter);
  } else {
    // Reduced motion: just show final values immediately
    counters.forEach((el) => el.classList.add("is-visible"));
  }

  if (typeof Chart === "undefined") {
    console.warn("Chart.js no cargó, se omite el chart");
    return;
  }

  const canvas = document.getElementById("trendingChart");
  if (!canvas) return;

  const dataEl = document.getElementById("trending-data");
  if (!dataEl) return;

  let data = [];
  try {
    data = JSON.parse(dataEl.textContent || "[]");
  } catch (e) {
    console.error("trending-data inválido", e);
    return;
  }

  const labels = data.map((r) => r.name);
  const growth = data.map((r) => r.growth);
  const bg = data.map((r) => (r.hot ? "rgba(0, 212, 255, 0.9)" : "rgba(0, 212, 255, 0.5)"));
  const border = data.map((r) => (r.hot ? "rgba(124, 92, 255, 1)" : "rgba(0, 212, 255, 1)"));
  const borderW = data.map((r) => (r.hot ? 2 : 1));

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Estrellas hoy",
          data: growth,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: borderW,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => "+" + ctx.parsed.x.toLocaleString() + " ⭐",
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#8a93a8", font: { family: "monospace" } },
        },
        y: {
          grid: { display: false },
          ticks: { color: "#e6e9f2", font: { size: 11 } },
        },
      },
    },
  });

  // ── History timeline chart (growth per day across all weeks) ──
  const tlCanvas = document.getElementById("historyTimeline");
  if (tlCanvas) {
    const tlDataEl = document.getElementById("history-timeline-data");
    if (tlDataEl) {
      let tl = { labels: [], values: [], hots: [] };
      try {
        tl = JSON.parse(tlDataEl.textContent || "{}");
      } catch (e) {
        console.error("history-timeline-data inválido", e);
      }
      if (tl.labels && tl.labels.length > 0) {
        const tlBg = tl.hots.map((h) => {
          if (h >= 15) return "rgba(0, 212, 255, 0.45)";
          if (h >= 10) return "rgba(0, 212, 255, 0.35)";
          if (h >= 5) return "rgba(0, 212, 255, 0.25)";
          return "rgba(0, 212, 255, 0.18)";
        });
        const tlBorder = tl.hots.map((h) => {
          if (h >= 15) return "rgba(0, 212, 255, 1)";
          if (h >= 10) return "rgba(0, 212, 255, 0.95)";
          if (h >= 5) return "rgba(0, 212, 255, 0.85)";
          return "rgba(0, 212, 255, 0.7)";
        });
        const tlPointSize = tl.hots.map((h) => (h >= 10 ? 7 : 5));
        new Chart(tlCanvas, {
          type: "line",
          data: {
            labels: tl.labels,
            datasets: [
              {
                label: "⭐ acumuladas",
                data: tl.values,
                backgroundColor: tlBg,
                borderColor: "rgba(0, 212, 255, 0.9)",
                borderWidth: 2,
                pointBackgroundColor: tlBorder,
                pointBorderColor: tlBorder,
                pointRadius: tlPointSize,
                pointHoverRadius: 9,
                fill: true,
                tension: 0.3,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const hots = tl.hots[ctx.dataIndex] || 0;
                    return [
                      "+" + ctx.parsed.y.toLocaleString() + " ⭐",
                      "🔥 " + hots + " HOT",
                    ];
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { color: "rgba(255,255,255,0.04)" },
                ticks: { color: "#8a93a8", font: { family: "monospace", size: 10 } },
              },
              y: {
                grid: { color: "rgba(255,255,255,0.05)" },
                ticks: {
                  color: "#8a93a8",
                  font: { family: "monospace" },
                  callback: (v) => v >= 1000 ? (v / 1000).toFixed(1) + "k" : v,
                },
                beginAtZero: true,
              },
            },
          },
        });
      }
    }
  }
});
