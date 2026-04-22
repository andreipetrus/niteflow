import { describe, it, expect } from 'vitest'
import { categorizeDomain } from '../categorize'

const taxonomy = {
  'reddit.com': 'Social Media',
  'google.com': 'Technology & Computing',
  'apple.com': 'Technology & Computing',
  'music.apple.com': 'Music and Audio',
  'whatsapp.net': 'Social Media',
}

describe('categorizeDomain', () => {
  it('returns category for exact match', () => {
    expect(categorizeDomain('reddit.com', taxonomy)).toBe('Social Media')
  })

  it('strips www. prefix', () => {
    expect(categorizeDomain('www.google.com', taxonomy)).toBe('Technology & Computing')
  })

  it('strips one subdomain label', () => {
    expect(categorizeDomain('dit.whatsapp.net', taxonomy)).toBe('Social Media')
  })

  it('strips multiple subdomain labels iteratively', () => {
    expect(categorizeDomain('app.m.reddit.com', taxonomy)).toBe('Social Media')
  })

  it('prefers the most specific match (music.apple.com over apple.com)', () => {
    expect(categorizeDomain('music.apple.com', taxonomy)).toBe('Music and Audio')
    expect(categorizeDomain('tv.apple.com', taxonomy)).toBe('Technology & Computing')
  })

  it('handles trailing dot', () => {
    expect(categorizeDomain('reddit.com.', taxonomy)).toBe('Social Media')
  })

  it('is case-insensitive', () => {
    expect(categorizeDomain('Reddit.COM', taxonomy)).toBe('Social Media')
  })

  it('returns null when no match at any level', () => {
    expect(categorizeDomain('random-cdn.example.io', taxonomy)).toBeNull()
  })

  it('does not match a 1-label strip result (avoids TLD matches)', () => {
    const onlyTld = { com: 'Something' }
    expect(categorizeDomain('foo.bar.com', onlyTld)).toBeNull()
  })
})
