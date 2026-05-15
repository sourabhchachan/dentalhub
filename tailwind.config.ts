import type { Config } from "tailwindcss";

/**
 * Dental Hub — luxury black / gold palette.
 * Source of truth: `src/app/globals.css` (`:root` + `@theme inline`).
 * Nested colors mirror those tokens for Tailwind utilities used in the app.
 */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        "primary-dark": "var(--primary-dark)",
        "primary-light": "var(--primary-light)",
        accent: "var(--accent)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        border: {
          DEFAULT: "var(--border)",
          light: "var(--border-light)",
        },
        text: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
        },
      },
      boxShadow: {
        "dh-card": "0 2px 20px rgba(0, 0, 0, 0.4)",
      },
    },
  },
} satisfies Config;
