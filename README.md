# Stellar Dashboard

Dashboard público del ecosistema **Stellar Content Engine**, construido con [Astro](https://astro.build).

## Stack

- **Astro 5** — Static Site Generator
- **TypeScript** — Tipado estricto
- Contenido generado por [Stellar Content Engine](https://github.com/alexeisveliz95/github_start_manager)

## Archivos importantes

| Ruta | Propósito |
|------|-----------|
| `DASHBOARD.md` | Resumen general (generado por engine) |
| `Categorias/*.md` | Repos clasificados por categoría (generado por engine) |
| `Tendencias/*.md` | Histórico día a día de trending (generado por engine) |
| `src/lib/mdParser.ts` | Parsea los MD en build time para generar HTML |
| `src/pages/` | Páginas del dashboard |
| `src/components/` | Componentes reutilizables |
| `.github/workflows/deploy.yml` | Build + deploy a GitHub Pages |

## Desarrollo

```bash
npm install
npm run dev      # Servidor local
npm run build    # Build a dist/
npm run preview  # Previsualizar build
```

El build lee los archivos `DASHBOARD.md`, `Categorias/*.md` y `Tendencias/*.md` directamente. No necesitan frontmatter — el parser entiende el formato existente.

## Deploy

Automatico via GitHub Actions cuando se pushea a `main`:
1. `npm ci && npm run build`
2. `actions/upload-pages-artifact` desde `dist/`
3. `actions/deploy-pages` a GitHub Pages
