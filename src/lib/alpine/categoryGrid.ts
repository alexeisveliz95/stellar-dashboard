export interface AlpineCategory {
  title: string
  slug: string
  count: number
  description: string
  color: string
}

export function categoryGrid() {
  return {
    all: [] as AlpineCategory[],
    filtered: [] as AlpineCategory[],
    search: '',

    init() {
      const el = this.$el.querySelector(
        '[hidden]',
      ) as HTMLElement | null
      if (!el) return
      this.all = JSON.parse(el.textContent ?? '[]')
      this.filtered = [...this.all]
    },

    apply() {
      if (!this.search.trim()) {
        this.filtered = [...this.all]
        return
      }
      const q = this.search.trim().toLowerCase()
      this.filtered = this.all.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      )
    },
  }
}
