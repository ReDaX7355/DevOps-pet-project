import { describe, test, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'

describe('API /health', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('GET /health возвращает 200', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pool = { query: vi.fn() }
    const app = createApp({ pool })
    const response = await request(app).get('/health').expect(200)
    expect(response.body.status).toBe('OK')
    expect(response.body.timestamp).toBeDefined()
    consoleErrorSpy.mockRestore()
  })
})
