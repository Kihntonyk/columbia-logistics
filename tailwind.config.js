/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tailwind scans these files for class names and only generates the CSS that is used.
  content: ["./public/**/*.html", "./public/**/*.js"],
  theme: {
    extend: {
      // Design tokens. See docs/ralph-notes.md for the reasoning behind each one.
      colors: {
        ink: { DEFAULT: "#13233A", 800: "#1B2F4B", 700: "#26405F", 600: "#3A5577" },
        steel: { DEFAULT: "#5A6B7E", light: "#6F7F92" },
        line: { DEFAULT: "#DDE3E9", soft: "#EBEFF3" },
        paper: "#F3F5F7",
        signal: { DEFAULT: "#F2A900", soft: "#FFF4D6", ink: "#7A5200" },
        out: { DEFAULT: "#1F5FBF", dark: "#174A96", soft: "#E8F0FB" },
        in: { DEFAULT: "#1E7D4F", dark: "#17633E", soft: "#E6F4EC" },
        danger: { DEFAULT: "#B42318", soft: "#FDECEA" },
      },
      fontFamily: {
        sans: ["Barlow", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      keyframes: {
        "toast-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "row-flash": {
          from: { backgroundColor: "#FFF4D6" },
          to: { backgroundColor: "transparent" },
        },
        shimmer: {
          from: { backgroundPosition: "-200px 0" },
          to: { backgroundPosition: "200px 0" },
        },
      },
      animation: {
        "toast-in": "toast-in 180ms ease-out",
        "row-flash": "row-flash 1.6s ease-out",
        shimmer: "shimmer 1.2s linear infinite",
      },
    },
  },
  plugins: [],
};
