// Next DSKY desktop app (Windows installer). Electron main process: runs the
// DSKY server in-process and shows it in its own window. No console, no
// browser; the log is kept in a file and shown on demand (View > Logs).
//
// Bundled by windows/package.mjs into resources/app/main.cjs, next to out/.

import { app, BrowserWindow, Menu, dialog, ipcMain, shell, type MenuItemConstructorOptions } from 'electron'
import fs from 'fs'
import path from 'path'
import util from 'util'
import { startServer } from '../src/serverMain'

const APP_NAME = 'Next DSKY'
const appDir = __dirname
const REPO_URL = 'https://github.com/Apollo-Replica/DSKY'
const DISCORD_URL = 'https://discord.gg/CHZaYj5UNu'

app.setName(APP_NAME)
// Settings (.env, ha_entities.json, ...) in %APPDATA%\Next DSKY; Chromium's
// caches go to %LOCALAPPDATA% so the roaming folder holds only settings.
const dataDir = path.join(app.getPath('appData'), APP_NAME)
app.setPath('userData', dataDir)
app.setPath('sessionData', path.join(process.env.LOCALAPPDATA || dataDir, APP_NAME, 'Session'))

// ---------------------------------------------------------------- logs

const logDir = path.join(dataDir, 'logs')
const logPath = path.join(logDir, 'next-dsky.log')
const MAX_LINES = 5000
const MAX_LOG_BYTES = 5 * 1024 * 1024
const logLines: string[] = []
let logStream: fs.WriteStream | null = null
let logsWindow: BrowserWindow | null = null

const openLogFile = () => {
    try {
        fs.mkdirSync(logDir, { recursive: true })
        if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_LOG_BYTES) {
            fs.renameSync(logPath, logPath + '.old')
        }
        logStream = fs.createWriteStream(logPath, { flags: 'a' })
    } catch {
        logStream = null
    }
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const timestamp = () => {
    const d = new Date()
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

const addLogLine = (level: string, args: unknown[]) => {
    const tag = level === 'log' || level === 'info' ? '' : `${level.toUpperCase()} `
    const line = `${timestamp()} ${tag}${util.format(...args)}`
    logLines.push(line)
    if (logLines.length > MAX_LINES) logLines.splice(0, logLines.length - MAX_LINES)
    logStream?.write(line + '\n')
    if (logsWindow && !logsWindow.isDestroyed()) logsWindow.webContents.send('logs:line', line)
}

for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
        addLogLine(level, args)
        original(...args)
    }
}
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err))
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err))

const showLogs = () => {
    if (logsWindow && !logsWindow.isDestroyed()) {
        logsWindow.show()
        logsWindow.focus()
        return
    }
    logsWindow = new BrowserWindow({
        width: 900,
        height: 520,
        title: `${APP_NAME} – Logs`,
        backgroundColor: '#111111',
        icon: path.join(appDir, 'dsky.ico'),
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(appDir, 'logs-preload.cjs'),
            contextIsolation: true,
            sandbox: true,
        },
    })
    logsWindow.removeMenu()
    logsWindow.loadFile(path.join(appDir, 'logs.html'))
    logsWindow.on('closed', () => { logsWindow = null })
}

ipcMain.handle('logs:get', () => logLines)
ipcMain.handle('logs:open-folder', () => shell.openPath(logDir))

// ---------------------------------------------------------------- window

let mainWindow: BrowserWindow | null = null
let serverUrl = ''

interface Bounds { x?: number; y?: number; width: number; height: number; maximized?: boolean }
const boundsFile = path.join(dataDir, 'window.json')
const loadBounds = (): Bounds => {
    try {
        const b = JSON.parse(fs.readFileSync(boundsFile, 'utf8'))
        if (typeof b.width === 'number' && typeof b.height === 'number') return b
    } catch { /* first run */ }
    return { width: 640, height: 760 }
}
const saveBounds = (win: BrowserWindow) => {
    try {
        fs.writeFileSync(boundsFile, JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }))
    } catch { /* not important */ }
}

const isOwnUrl = (url: string) => serverUrl !== '' && (url === serverUrl || url.startsWith(serverUrl + '/'))
const openOutside = (url: string) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
}

const createMainWindow = () => {
    const bounds = loadBounds()
    const win = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        minWidth: 320,
        minHeight: 360,
        title: APP_NAME,
        backgroundColor: '#000000',
        icon: path.join(appDir, 'dsky.ico'),
        show: false,
        webPreferences: {
            contextIsolation: true,
            sandbox: true,
            // The DSKY plays relay clicks without waiting for a first click.
            autoplayPolicy: 'no-user-gesture-required',
        },
    })
    if (bounds.maximized) win.maximize()
    win.once('ready-to-show', () => win.show())
    win.on('page-title-updated', (e) => e.preventDefault())
    win.on('close', () => saveBounds(win))

    // Links to other sites open in the normal browser; the DSKY's own pages
    // (e.g. /ha) stay in the app.
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (isOwnUrl(url)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#000000' } }
        openOutside(url)
        return { action: 'deny' }
    })
    win.webContents.on('will-navigate', (e, url) => {
        if (!isOwnUrl(url)) {
            e.preventDefault()
            openOutside(url)
        }
    })

    win.loadURL(serverUrl)
    mainWindow = win
}

const buildMenu = () => {
    const template: MenuItemConstructorOptions[] = [
        {
            label: '&File',
            submenu: [
                { label: 'Open in Browser', click: () => shell.openExternal(serverUrl) },
                { label: 'Open Settings Folder', click: () => shell.openPath(dataDir) },
                { type: 'separator' },
                { role: 'quit' },
            ],
        },
        {
            label: '&View',
            submenu: [
                { label: 'Logs', accelerator: 'CmdOrCtrl+L', click: showLogs },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'togglefullscreen' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'toggleDevTools' },
            ],
        },
        {
            label: '&Help',
            submenu: [
                { label: 'Project on GitHub', click: () => shell.openExternal(REPO_URL) },
                { label: 'Discord', click: () => shell.openExternal(DISCORD_URL) },
                { type: 'separator' },
                {
                    label: `About ${APP_NAME}`,
                    click: () => dialog.showMessageBox({
                        type: 'info',
                        title: `About ${APP_NAME}`,
                        message: `${APP_NAME} ${app.getVersion()}`,
                        detail: `DSKY server: ${serverUrl}\nSettings: ${dataDir}\n\n` +
                            `Electron ${process.versions.electron} · Node ${process.versions.node}`,
                    }),
                },
            ],
        },
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------------------------------------------------------------- start

if (!app.requestSingleInstanceLock()) {
    // Already running: the first copy brings its window to the front.
    app.quit()
} else {
    app.on('second-instance', () => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
        mainWindow.focus()
    })

    app.whenReady().then(async () => {
        openLogFile()
        console.log(`${APP_NAME} ${app.getVersion()} starting (Electron ${process.versions.electron})`)
        try {
            const running = await startServer({ appDir, dataDir, port: 3000, anyPortIfBusy: true })
            serverUrl = running.url
        } catch (err) {
            console.error('Could not start the DSKY server:', err)
            dialog.showErrorBox(`${APP_NAME} could not start`, `${err instanceof Error ? err.message : err}\n\nLog: ${logPath}`)
            app.exit(1)
            return
        }
        buildMenu()
        createMainWindow()
    })

    app.on('window-all-closed', () => app.quit())
}
