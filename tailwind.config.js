/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        slideUp: "slideUp 0.3s ease-out",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          primary: "#167bff",
          "primary-content": "#ffffff",
          secondary: "#f000b8",
          accent: "#37cdbe",
          neutral: "#2b3440",
          "base-100": "#ffffff",
          "base-200": "#f9fafb",
          "base-300": "#d1d5db",
          "base-content": "#1f2937",
        },
        dark: {
          primary: "#167bff",
          "primary-content": "#ffffff",
          secondary: "#f000b8",
          accent: "#37cdbe",
          neutral: "#2b3440",
          "base-100": "#1f2937",
          "base-200": "#111827",
          "base-300": "#374151",
          "base-content": "#f9fafb",
        },
      },
    ],
  },
};
