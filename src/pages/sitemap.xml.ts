// The sitemap: one page for now. /nest only redirects to /, so it stays out.
import type { APIRoute } from 'astro';
import { brand } from '../data/site';

const pages = ['/'];

export const GET: APIRoute = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
      .map((p) => `  <url><loc>${new URL(p, brand.url)}</loc></url>`)
      .join('\n')}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
