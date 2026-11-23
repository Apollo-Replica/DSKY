// Starts the DSKY server: HTTP (frontend), WebSocket (/ws) and the server-side
// logic (serial, integrations, mDNS). Used by server.ts (CLI: Orange Pi, dev)
// and, bundled into server.cjs, by the Windows desktop app (desktop/).

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'http'
import fs from 'fs'
import path from 'path'
import { WebSocketServer } from 'ws'
import * as dotenv from 'dotenv'
import { initServer } from './server'

export interface StartOptions {
    /** Folder with the code: `out/` (static frontend) lives here. */
    appDir: string
    /** Folder for .env and saved settings; becomes the working directory. */
    dataDir: string
    port: number
    /** If the port is taken, use any free one instead of failing. */
    anyPortIfBusy?: boolean
    dev?: boolean
    /** Remaining CLI options for initServer (serial, baud, mode, ...). */
    [key: string]: unknown
}

export interface RunningServer {
    port: number
    url: string
    server: Server
}

const hostname = 'localhost'

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
        throw new Error(`No build found at ${root}. Run "npm run build" first.`)
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

const listen = (server: Server, port: number) =>
    new Promise<number>((resolve, reject) => {
        const onError = (err: Error) => { server.off('listening', onListening); reject(err) }
        const onListening = () => {
            server.off('error', onError)
            const addr = server.address()
            resolve(typeof addr === 'object' && addr ? addr.port : port)
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(port)
    })

export async function startServer(opts: StartOptions): Promise<RunningServer> {
    // Settings files (.env, ha_entities.json, game_scores.json, ...) are
    // resolved relative to the working directory.
    fs.mkdirSync(opts.dataDir, { recursive: true })
    process.chdir(opts.dataDir)
    process.env.DSKY_APP_DIR = opts.appDir
    dotenv.config()

    let handle: (req: IncomingMessage, res: ServerResponse) => void
    if (opts.dev) {
        // Dev only: Next with hot reload. Never reached in the packaged builds.
        const { default: next } = await import('next')
        const app = next({ dev: true, hostname, port: opts.port, dir: opts.appDir })
        await app.prepare()
        const nextHandle = app.getRequestHandler()
        handle = (req, res) => nextHandle(req, res)
    } else {
        handle = staticHandler(path.join(opts.appDir, 'out'))
    }

    const server = createServer((req, res) => {
        if (req.url?.split('?')[0] === '/dsky-env.js') {
            res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' })
            res.end(envScript())
            return
        }
        handle(req, res)
    })

    // WebSocket server not attached to the HTTP server: upgrades are routed
    // by hand so Next.js HMR connections (dev) are left alone.
    const wss = new WebSocketServer({ noServer: true })
    server.on('upgrade', (request, socket, head) => {
        const pathname = request.url || ''
        if (pathname === '/ws' || pathname.startsWith('/ws?')) {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request)
            })
        }
    })

    let port: number
    try {
        port = await listen(server, opts.port)
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE' || !opts.anyPortIfBusy) throw err
        console.log(`> Port ${opts.port} is busy; using a free one`)
        port = await listen(server, 0)
    }

    // Server-side logic (watchers, serial, config) only once we own the port,
    // so a second copy never grabs the serial port.
    initServer(wss, { ...opts, port: String(port) })
    const url = `http://${hostname}:${port}`
    console.log(`> Ready on ${url}`)
    if (opts.dataDir !== opts.appDir) console.log(`> Settings folder: ${opts.dataDir}`)
    return { port, url, server }
}
