import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
    "./public/**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "rgba(22, 27, 34, 0.85)",
          border: "rgba(48, 54, 61, 0.6)",
        },
        stellar: {
          bg: "#0a0e14",
          text: "#e6edf3",
          dim: "#6e7681",
          muted: "#8b949e",
          accent: "#58a6ff",
          "accent-glow": "rgba(88, 166, 255, 0.15)",
          green: "#3fb950",
          "green-dim": "rgba(63, 185, 80, 0.12)",
          orange: "#d29922",
          pink: "#f778ba",
          purple: "#bc8cff",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        DEFAULT: "12px",
        sm: "8px",
      },
      maxWidth: {
        dashboard: "1120px",
      },
      animation: {
        "fade-in": "fadeIn 0.8s ease-out both",
        "fade-in-delayed": "fadeIn 0.8s ease-out 0.15s both",
        "fade-in-late": "fadeIn 0.8s ease-out 0.25s both",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      typography: {
        stellar: {
          css: {
            "--tw-prose-body": "#e6edf3",
            "--tw-prose-headings": "#e6edf3",
            "--tw-prose-links": "#58a6ff",
            "--tw-prose-bold": "#e6edf3",
            "--tw-prose-code": "#f778ba",
            "--tw-prose-pre-bg": "rgba(22, 27, 34, 0.85)",
            "--tw-prose-quotes": "#8b949e",
            "--tw-prose-quote-borders": "#58a6ff",
          },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
} satisfies Config;
