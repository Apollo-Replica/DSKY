import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { WebSocketServer } from 'ws'
import { program } from 'commander'
import * as dotenv from 'dotenv'
import { initServer } from './src/server'

// Where the code lives. Under tsx this is the project folder; in the bundled
// Windows build (dist/server.cjs) it is the install folder, next to `out/`.
const appDir = __dirname

program
    .option('-s, --serial <string>', 'Serial port path')
    .option('-i, --interface <string>', 'mDNS multicast outbound interface IPv4 (Windows multi-NIC fix)')
    .option('-b, --baud <number>', 'Baud rate', '9600')
    .option('-m, --mode <string>', 'Skip config, use source directly')
    .option('-y, --yaagc <string>', 'yaAGC version')
    .option('--shutdown <string>', 'Shutdown command (PRO---)')
    .option('--reboot <string>', 'Reboot command')
    .option('--wifi-connect', 'Enable WiFi setup (runs sudo wifi-connect --portal-ssid "DSKY Replica")')
    .option('-p, --port <number>', 'HTTP/WS port', '3000')
    .option('--data-dir <path>', 'Folder for .env and saved settings (default: the app folder)')
    .option('--open', 'Open the DSKY in the browser once the server is up')
program.parse()
const options = program.opts()

// Settings files (.env, ha_entities.json, game_scores.json, ...) are resolved
// relative to the working directory. On the Orange Pi that is the app folder;
// the Windows install keeps them in %APPDATA% so reinstalls don't touch them.
const dataDir = path.resolve(options.dataDir || process.env.DSKY_DATA_DIR || appDir)
fs.mkdirSync(dataDir, { recursive: true })
process.chdir(dataDir)
process.env.DSKY_APP_DIR = appDir

dotenv.config()

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(options.port || '3000')
const url = `http://${hostname}:${port}`

const openBrowser = () => {
    const cmd = process.platform === 'win32' ? `start "" "${url}"`
        : process.platform === 'darwin' ? `open "${url}"`
        : `xdg-open "${url}"`
    exec(cmd, () => { /* nothing to do if there is no browser */ })
}

// Runtime settings for the static page (it can't read env vars itself).
const envScript = () =>
    `window.__DSKY_ENV__=${JSON.stringify({
        display: process.env.DSKY_DISPLAY === 'lcd480' ? 'lcd480' : 'amoled544',
    })};`

const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
}

/** Serves the `next build` static export (out/). */
const staticHandler = (root: string) => {
    if (!fs.existsSync(path.join(root, 'index.html'))) {
        console.error(`> No build found at ${root}. Run "npm run build" first.`)
        process.exit(1)
    }
    const send = (res: ServerResponse, file: string, status = 200) => {
        const ext = path.extname(file).toLowerCase()
        const headers: Record<string, string> = { 'Content-Type': MIME[ext] || 'application/octet-stream' }
        headers['Cache-Control'] = file.includes(`${path.sep}_next${path.sep}static${path.sep}`)
            ? 'public, max-age=31536000, immutable'
            : 'no-cache'
        res.writeHead(status, headers)
        fs.createReadStream(file).pipe(res)
    }
    const isFile = (p: string) => { try { return fs.statSync(p).isFile() } catch { return false } }

    return (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405).end()
            return
        }
        let pathname: string
        try {
            pathname = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname)
        } catch {
            res.writeHead(400).end()
            return
        }
        const base = path.join(root, path.normalize(pathname))
        if (base !== root && !base.startsWith(root + path.sep)) {
            res.writeHead(403).end()
            return
        }
        for (const candidate of [base, path.join(base, 'index.html'), `${base}.html`]) {
            if (isFile(candidate)) return send(res, candidate)
        }
        const notFound = path.join(root, '404.html')
        if (isFile(notFound)) return send(res, notFound, 404)
        res.writeHead(404).end()
    }
}

const start = async () => {
    let handle: (req: IncomingMessage, res: ServerResponse) => void
    if (dev) {
        // Dev only: Next with hot reload. Not bundled into the Windows build.
        const { default: next } = await import('next')
        const app = next({ dev, hostname, port, dir: appDir })
        await app.prepare()
        const nextHandle = app.getRequestHandler()
        handle = (req, res) => nextHandle(req, res)
    } else {
        handle = staticHandler(path.join(appDir, 'out'))
    }

    const server = createServer((req, res) => {
        if (req.url?.split('?')[0] === '/dsky-env.js') {
            res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' })
            res.end(envScript())
            return
        }
        handle(req, res)
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

    server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && options.open) {
            // Already running (e.g. the Start menu shortcut clicked twice): just show it.
            console.log(`> Port ${port} is busy; assuming the DSKY is already running.`)
            openBrowser()
            setTimeout(() => process.exit(0), 500)
            return
        }
        console.error(err)
        process.exit(1)
    })

    server.listen(port, () => {
        // Initialize server-side logic (watchers, serial, config) only once we
        // own the port, so a second copy doesn't grab the serial port.
        initServer(wss, options)
        console.log(`> Ready on ${url}`)
        if (dataDir !== appDir) console.log(`> Settings folder: ${dataDir}`)
        if (options.open) openBrowser()
    })
}

start()
