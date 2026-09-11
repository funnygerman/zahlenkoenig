import { describe, it, expect } from 'vitest'
// `?raw` rather than `node:fs`: Vite declares these modules itself
// (`vite/client`, referenced from src/vite-env.d.ts), so the two files can
// be read without adding `@types/node` to the project for one test — and
// `npm run build` typechecks `src`, so a node builtin here would break the
// build even though the test itself passed.
import html from '../index.html?raw'
import viteConfig from '../vite.config.ts?raw'

/**
 * What a search engine and an LLM-based crawler receive.
 *
 * The app is a client-rendered SPA on GitHub Pages: there is no server to
 * render into `index.html`, so that file *is* the page for every crawler
 * that does not run JavaScript — which is most of the LLM ones. Three
 * facts about it are worth holding still, and all three are things a
 * later edit could break silently, because nothing else in the build
 * fails when they do:
 *
 *  1. the deployed URL is written down by hand in two files that cannot
 *     read each other (a static `<meta>` tag can't read `base`), so they
 *     can drift;
 *  2. the no-JavaScript fallback inside `#root` is the only prose on the
 *     page, and deleting it leaves a crawler with an empty `<div>`;
 *  3. the structured data is a JSON string inside HTML, so a malformed
 *     edit is invisible until a validator sees it.
 *
 * Written as invariants rather than as string snapshots: the wording may
 * change freely, the properties may not.
 */

/** The one sentence the whole game turns on (concept 6.4, i18n's `introRule`). */
const RULE = 'jede Zahl genau einmal'

function meta(attr: 'name' | 'property', key: string): string | null {
  const m = html.match(
    new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`, 's'),
  )
  if (m) return m[1]
  // The longer tags are wrapped across lines with content on its own line.
  const wrapped = html.match(
    new RegExp(`${attr}="${key}"\\s*\\n\\s*content="([^"]*)"`, 's'),
  )
  return wrapped ? wrapped[1] : null
}

describe('index.html, as a crawler receives it', () => {
  it('states the one rule both in the description and in the visible fallback', () => {
    // The rule — every number used exactly once — is the single thing the
    // board itself never says in words. If it is missing here, nothing a
    // crawler reads explains what the game is.
    expect(meta('name', 'description')).toContain(RULE)
    const fallback = html.slice(html.indexOf('<div id="root">'), html.indexOf('</body>'))
    expect(fallback).toContain(RULE)
    expect(fallback).toMatch(/<h1[^>]*>\s*Zahlenkönig\s*<\/h1>/)
  })

  it('agrees with vite.config.ts about where the site is deployed', () => {
    // `base` is the path; `siteUrl` is the absolute URL the meta tags need
    // and cannot compute for themselves. This is the drift that a build
    // would never catch on its own.
    const base = viteConfig.match(/base:\s*'([^']+)'/)?.[1]
    const siteUrl = viteConfig.match(/const siteUrl = '([^']+)'/)?.[1]
    expect(base).toBeTruthy()
    expect(siteUrl).toBeTruthy()
    expect(siteUrl!.endsWith(base!)).toBe(true)

    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
    expect(canonical).toBe(siteUrl)
    expect(meta('property', 'og:url')).toBe(siteUrl)

    // Both scrapers ignore a relative image, so this one has to be absolute.
    const image = meta('property', 'og:image')!
    expect(image.startsWith(siteUrl!)).toBe(true)
    expect(meta('name', 'twitter:image')).toBe(image)
  })

  it('carries structured data that parses and points at the same URL', () => {
    const raw = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    )?.[1]
    expect(raw).toBeTruthy()
    const data = JSON.parse(raw!) as {
      '@graph': Array<{ '@type': string | string[]; url?: string; description?: string }>
    }
    const siteUrl = viteConfig.match(/const siteUrl = '([^']+)'/)![1]
    const app = data['@graph'].find((n) =>
      ([] as string[]).concat(n['@type']).includes('SoftwareApplication'),
    )
    expect(app).toBeDefined()
    expect(app!.url).toBe(siteUrl)
    expect(app!.description).toContain(RULE)
  })

  it('keeps title and description inside what a result snippet shows', () => {
    // Not cosmetic: past these lengths a search result silently truncates
    // mid-sentence, and the part that gets cut is the part that says what
    // the game is. The numbers are the usual rendering limits, not a spec.
    expect(html.match(/<title>([^<]*)<\/title>/)![1].length).toBeLessThanOrEqual(60)
    const description = meta('name', 'description')!
    expect(description.length).toBeGreaterThanOrEqual(70)
    expect(description.length).toBeLessThanOrEqual(165)
  })
})
