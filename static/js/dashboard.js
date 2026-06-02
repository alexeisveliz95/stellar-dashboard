document.addEventListener("DOMContentLoaded", function () {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js no cargó, se omite el chart");
    return;
  }

  const canvas = document.getElementById("trendingChart");
  if (!canvas) return;

  let data = [];
  try {
    data = JSON.parse(canvas.dataset.labels || "[]");
  } catch (e) {
    console.error("labels inválidas", e);
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
