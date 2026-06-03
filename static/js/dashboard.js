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

  // ── Live search + filters ──
  const searchInput = document.getElementById("live-search");
  const searchClear = document.getElementById("search-clear");
  const searchReset = document.getElementById("search-reset");
  const filterHot = document.getElementById("filter-hot");
  const resultCount = document.getElementById("result-count");
  const chipButtons = document.querySelectorAll(".chip[data-filter-cat]");

  if (searchInput) {
    const state = { q: "", cat: "", hot: false };

    const applyFilters = () => {
      const q = state.q.toLowerCase().trim();
      const cat = state.cat;
      const hot = state.hot;
      const searchable = document.querySelectorAll(".searchable");
      const trendingRows = document.querySelectorAll("tr.hot-row, tr:not(.hot-row)");
      let totalShown = 0;
      const totalAll = searchable.length;

      // Filter searchable cards (best-quality, top-stars, curated, categories)
      searchable.forEach((el) => {
        const text = (el.dataset.search || "").toLowerCase();
        const elCat = (el.dataset.category || "").toLowerCase();
        const lang = (el.dataset.language || "").toLowerCase();
        const qMatch = !q || text.includes(q) || lang.includes(q);
        const catMatch = !cat || elCat === cat.toLowerCase();
        const show = qMatch && catMatch;
        el.hidden = !show;
        if (show) totalShown++;
      });

      // Filter trending table rows: text match on name/owner, plus HOT filter
      const trendingTable = document.querySelector(".repo-table tbody");
      if (trendingTable) {
        const rows = trendingTable.querySelectorAll("tr");
        rows.forEach((row) => {
          const rowText = row.textContent.toLowerCase();
          const isHot = row.classList.contains("hot-row");
          const qMatch = !q || rowText.includes(q);
          const hotMatch = !hot || isHot;
          row.hidden = !(qMatch && hotMatch);
        });
      }

      // Filter history rows (text match only)
      const historyRows = document.querySelectorAll(".history-row");
      historyRows.forEach((row) => {
        const rowText = row.textContent.toLowerCase();
        const show = !q || rowText.includes(q);
        row.hidden = !show;
      });

      // Filter category cards already handled; category chip matches by slug

      // Update result count
      if (resultCount) {
        const filters = [];
        if (q) filters.push(`"${state.q}"`);
        if (cat) {
          const lbl = document.querySelector(`.chip[data-filter-cat="${cat}"]`);
          if (lbl) filters.push(lbl.textContent.trim());
        }
        if (hot) filters.push("HOT");
        const f = filters.length > 0 ? ` (${filters.join(" · ")})` : "";
        resultCount.textContent = totalShown === totalAll && !q && !cat && !hot
          ? `${totalAll} repos`
          : `${totalShown} / ${totalAll}${f}`;
      }

      // Show/hide section-headers if section is empty (only when filter is active)
      const filterActive = q || cat || hot;
      document.querySelectorAll(".section").forEach((sec) => {
        if (sec.dataset.section === "search") return;
        const cards = sec.querySelectorAll(".searchable, tr, .history-row");
        if (cards.length === 0) return;
        const visible = Array.from(cards).filter((c) => !c.hidden).length;
        if (filterActive) {
          sec.classList.toggle("section-empty", visible === 0);
        } else {
          sec.classList.remove("section-empty");
        }
      });

      // Show/hide controls
      if (searchClear) searchClear.hidden = !filterActive;
      if (searchReset) searchReset.hidden = !filterActive;
    };

    // Debounced input
    let debounceTimer = null;
    searchInput.addEventListener("input", (e) => {
      state.q = e.target.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        applyFilters();
        syncUrl();
      }, 150);
    });

    // Category chip clicks
    chipButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.filterCat;
        state.cat = state.cat === cat ? "" : cat;
        chipButtons.forEach((b) => {
          const active = b === btn && state.cat !== "";
          b.classList.toggle("chip-active", active);
          b.setAttribute("aria-pressed", String(active));
        });
        if (state.cat === "") {
          // Reset: only "Todas" active
          chipButtons.forEach((b) => {
            if (b.dataset.filterCat === "") {
              b.classList.add("chip-active");
              b.setAttribute("aria-pressed", "true");
            } else {
              b.classList.remove("chip-active");
              b.setAttribute("aria-pressed", "false");
            }
          });
        }
        applyFilters();
        syncUrl();
      });
    });

    // HOT toggle
    if (filterHot) {
      filterHot.addEventListener("change", (e) => {
        state.hot = e.target.checked;
        applyFilters();
        syncUrl();
      });
    }

    // Clear button
    if (searchClear) {
      searchClear.addEventListener("click", () => {
        searchInput.value = "";
        state.q = "";
        searchInput.focus();
        applyFilters();
        syncUrl();
      });
    }

    // Reset all
    if (searchReset) {
      searchReset.addEventListener("click", () => {
        searchInput.value = "";
        state.q = "";
        state.cat = "";
        state.hot = false;
        chipButtons.forEach((b) => {
          const active = b.dataset.filterCat === "";
          b.classList.toggle("chip-active", active);
          b.setAttribute("aria-pressed", String(active));
        });
        if (filterHot) filterHot.checked = false;
        applyFilters();
        syncUrl();
        searchInput.focus();
      });
    }

    // URL state sync (?q=foo&cat=ai&hot=1)
    const syncUrl = () => {
      const params = new URLSearchParams();
      if (state.q) params.set("q", state.q);
      if (state.cat) params.set("cat", state.cat);
      if (state.hot) params.set("hot", "1");
      const qs = params.toString();
      const newUrl = qs ? `?${qs}` : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    };

    // Restore from URL
    const params = new URLSearchParams(window.location.search);
    if (params.has("q")) {
      searchInput.value = params.get("q");
      state.q = params.get("q");
    }
    if (params.has("cat")) {
      const cat = params.get("cat");
      state.cat = cat;
      chipButtons.forEach((b) => {
        const active = b.dataset.filterCat === cat;
        b.classList.toggle("chip-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
    }
    if (params.has("hot") && filterHot) {
      const hot = params.get("hot") === "1";
      state.hot = hot;
      filterHot.checked = hot;
    }
    if (state.q || state.cat || state.hot) applyFilters();
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
          if (h >= 15) return "rgba(255, 94, 94, 0.85)";
          if (h >= 10) return "rgba(255, 159, 67, 0.8)";
          if (h >= 5) return "rgba(0, 212, 255, 0.75)";
          return "rgba(124, 92, 255, 0.7)";
        });
        const tlBorder = tl.hots.map((h) => {
          if (h >= 15) return "rgba(255, 94, 94, 1)";
          if (h >= 10) return "rgba(255, 159, 67, 1)";
          if (h >= 5) return "rgba(0, 212, 255, 1)";
          return "rgba(124, 92, 255, 1)";
        });
        new Chart(tlCanvas, {
          type: "line",
          data: {
            labels: tl.labels,
            datasets: [
              {
                label: "⭐ acumuladas",
                data: tl.values,
                backgroundColor: tlBg,
                borderColor: "rgba(124, 92, 255, 0.9)",
                borderWidth: 2,
                pointBackgroundColor: tlBorder,
                pointBorderColor: tlBorder,
                pointRadius: 5,
                pointHoverRadius: 7,
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
