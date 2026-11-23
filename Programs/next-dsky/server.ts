// Command-line entry point (Orange Pi, development, start.bat).
// The Windows desktop app (desktop/, Rust) runs it bundled as server.cjs.

import { exec } from 'child_process'
import path from 'path'
import { program } from 'commander'
import { startServer } from './src/serverMain'

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
    .option('--any-port', 'If the port is taken, use any free one (the desktop app reads the "Ready on" line)')
program.parse()
const options = program.opts()

const appDir = __dirname
const openBrowser = (url: string) => {
    const cmd = process.platform === 'win32' ? `start "" "${url}"`
        : process.platform === 'darwin' ? `open "${url}"`
        : `xdg-open "${url}"`
    exec(cmd, () => { /* nothing to do if there is no browser */ })
}

startServer({
    ...options,
    appDir,
    dataDir: path.resolve(options.dataDir || process.env.DSKY_DATA_DIR || appDir),
    port: parseInt(options.port || '3000'),
    anyPortIfBusy: !!options.anyPort,
    dev: process.env.NODE_ENV !== 'production',
}).then(({ url }) => {
    if (options.open) openBrowser(url)
}).catch((err) => {
    console.error(err)
    process.exit(1)
})
