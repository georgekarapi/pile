/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        pile: { 50: "#F5F3FF", 400: "#A78BFA", 500: "#7C3AED", 700: "#5B21B6", 950: "#130A2B" }
      }
    }
  },
  plugins: []
};
