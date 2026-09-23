import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        serif: ["var(--font-serif)", "Newsreader", "Georgia", "Cambria", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        forest: {
          50: "#f0f7f2",
          100: "#dbeef0",
          600: "#276244",
          700: "#1e4d35",
          800: "#183f2a",
          900: "#133120",
        },
        lime: {
          400: "#a3e635",
          500: "#88d927",
        },
        mint: {
          50: "#fafcf9",
          100: "#f2f9f4",
          200: "#e2ede5",
          300: "#d5e8da",
        },
      },
    },
  },
  plugins: [],
};
export default config;
