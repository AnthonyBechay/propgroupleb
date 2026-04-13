// Custom Next.js server with proper keep-alive settings for Cloudflare.
//
// Node.js defaults to a 5-second keep-alive timeout but Cloudflare expects
// ~100 seconds. When Node closes the connection early, Cloudflare tries to
// reuse a dead socket → intermittent 520 / ERR_CONNECTION_TIMED_OUT errors.
// Safari handles this gracefully; Chrome does not.

const { createServer } = require('http')
const path = require('path')
const next = require('next')

const port = parseInt(process.env.PORT || '3000', 10)
const dir = path.join(__dirname)
const app = next({ dev: false, dir })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res)
  })

  // Keep-alive timeout MUST be longer than Cloudflare's (100s).
  server.keepAliveTimeout = 120_000

  // Headers timeout must be greater than keepAliveTimeout.
  server.headersTimeout = 125_000

  server.listen(port, '0.0.0.0', () => {
    console.log(`> Ready on http://0.0.0.0:${port}`)
  })
})
