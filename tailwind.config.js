const withMT = require("@material-tailwind/react/utils/withMT");
/** @type {import('tailwindcss').Config} */
export default withMT({
  content: ["./src/**/*.{html,js,jsx}", "./index.html"],
  theme: {
    extend: {},
  },
  plugins: [],
})

