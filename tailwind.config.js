/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* 本轮世界（日课刻度）的语义色 */
        ground: 'rgb(var(--c-ground) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        well: 'rgb(var(--c-well) / <alpha-value>)',
        hairline: 'rgb(var(--c-hairline) / <alpha-value>)',
        fg: 'rgb(var(--c-fg) / <alpha-value>)',
        dim: 'rgb(var(--c-dim) / <alpha-value>)',
        ghost: 'rgb(var(--c-ghost) / <alpha-value>)',
        lit: 'rgb(var(--c-lit) / <alpha-value>)',
        done: 'rgb(var(--c-done) / <alpha-value>)',
        alert: 'rgb(var(--c-alert) / <alpha-value>)',
        /* 旧名字按角色映射，未重写的页面自动进入同一个世界 */
        paper: {
          DEFAULT: 'rgb(var(--c-paper) / <alpha-value>)',
          soft: 'rgb(var(--c-paper-soft) / <alpha-value>)',
          deep: 'rgb(var(--c-paper-deep) / <alpha-value>)',
          line: 'rgb(var(--c-paper-line) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          soft: 'rgb(var(--c-ink-soft) / <alpha-value>)',
          faint: 'rgb(var(--c-ink-faint) / <alpha-value>)',
          pale: 'rgb(var(--c-ink-pale) / <alpha-value>)',
        },
        cinnabar: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          soft: 'rgb(var(--c-accent-soft) / <alpha-value>)',
          pale: 'rgb(var(--c-accent-pale) / <alpha-value>)',
        },
        jade: {
          DEFAULT: 'rgb(var(--c-jade) / <alpha-value>)',
          pale: 'rgb(var(--c-jade-pale) / <alpha-value>)',
        },
      },
      fontFamily: {
        /* 旧名字 song 保留为这个世界的显示字：方块无衬线，不用衬线体 */
        song: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif'],
        ui: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif'],
        digit: ['"SF Mono"', '"JetBrains Mono"', 'Consolas', '"Liberation Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        paper: '0 1px 2px rgba(35,33,30,0.04), 0 8px 24px -16px rgba(35,33,30,0.28)',
        bar: '0 -1px 0 #E2DACA',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
