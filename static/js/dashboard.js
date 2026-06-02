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
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    counters.forEach(animateCounter);
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
  const bg = data.map((r) => (r.hot ? "rgba(255, 94, 94, 0.7)" : "rgba(0, 212, 255, 0.6)"));
  const border = data.map((r) => (r.hot ? "rgba(255, 94, 94, 1)" : "rgba(0, 212, 255, 1)"));

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
          borderWidth: 1,
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
});
