export interface DashboardStats {
  totalItems: number;
  activeCategories: number;
  lastUpdated: string;
  categories: CategorySummary[];
}

export interface CategorySummary {
  name: string;
  projects: number;
  bestScore: number;
  slug: string;
}

export interface CategoryDetail {
  name: string;
  slug: string;
  lastUpdated: string;
  totalProjects: number;
  bestScore: number;
  totalStars: string;
  projects: ProjectRow[];
}

export interface ProjectRow {
  name: string;
  url: string;
  score: number;
  stars: string;
  starsRaw: number;
  momentumBar: string;
  description: string;
}

export interface TrendingReport {
  date: string;
  slug: string;
  totalRepos: number;
  hotZone: number;
  totalStarsGained: string;
  topRepo: {
    name: string;
    url: string;
    growth: number;
    growthPercent: string;
    description: string;
  } | null;
  ranking: TrendingRow[];
  topFive: TopFiveDetail[];
}

export interface TrendingRow {
  rank: number;
  name: string;
  url: string;
  owner: string;
  stars: string;
  growth: number;
  momentumBar: string;
  hot: boolean;
}

export interface TopFiveDetail {
  rank: number;
  name: string;
  url: string;
  description: string;
  stars: string;
  starsRaw: number;
  growth: number;
  momentumBar: string;
  score: number;
  tier: string;
  tierIcon: string;
  threshold: string;
}
