/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        amigo: {
          blue: "#4a85f6",
          btn: "#85b4f2",
          btnHover: "#6ca1ea",
          btnActive: "#5c94e5",
          teal: "#009688",
          dark: "#1e293b",
          border: "#cbd5e1",
          bg: "#fbfbfa",
        },
      },
    },
  },
  plugins: [],
};
