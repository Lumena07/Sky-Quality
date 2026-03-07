import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabaseServer', () => ({
  createSupabaseServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}))

describe('GET /api/activity-log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'User') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { roles: ['QUALITY_MANAGER'], departmentId: null },
                }),
            }),
          }),
        }
      }
      if (table === 'ActivityLog') {
        return {
          select: () => ({
            order: () => ({
              range: () => Promise.resolve({ data: [], error: null }),
            }),
            eq: function (this: unknown) {
              return this
            },
            gte: function (this: unknown) {
              return this
            },
            lte: function (this: unknown) {
              return this
            },
          }),
        }
      }
      return {}
    })
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No user') })
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/activity-log')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when user has no permission to view activity log', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'User') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { roles: ['STAFF'], departmentId: null },
                }),
            }),
          }),
        }
      }
      return { select: () => ({ order: () => ({ range: () => Promise.resolve({ data: [] }) }) }) }
    })
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/activity-log')
    const res = await GET(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('Only reviewers')
  })

  it('returns 200 and empty array when user has permission', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'User') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { roles: ['QUALITY_MANAGER'], departmentId: null },
                }),
            }),
          }),
        }
      }
      if (table === 'ActivityLog') {
        return {
          select: () => ({
            order: () => ({
              range: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }
      }
      return {}
    })
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/activity-log')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json).toHaveLength(0)
  })
})
