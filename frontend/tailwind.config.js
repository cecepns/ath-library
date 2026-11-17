export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
      },
      boxShadow: {
        card: "0 2px 10px -2px rgba(6, 78, 59, 0.06), 0 1px 3px 0 rgba(0, 0, 0, 0.04)",
        "card-hover": "0 10px 24px -6px rgba(6, 78, 59, 0.12), 0 4px 10px -4px rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [],
};
