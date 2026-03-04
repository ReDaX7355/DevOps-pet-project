import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import pkg from 'pg'

dotenv.config()

const { Pool } = pkg

const app = express()
const port = process.env.PORT || 4000

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

app.use(cors())
app.use(express.json())

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE
    );
  `)
}

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

;(async () => {
  try {
    await ensureSchema()
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`)
    })
  } catch (err) {
    console.error('Failed to initialize database schema')
    console.error(err)
    process.exit(1)
  }
})()

