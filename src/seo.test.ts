import { describe, it, expect } from 'vitest'
// `?raw` rather than `node:fs`: Vite declares these modules itself
// (`vite/client`, referenced from src/vite-env.d.ts), so the two files can
// be read without adding `@types/node` to the project for one test — and
// `npm run build` typechecks `src`, so a node builtin here would break the
// build even though the test itself passed.
import html from '../index.html?raw'
import viteConfig from '../vite.config.ts?raw'

/**
 * What a link scraper and a crawler receive.
 *
 * After the trim (CLAUDE.md's SEO round) what is left in `index.html` is
 * the part that pays for itself: the sharing card, and enough machine-
 * readable description for a crawler that does not run JavaScript. There
 * is no prose fallback, no canonical and no sitemap any more, and the
 * assertions below went with them — a test that outlives what it
 * describes is worse than no test.
 *
 * Three things are worth holding still, all of them invisible to the
 * build when they break:
 *
 *  1. the deployed URL is written by hand in two files that cannot read
 *     each other (a static `<meta>` tag can't read `base`), so they drift;
 *  2. the Open Graph and Twitter cards are two tag families describing one
 *     card, maintained side by side, so editing one and forgetting the
 *     other is the obvious mistake;
 *  3. the structured data is a JSON string inside HTML, where a malformed
 *     edit is invisible until a validator sees it.
 *
 * Written as invariants rather than as string snapshots: the wording may
 * change freely, the properties may not.
 */

/**
 * The one sentence the whole game turns on (concept 6.4). Matches i18n's
 * English `introRule` word for word — the served page is in the app's own
 * fallback language, so the two say the same thing by construction.
 */
const RULE = 'every number exactly once'

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
  it('states the one rule in the description', () => {
    // The rule — every number used exactly once — is the single thing the
    // board itself never says in words. With the prose fallback gone this
    // tag and the JSON-LD below are the only places a crawler can read it.
    expect(meta('name', 'description')).toContain(RULE)
  })

  it('agrees with vite.config.ts about where the site is deployed', () => {
    const base = viteConfig.match(/base:\s*'([^']+)'/)?.[1]
    const siteUrl = viteConfig.match(/const siteUrl = '([^']+)'/)?.[1]
    expect(base).toBeTruthy()
    expect(siteUrl).toBeTruthy()
    expect(siteUrl!.endsWith(base!)).toBe(true)
    expect(meta('property', 'og:url')).toBe(siteUrl)

    // Both scrapers ignore a relative image, so this one has to be absolute.
    const image = meta('property', 'og:image')!
    expect(image.startsWith(siteUrl!)).toBe(true)
    expect(meta('name', 'twitter:image')).toBe(image)
  })

  it('says the same thing on the Open Graph and Twitter cards', () => {
    // Deliberately checks that the two are equal rather than what they
    // say, so the copy stays free to change without editing a test.
    expect(meta('name', 'twitter:title')).toBe(meta('property', 'og:title'))
    expect(meta('name', 'twitter:description')).toBe(meta('property', 'og:description'))
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

  it('keeps the description inside what a card and a result snippet show', () => {
    // Past this length a search result and most link previews truncate
    // mid-sentence, and the part that gets cut is the part that says what
    // the game is. The number is the usual rendering limit, not a spec.
    const description = meta('name', 'description')!
    expect(description.length).toBeGreaterThanOrEqual(70)
    expect(description.length).toBeLessThanOrEqual(165)
  })
})
