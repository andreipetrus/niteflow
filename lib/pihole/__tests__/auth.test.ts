import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Must import after stubbing fetch
const { acquireToken, isTokenExpired } = await import('../auth')

beforeEach(() => {
  mockFetch.mockReset()
})

describe('acquireToken', () => {
  it('returns sid and expiresAt on successful auth', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { valid: true, sid: 'abc123', validity: 1800, csrf: 'tok' },
      }),
    })

    const result = await acquireToken('http://pi.hole', 'secret', false)
    expect(result.sid).toBe('abc123')
    expect(result.expiresAt).toBeGreaterThan(Date.now() / 1000 + 1700)
  })

  it('throws on invalid credentials (session.valid = false)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { valid: false, sid: '', validity: 0 },
      }),
    })

    await expect(acquireToken('http://pi.hole', 'wrong', false)).rejects.toThrow(
      'Invalid Pi-hole credentials'
    )
  })

  it('throws on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 })

    await expect(acquireToken('http://pi.hole', 'secret', false)).rejects.toThrow('503')
  })

  it('posts to /api/auth with password in body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: { valid: true, sid: 'sid1', validity: 1800, csrf: '' } }),
    })

    await acquireToken('http://pi.hole:8080', 'mypassword', false)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://pi.hole:8080/api/auth',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'mypassword' }),
      })
    )
  })
})

describe('isTokenExpired', () => {
  it('returns true when expiresAt is in the past', () => {
    expect(isTokenExpired(Date.now() / 1000 - 10)).toBe(true)
  })

  it('returns true when within 60s of expiry (buffer)', () => {
    expect(isTokenExpired(Date.now() / 1000 + 30)).toBe(true)
  })

  it('returns false when token has more than 60s remaining', () => {
    expect(isTokenExpired(Date.now() / 1000 + 120)).toBe(false)
  })
})
