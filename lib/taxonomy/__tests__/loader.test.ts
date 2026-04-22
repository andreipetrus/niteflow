import { describe, it, expect } from 'vitest'
import { parseTaxonomyFile } from '../loader'

describe('parseTaxonomyFile — hosts format', () => {
  it('extracts domains from standard hosts lines', () => {
    const input = `
# Comment line
0.0.0.0 facebook.com
0.0.0.0 instagram.com
127.0.0.1 twitter.com
`
    expect(parseTaxonomyFile(input, 'hosts')).toEqual([
      'facebook.com',
      'instagram.com',
      'twitter.com',
    ])
  })

  it('skips comments, blank lines, and localhost entries', () => {
    const input = `
# This is a social media hosts file
0.0.0.0 localhost
0.0.0.0 local
0.0.0.0 broadcasthost

0.0.0.0 tiktok.com
`
    expect(parseTaxonomyFile(input, 'hosts')).toEqual(['tiktok.com'])
  })

  it('lowercases domains and dedupes within a source', () => {
    const input = `
0.0.0.0 YouTube.com
0.0.0.0 youtube.com
0.0.0.0 YOUTUBE.COM
`
    expect(parseTaxonomyFile(input, 'hosts')).toEqual(['youtube.com'])
  })

  it('strips inline comments', () => {
    const input = `0.0.0.0 reddit.com  # reddit comment`
    expect(parseTaxonomyFile(input, 'hosts')).toEqual(['reddit.com'])
  })
})

describe('parseTaxonomyFile — domains format', () => {
  it('parses plain domain lines', () => {
    const input = `
# Hagezi native list
facebook.com
m.facebook.com
fbcdn.net
`
    expect(parseTaxonomyFile(input, 'domains')).toEqual([
      'facebook.com',
      'm.facebook.com',
      'fbcdn.net',
    ])
  })

  it('strips adblock-style wrappers (|| and ^)', () => {
    const input = `
||ads.example.com^
||tracker.example.com
example.com
`
    expect(parseTaxonomyFile(input, 'domains')).toEqual([
      'ads.example.com',
      'tracker.example.com',
      'example.com',
    ])
  })

  it('rejects lines without a dot', () => {
    const input = `
broken
still-broken
valid.example.com
`
    expect(parseTaxonomyFile(input, 'domains')).toEqual(['valid.example.com'])
  })
})
