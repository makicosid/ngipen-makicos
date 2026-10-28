import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: { extend: { colors: { primary: "#E53935" } } },
  plugins: [],
};
export default config;
