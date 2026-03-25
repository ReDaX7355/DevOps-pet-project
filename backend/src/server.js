import dotenv from 'dotenv'
import pkg from 'pg'
import { createApp, ensureSchema } from './app.js'

dotenv.config()

const { Pool } = pkg

const port = process.env.PORT || 4000

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL required')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const app = createApp({ pool })

// Запускаем сервер только при прямом запуске файла (а не при импорте в тестах).
if (import.meta.url === `file://${process.argv[1]}`) {
  ;(async () => {
    try {
      await ensureSchema({ pool })
      app.listen(port, () => {
        console.log(`Server listening on port ${port}`)
      })
    } catch (err) {
      console.error('Failed to initialize database schema')
      console.error(err)
      process.exit(1)
    }
  })()
}

export default app
