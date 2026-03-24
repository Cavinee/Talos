import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#0f0f13",
        surface: "#14141c",
        card: "#1a1a24",
        border: "#2a2a3a",
        "text-primary": "#e8e0d4",
        "text-secondary": "#8a8494",
        accent: "#c4a882",
        "accent-light": "#e8d5b5",
        danger: "#d4443b",
        success: "#4a9e6e",
        warning: "#d4a03b",
        "red-faction": "#c45a5a",
        "blue-faction": "#5a7ac4",
      },
      animation: {
        "pulse-chip": "pulse-chip 2s ease-in-out infinite",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
