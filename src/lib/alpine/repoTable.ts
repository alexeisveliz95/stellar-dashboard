export interface AlpineRepo {
  name: string
  description: string
  score: number
  stars: number
  url: string
  momentumBar: string
  rank: number
}

export function repoTable() {
  return {
    all: [] as AlpineRepo[],
    filtered: [] as AlpineRepo[],
    search: '',
    sortKey: 'score',
    filterKey: 'all',

    init() {
      const el = this.$el.querySelector(
        '[hidden]',
      ) as HTMLElement | null
      if (!el) return
      this.all = JSON.parse(el.textContent ?? '[]')
      this.filtered = [...this.all]
    },

    apply() {
      let result = [...this.all]

      if (this.search.trim()) {
        const q = this.search.trim().toLowerCase()
        result = result.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q),
        )
      }

      if (this.filterKey !== 'all') {
        result = result.filter((r) => {
          if (this.filterKey === 'high') return r.score >= 0.8
          if (this.filterKey === 'medium') return r.score >= 0.5 && r.score < 0.8
          if (this.filterKey === 'low') return r.score < 0.5
          return true
        })
      }

      result.sort((a, b) => {
        if (this.sortKey === 'score') return b.score - a.score
        if (this.sortKey === 'stars') return b.stars - a.stars
        if (this.sortKey === 'name') return a.name.localeCompare(b.name)
        return 0
      })

      this.filtered = result
    },

    rankLabel(index: number) {
      if (index === 0) return '\uD83E\uDD47'
      if (index === 1) return '\uD83E\uDD48'
      if (index === 2) return '\uD83E\uDD49'
      return '#' + (index + 1)
    },

    rankClass(index: number) {
      if (index === 0) return 'gold'
      if (index === 1) return 'silver'
      if (index === 2) return 'bronze'
      return ''
    },
  }
}
