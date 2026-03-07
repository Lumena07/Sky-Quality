import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockInsert = vi.fn()

vi.mock('@/lib/supabaseServer', () => ({
  createSupabaseAdminClient: () => ({
    from: mockFrom,
  }),
}))

describe('GET /api/cron/training-expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'TrainingRecord') {
        return {
          select: () => ({
            not: () => ({
              gte: () => ({
                lte: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
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
      const req = new Request('http://localhost/api/cron/training-expiry')
      const res = await GET(req)
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error).toBe('Unauthorized')
    } finally {
      process.env.CRON_SECRET = prev
    }
  })

  it('returns 200 and ok: true when authorized and no expiring records', async () => {
    const prev = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'test-secret'
    try {
      const { GET } = await import('./route')
      const req = new Request('http://localhost/api/cron/training-expiry', {
        headers: { Authorization: 'Bearer test-secret' },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.created).toBe(0)
    } finally {
      process.env.CRON_SECRET = prev
    }
  })
})
