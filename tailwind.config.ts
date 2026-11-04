import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { navy: { 950: "#041E42", 900: "#0A2A55" }, brand: { blue: "#2A8FCB", orange: "#F28C1A" } },
    },
  },
  plugins: [],
};
export default config;
