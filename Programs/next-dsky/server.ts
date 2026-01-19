import { createServer } from 'http'
import { parse, fileURLToPath } from 'url'
import path from 'path'
import next from 'next'
import { WebSocketServer } from 'ws'
import { program } from 'commander'
import * as dotenv from 'dotenv'
import { initServer } from './src/server'

// Ensure Next resolves config/deps relative to this project directory,
// even if the process is launched from a parent folder (e.g. `Programs/`).
const projectDir = path.dirname(fileURLToPath(import.meta.url))
process.chdir(projectDir)

dotenv.config()

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'

program
    .option('-s, --serial <string>', 'Serial port path')
    .option('-i, --interface <string>', 'mDNS multicast outbound interface IPv4 (Windows multi-NIC fix)')
    .option('-b, --baud <number>', 'Baud rate', '9600')
    .option('-m, --mode <string>', 'Skip config, use source directly')
    .option('-y, --yaagc <string>', 'yaAGC version')
    .option('--shutdown <string>', 'Shutdown command (PRO---)')
    .option('-p, --port <number>', 'HTTP/WS port', '3000')
program.parse()
const options = program.opts()

const port = parseInt(options.port || '3000')

const app = next({ dev, hostname, port, dir: projectDir })
const handle = app.getRequestHandler()

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true)
        handle(req, res, parsedUrl)
    })

    // Create WebSocket server without attaching to HTTP server
    // We'll manually handle upgrade events to filter out Next.js HMR connections
    const wss = new WebSocketServer({ noServer: true })

    // Handle WebSocket upgrade manually to separate DSKY connections from Next.js HMR
    server.on('upgrade', (request, socket, head) => {
        const pathname = request.url || ''
        
        // Only handle DSKY WebSocket connections on /ws path
        if (pathname === '/ws' || pathname.startsWith('/ws?')) {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request)
            })
        }
        // All other upgrade requests (including /_next/ for HMR) are ignored
        // and will be handled by Next.js or left to timeout
    })

    // Initialize server-side logic (watchers, serial, config)
    initServer(wss, options)

    server.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`)
    })
})
