import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

type Todo = { id: number; title: string; completed: boolean }

describe('App (Todo UI)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock as any)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('показывает "Загрузка..." пока GET /api/todos не вернётся, затем пустое сообщение', async () => {
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          // Эмулируем "висящий" запрос, чтобы проверить состояние загрузки.
          ;(globalThis as any).__resolveFetchTodos = resolve
        }),
    )

    render(<App />)

    expect(await screen.findByText('Загрузка...')).toBeInTheDocument()

    ;(globalThis as any).__resolveFetchTodos({
      ok: true,
      status: 200,
      json: async () => [],
    })

    expect(await screen.findByText('Пока нет задач. Добавьте первую!')).toBeInTheDocument()
  })

  it('даёт добавить задачу: POST /api/todos и обновляет список', async () => {
    const created: Todo = { id: 1, title: 'Task 1', completed: false }

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      }) // GET /api/todos
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => created,
      }) // POST /api/todos

    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Пока нет задач. Добавьте первую!')

    const input = screen.getByPlaceholderText('Новая задача...') as HTMLInputElement
    const addBtn = screen.getByRole('button', { name: 'Добавить' })

    await user.type(input, 'Task 1')
    await user.click(addBtn)

    expect(await screen.findByText('Task 1')).toBeInTheDocument()
    expect(input.value).toBe('')
  })

  it('позволяет переключить completed: PATCH /api/todos/:id', async () => {
    const initial: Todo = { id: 1, title: 'Task 1', completed: false }
    const updated: Todo = { ...initial, completed: true }

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [initial],
      }) // GET
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => updated,
      }) // PATCH

    const user = userEvent.setup()
    render(<App />)

    const title = await screen.findByText('Task 1')
    const li = title.closest('li')!
    const buttons = within(li).getAllByRole('button')
    const toggleBtn = buttons[0] // кнопка переключения completed в <li>

    await user.click(toggleBtn)

    expect(title).toHaveClass('line-through')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/todos/1'),
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('удаляет задачу: DELETE /api/todos/:id', async () => {
    const initial: Todo = { id: 1, title: 'Task 1', completed: false }

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [initial],
      }) // GET
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      }) // DELETE

    const user = userEvent.setup()
    render(<App />)

    const title = await screen.findByText('Task 1')
    const li = title.closest('li')!
    const deleteBtn = within(li).getByRole('button', { name: 'Удалить' })

    await user.click(deleteBtn)

    expect(await screen.findByText('Пока нет задач. Добавьте первую!')).toBeInTheDocument()
  })

  it('показывает ошибку если GET /api/todos возвращает ok=false', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    render(<App />)

    expect(await screen.findByText('Failed to load todos')).toBeInTheDocument()
  })
})

