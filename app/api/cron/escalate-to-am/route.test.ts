import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockInsert = vi.fn()

vi.mock('@/lib/supabaseServer', () => ({
  createSupabaseAdminClient: () => ({
    from: mockFrom,
  }),
}))

describe('GET /api/cron/escalate-to-am', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'User') {
        return {
          select: () => ({
            eq: () => ({
              contains: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }
      }
      if (table === 'Finding') {
        return {
          select: () => ({
            neq: () =>
              Promise.resolve({
                data: [],
                error: null,
              }),
          }),
        }
      }
      if (table === 'FindingEscalation') {
        return {
          select: () => Promise.resolve({ data: [], error: null }),
        }
      }
      if (table === 'Notification') {
        return {
          insert: mockInsert.mockResolvedValue({ error: null }),
        }
      }
      return {}
    })
  })

  it('returns 401 when CRON_SECRET is set and Authorization header is missing', async () => {
    const prev = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'test-secret'
    try {
      const { GET } = await import('./route')
      const req = new Request('http://localhost/api/cron/escalate-to-am')
      const res = await GET(req)
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error).toBe('Unauthorized')
    } finally {
      process.env.CRON_SECRET = prev
    }
  })

  it('returns 200 when authorized and no AM users', async () => {
    const prev = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'test-secret'
    try {
      const { GET } = await import('./route')
      const req = new Request('http://localhost/api/cron/escalate-to-am', {
        headers: { Authorization: 'Bearer test-secret' },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.escalated).toBe(0)
    } finally {
      process.env.CRON_SECRET = prev
    }
  })
})
