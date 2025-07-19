import { type Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";
import { custom } from "zod";

export default {
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Arial"', 'sans-serif'],
        ivsr: ['"ivsr"', ...fontFamily.sans],
      },
      colors: {
        customBlue: '#1f67fa',
        customLightBlue: '#3275ff',
        customYellow: '#ffff6b',
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
