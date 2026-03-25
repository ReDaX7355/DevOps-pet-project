import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'

function makePool() {
  return {
    query: vi.fn(),
  }
}

describe('Todo API', () => {
  let pool
  let app

  beforeEach(() => {
    pool = makePool()
    app = createApp({ pool })
  })

  it('GET /api/todos возвращает список', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 2, title: 'B', completed: true },
        { id: 1, title: 'A', completed: false },
      ],
    })

    const res = await request(app).get('/api/todos')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      { id: 2, title: 'B', completed: true },
      { id: 1, title: 'A', completed: false },
    ])
    expect(pool.query).toHaveBeenCalledWith('SELECT id, title, completed FROM todos ORDER BY id DESC')
  })

  it('GET /api/todos при ошибке БД -> 500', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    pool.query.mockRejectedValueOnce(new Error('db down'))
    const res = await request(app).get('/api/todos')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch todos' })
    consoleErrorSpy.mockRestore()
  })

  it('POST /api/todos без title -> 400', async () => {
    const res = await request(app).post('/api/todos').send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Title is required' })
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('POST /api/todos c title не-строкой -> 400', async () => {
    const res = await request(app).post('/api/todos').send({ title: 123 })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Title is required' })
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('POST /api/todos создаёт todo -> 201', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 10, title: 'Hello', completed: false }],
    })

    const res = await request(app).post('/api/todos').send({ title: 'Hello' })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ id: 10, title: 'Hello', completed: false })
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO todos (title, completed) VALUES ($1, false) RETURNING id, title, completed',
      ['Hello'],
    )
  })

  it('POST /api/todos при ошибке БД -> 500', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    pool.query.mockRejectedValueOnce(new Error('db down'))
    const res = await request(app).post('/api/todos').send({ title: 'Hello' })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to create todo' })
    consoleErrorSpy.mockRestore()
  })

  it('PATCH /api/todos/:id обновляет completed -> 200', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'A', completed: true }],
    })

    const res = await request(app).patch('/api/todos/1').send({ completed: true })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 1, title: 'A', completed: true })
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE todos SET completed = COALESCE($1, completed) WHERE id = $2 RETURNING id, title, completed',
      [true, '1'],
    )
  })

  it('PATCH /api/todos/:id если не найдено -> 404', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).patch('/api/todos/999').send({ completed: true })
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Todo not found' })
  })

  it('PATCH /api/todos/:id при ошибке БД -> 500', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    pool.query.mockRejectedValueOnce(new Error('db down'))
    const res = await request(app).patch('/api/todos/1').send({ completed: true })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to update todo' })
    consoleErrorSpy.mockRestore()
  })

  it('DELETE /api/todos/:id удаляет -> 204', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
    const res = await request(app).delete('/api/todos/1')
    expect(res.status).toBe(204)
    expect(res.text).toBe('')
    expect(pool.query).toHaveBeenCalledWith('DELETE FROM todos WHERE id = $1 RETURNING id', ['1'])
  })

  it('DELETE /api/todos/:id если не найдено -> 404', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).delete('/api/todos/999')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Todo not found' })
  })

  it('DELETE /api/todos/:id при ошибке БД -> 500', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    pool.query.mockRejectedValueOnce(new Error('db down'))
    const res = await request(app).delete('/api/todos/1')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to delete todo' })
    consoleErrorSpy.mockRestore()
  })
})

