import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { timeout } from 'hono/timeout'
import { secureHeaders } from 'hono/secure-headers'
import { trimTrailingSlash } from 'hono/trailing-slash'
import { serveStatic } from 'hono/bun'
import { initDB } from './lib/db'
import session from './middlewares/session'
import authRoutes from './routes/auth.routes.js'
import containersRoutes from './routes/containers.routes.js'
import { scheduleJob } from 'node-schedule'
import { checkAllContainersForUpdates } from './repository/updates'
import { scanAllContainers } from './repository/grype'

await initDB()

const app = new Hono()
app.use(trimTrailingSlash())
app.use(
    '*',
    cors({
        origin: Bun.env.APP_URL || 'http://localhost:5173',
        credentials: true
    })
)
app.use(secureHeaders())
app.use(timeout(30000))

app.use(session)

app.get('/healthz', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.route('/api/auth', authRoutes)
app.route('/api/containers', containersRoutes)

app.get('/assets/*', serveStatic({ root: './src/fe-dist' }))
app.get('/favicon.ico', serveStatic({ path: './src/fe-dist/favicon.ico' }))

app.get(
    '*',
    serveStatic({
        path: './src/fe-dist/index.html'
    })
)

app.onError((err, c) => {
    console.error('Unhandled error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
})

scheduleJob(Bun.env.SCAN_CRON_STRING, function(){
    checkAllContainersForUpdates()
    scanAllContainers()
});

export default {
    port: Bun.env.APP_PORT || 3000,
    fetch: app.fetch
}
