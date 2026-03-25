import express from 'express'
import cors from 'cors'

export function createApp({ pool }) {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() })
  })

  app.get('/api/todos', async (_req, res) => {
    try {
      const result = await pool.query('SELECT id, title, completed FROM todos ORDER BY id DESC')
      res.json(result.rows)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to fetch todos' })
    }
  })

  app.post('/api/todos', async (req, res) => {
    const { title } = req.body
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' })
    }

    try {
      const result = await pool.query(
        'INSERT INTO todos (title, completed) VALUES ($1, false) RETURNING id, title, completed',
        [title],
      )
      res.status(201).json(result.rows[0])
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to create todo' })
    }
  })

  app.patch('/api/todos/:id', async (req, res) => {
    const { id } = req.params
    const { completed } = req.body

    try {
      const result = await pool.query(
        'UPDATE todos SET completed = COALESCE($1, completed) WHERE id = $2 RETURNING id, title, completed',
        [completed, id],
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Todo not found' })
      }

      res.json(result.rows[0])
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to update todo' })
    }
  })

  app.delete('/api/todos/:id', async (req, res) => {
    const { id } = req.params

    try {
      const result = await pool.query('DELETE FROM todos WHERE id = $1 RETURNING id', [id])
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Todo not found' })
      }
      res.status(204).send()
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to delete todo' })
    }
  })

  return app
}

export async function ensureSchema({ pool }) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE
    );
  `)
}

