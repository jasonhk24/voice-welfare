// tailwind.config.js
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class', // 또는 'media'
  theme: {
    extend: {
      // 기존 extend 내용
    },
  },
  plugins: [
    function({ addVariant }) {
      addVariant('hc', '.high-contrast &') // .high-contrast 클래스가 html 또는 body에 있을 때 hc: 스타일 적용
    }
  ],
}