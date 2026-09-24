/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        pile: {
          paper: "#FAFAF8",
          ink: "#111110",
          muted: "#62625E",
          fog: "#ECEBE6",
          stone: "#D9D8D2"
        }
      }
    }
  },
  plugins: []
};
