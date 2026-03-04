import React, { useEffect, useState } from 'react'

type Todo = {
  id: number
  title: string
  completed: boolean
}

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000')

export function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadTodos() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_URL}/api/todos`)
      if (!res.ok) throw new Error('Failed to load todos')
      const data: Todo[] = await res.json()
      setTodos(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTodos()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return

    try {
      setError(null)
      const res = await fetch(`${API_URL}/api/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      if (!res.ok) throw new Error('Failed to create todo')
      const created: Todo = await res.json()
      setTodos((prev) => [created, ...prev])
      setTitle('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  async function toggleTodo(todo: Todo) {
    try {
      setError(null)
      const res = await fetch(`${API_URL}/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !todo.completed }),
      })
      if (!res.ok) throw new Error('Failed to update todo')
      const updated: Todo = await res.json()
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  async function deleteTodo(id: number) {
    try {
      setError(null)
      const res = await fetch(`${API_URL}/api/todos/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 204) throw new Error('Failed to delete todo')
      setTodos((prev) => prev.filter((t) => t.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold mb-6 text-center">Todo App</h1>

        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Новая задача..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            disabled={!title.trim()}
          >
            Добавить
          </button>
        </form>

        {error && <div className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

        <div className="rounded-lg border border-slate-800 bg-slate-900/80 shadow-lg">
          {loading ? (
            <div className="p-4 text-sm text-slate-400">Загрузка...</div>
          ) : todos.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">Пока нет задач. Добавьте первую!</div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {todos.map((todo) => (
                <li key={todo.id} className="flex items-center gap-3 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => toggleTodo(todo)}
                    className="h-5 w-5 rounded border border-slate-500 flex items-center justify-center bg-slate-900"
                  >
                    {todo.completed && <span className="h-3 w-3 rounded bg-sky-400" />}
                  </button>
                  <span
                    className={`flex-1 text-sm ${
                      todo.completed ? 'line-through text-slate-500' : 'text-slate-100'
                    }`}
                  >
                    {todo.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteTodo(todo.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

