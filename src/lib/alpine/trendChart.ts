export interface AlpineTrendRow {
  name: string
  rank: number
  growth: number
  url: string
  hot: boolean
}

export function trendChart() {
  return {
    ranking: [] as AlpineTrendRow[],
    maxBars: 15,
    showAll: false,
    hoveredRow: null as AlpineTrendRow | null,

    init() {
      const el = this.$el.querySelector(
        '[hidden]',
      ) as HTMLElement | null
      if (el) {
        this.ranking = JSON.parse(el.textContent ?? '[]')
      }
      const mb = this.$el.dataset.maxBars
      if (mb) this.maxBars = parseInt(mb, 10)
    },

    displayRows() {
      return this.showAll
        ? this.ranking
        : this.ranking.slice(0, this.maxBars)
    },

    maxGrowth() {
      const disp = this.displayRows()
      return Math.max(...disp.map((r: AlpineTrendRow) => r.growth), 1)
    },

    toggleShowAll() {
      this.showAll = !this.showAll
    },

    barHeight(growth: number) {
      return Math.max((growth / this.maxGrowth()) * 100, 1)
    },

    formatGrowth(growth: number) {
      if (growth >= 1000) return (growth / 1000).toFixed(1) + 'k'
      return String(growth)
    },

    truncateName(name: string) {
      return name.length > 10 ? name.slice(0, 8) + '\u2026' : name
    },

    setHover(row: AlpineTrendRow | null) {
      this.hoveredRow = row
    },

    clearHover() {
      this.hoveredRow = null
    },
  }
}
