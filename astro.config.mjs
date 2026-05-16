import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

export default defineConfig({
  site: "https://alexeisveliz95.github.io",
  base: "/stellar-dashboard",
  outDir: "dist",
  build: {
    format: "directory",
  },

  markdown: {
    gfm: true,
    smartypants: true,
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: "wrap" }],
      [rehypeKatex, { output: "html" }],
    ],
    shikiConfig: {
      theme: "github-dark-dimmed",
      wrap: true,
    },
  },

  integrations: [
    mdx({
      gfm: true,
      smartypants: true,
      remarkPlugins: [remarkGfm, remarkMath],
      rehypePlugins: [
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: "wrap" }],
        [rehypeKatex, { output: "html" }],
      ],
      extendMarkdownConfig: true,
    }),
    tailwind({
      applyBaseStyles: true,
    }),
    sitemap({
      filter: (page) => !page.includes("/404"),
    }),
  ],
});
