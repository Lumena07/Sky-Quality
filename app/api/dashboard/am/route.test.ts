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

describe('GET /api/dashboard/am', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'User') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { roles: ['ACCOUNTABLE_MANAGER'], departmentId: null },
                }),
            }),
          }),
        }
      }
      if (table === 'FindingEscalation') {
        return {
          select: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }
      }
      if (table === 'CorrectiveAction' || table === 'Finding') {
        return {
          select: () => ({
            in: () => ({
              lt: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      }
    })
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No user') })
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/dashboard/am')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not AM or admin/QM', async () => {
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
      return {}
    })
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/dashboard/am')
    const res = await GET(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('Only Accountable Manager')
  })

  it('returns 200 with escalations and stats when user is AM', async () => {
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
                  data: { roles: ['ACCOUNTABLE_MANAGER'], departmentId: null },
                }),
            }),
          }),
        }
      }
      if (table === 'FindingEscalation') {
        return {
          select: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }
      }
      if (table === 'CorrectiveAction') {
        return {
          select: () => ({
            in: () => ({
              lt: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'Finding') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], count: 0, error: null }),
          }),
        }
      }
      return {
        select: () =>
          Promise.resolve({
            data: [],
            error: null,
          }),
      }
    })
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/dashboard/am')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('escalations')
    expect(json).toHaveProperty('overdueCAPs')
    expect(json).toHaveProperty('openFindingsCount')
    expect(json).toHaveProperty('openByDepartment')
  })
})
