import { type Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

export default {
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"PT Sans"', 'sans-serif'],
      },
      colors: {
        customBlue: '#000080',
        customYellow: '#ffff00',
        customWhite: '#ffffff',
        customGray: '#818181',
        customGreen: "#02ff00",
      },
      borderWidth: {
        '30': '30px',
      },
    },
  },
  plugins: [],
} satisfies Config;
