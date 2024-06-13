import { type Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";
import { custom } from "zod";

export default {
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Arial"', 'sans-serif'],
      },
      colors: {
        customBlue: '#000080',
        customYellow: '#ffff00',
        customWhite: '#ffffff',
        customGray: '#818181',
        customGreen: "#02ff00",
        customRed: "#fa0502",
      },
      borderWidth: {
        '60': '60px',
      },
      spacing: {
        '13': '58px',
      },
    },
  },
  plugins: [],
} satisfies Config;
