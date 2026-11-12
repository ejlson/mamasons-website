// robots.txt, built from brand.url so it follows the domain when that is confirmed
import type { APIRoute } from 'astro';
import { brand } from '../data/site';

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', brand.url)}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
