// Builds the Windows desktop app (dist/windows/app) and, if Inno Setup is
// available, its installer (dist/next-dsky-v<version>-windows-x64-setup.exe).
//
// The app is Electron: its own window, the DSKY server running inside it, no
// console and no browser. Layout of the install folder:
//
//   Next DSKY.exe, *.dll, locales/   Electron, renamed and with our icon
//   resources/app/                   main.cjs (server + window, one bundle),
//                                    out/ (static frontend), logs window,
//                                    node_modules/ (only the native packages)
//
//   npm run package:windows                 # build + stage + installer
//   ISCC="C:\path\to\ISCC.exe" npm run ...  # Inno Setup compiler location
//
// Run it on Windows (CI: windows-latest). Expects `npm ci` to have run.

import { execFileSync, execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Electron shipped in the installer (its Node runs the server).
const ELECTRON_VERSION = '45.2.3'
const APP_NAME = 'Next DSKY'
const EXE_NAME = `${APP_NAME}.exe`

// Packages kept as files, not bundled into main.cjs: native addons or
// helper .exe files located through __dirname.
const EXTERNAL = ['serialport', 'pid-cwd', 'ps-list-commonjs']
// Never loaded in the packaged app (optional ws accelerators, Next dev server).
const IGNORED = ['bufferutil', 'utf-8-validate', 'next']
// Chromium UI languages kept (menus, dialogs); it falls back to en-US.
const LOCALES = ['en-US', 'en-GB', 'es', 'es-419', 'fr', 'de', 'it', 'pt-BR', 'pt-PT']

const here = path.dirname(fileURLToPath(import.meta.url))
const project = path.resolve(here, '..')
const dist = path.join(project, 'dist')
const stage = path.join(dist, 'windows', 'app')
const appRes = path.join(stage, 'resources', 'app')
const cache = path.join(dist, 'cache')

const pkg = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'))
// CI stamps package.json from the release tag. Local builds take the version
// from git (e.g. 0.4.1-3-gec377c4: 3 commits after v0.4.1).
const gitVersion = () => {
    try {
        return execSync('git describe --tags --match "v[0-9]*"', { cwd: project, encoding: 'utf8' }).trim().replace(/^v/, '')
    } catch {
        return null
    }
}
const version = process.env.DSKY_VERSION || (process.env.CI ? pkg.version : gitVersion() || pkg.version)
console.log(`> Version ${version}`)

const run = (cmd, args) => {
    console.log(`$ ${cmd} ${args.join(' ')}`)
    execFileSync(cmd, args, { stdio: 'inherit', cwd: project })
}

// 1. Frontend (static export to out/)
if (!process.argv.includes('--skip-build')) {
    // npx is a .cmd on Windows, which only runs through a shell.
    console.log('$ npx next build')
    execSync('npx next build', { stdio: 'inherit', cwd: project })
}

// 2. Electron, verified against the release's published checksums
const zipName = `electron-v${ELECTRON_VERSION}-win32-x64.zip`
const releaseUrl = `https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}`
const zip = await download(`${releaseUrl}/${zipName}`, path.join(cache, zipName))
const sums = await (await fetch(`${releaseUrl}/SHASUMS256.txt`)).text()
const expected = sums.split('\n').find(l => l.trim().endsWith(`*${zipName}`) || l.trim().endsWith(` ${zipName}`))?.split(/\s+/)[0]
const actual = createHash('sha256').update(fs.readFileSync(zip)).digest('hex')
if (!expected || expected !== actual) throw new Error(`${zipName} checksum mismatch (${actual} != ${expected})`)

fs.rmSync(stage, { recursive: true, force: true })
fs.mkdirSync(stage, { recursive: true })
// Windows' own tar (bsdtar) reads zip files.
run(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', zip, '-C', stage])
fs.renameSync(path.join(stage, 'electron.exe'), path.join(stage, EXE_NAME))
fs.rmSync(path.join(stage, 'resources', 'default_app.asar'), { force: true })
for (const file of fs.readdirSync(path.join(stage, 'locales'))) {
    if (!LOCALES.includes(path.basename(file, '.pak'))) fs.rmSync(path.join(stage, 'locales', file))
}

// Icon and file details shown by Explorer, Task Manager and the firewall prompt.
const numericVersion = (version.match(/^\d+\.\d+\.\d+/)?.[0] || '0.0.0') + '.0'
run(path.join(project, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe'), [
    path.join(stage, EXE_NAME),
    '--set-icon', path.join(here, 'dsky.ico'),
    '--set-file-version', numericVersion,
    '--set-product-version', numericVersion,
    '--set-version-string', 'ProductName', APP_NAME,
    '--set-version-string', 'FileDescription', APP_NAME,
    '--set-version-string', 'CompanyName', 'Apollo Replica',
    '--set-version-string', 'OriginalFilename', EXE_NAME,
    '--set-version-string', 'InternalName', APP_NAME,
    '--set-version-string', 'LegalCopyright', 'CC BY-NC-SA 4.0',
])

// 3. The app: main process bundle (server + window), frontend, logs window
const esbuild = await import('esbuild')
await esbuild.build({
    entryPoints: [path.join(project, 'desktop', 'main.ts')],
    outfile: path.join(appRes, 'main.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    // The packaged app is always production: static frontend, no Next.
    define: { 'process.env.NODE_ENV': '"production"' },
    external: ['electron', ...EXTERNAL, ...IGNORED],
    logLevel: 'warning',
})
fs.cpSync(path.join(project, 'out'), path.join(appRes, 'out'), { recursive: true })
for (const file of ['logs.html', 'logs-preload.cjs']) {
    fs.copyFileSync(path.join(project, 'desktop', file), path.join(appRes, file))
}
fs.copyFileSync(path.join(here, 'dsky.ico'), path.join(appRes, 'dsky.ico'))
fs.writeFileSync(path.join(appRes, 'package.json'), JSON.stringify({
    name: 'next-dsky', productName: APP_NAME, version, private: true, main: 'main.cjs',
    description: 'Next DSKY desktop app',
}, null, 2) + '\n')

// Copy the external packages and everything they depend on, exactly as
// installed by `npm ci` (same versions as package-lock.json).
const copied = new Set()
const copyPackage = (name, fromDir) => {
    // Node's lookup: node_modules/<name> in this folder or the nearest parent.
    let pkgJson
    for (let dir = fromDir; ; dir = path.dirname(dir)) {
        const candidate = path.join(dir, 'node_modules', name, 'package.json')
        if (fs.existsSync(candidate)) { pkgJson = candidate; break }
        if (path.dirname(dir) === dir) throw new Error(`Cannot find ${name} from ${fromDir}`)
    }
    const pkgDir = path.dirname(pkgJson)
    if (copied.has(pkgDir)) return
    copied.add(pkgDir)
    fs.cpSync(pkgDir, path.join(appRes, path.relative(project, pkgDir)), { recursive: true })
    const meta = JSON.parse(fs.readFileSync(pkgJson, 'utf8'))
    for (const dep of Object.keys({ ...meta.dependencies, ...meta.optionalDependencies })) {
        if (IGNORED.includes(dep)) continue
        copyPackage(dep, pkgDir)
    }
}
for (const name of EXTERNAL) copyPackage(name, project)

// Keep only the Windows x64 native builds.
for (const prebuilds of findDirs(path.join(appRes, 'node_modules'), 'prebuilds')) {
    for (const entry of fs.readdirSync(prebuilds)) {
        if (entry !== 'win32-x64') fs.rmSync(path.join(prebuilds, entry), { recursive: true, force: true })
    }
}

console.log(`> Staged ${stage} (${(dirSize(stage) / 1e6).toFixed(1)} MB)`)

// 4. Installer
const iscc = process.env.ISCC || findIscc()
if (!iscc) {
    console.log('> Inno Setup (ISCC.exe) not found: skipping the installer. Set ISCC to build it.')
} else {
    const outputName = `next-dsky-v${version}-windows-x64-setup`
    run(iscc, [`/DAppVersion=${version}`, `/DStageDir=${stage}`, `/DOutputDir=${dist}`,
        `/DOutputName=${outputName}`, path.join(here, 'next-dsky.iss')])
    console.log(`> Installer: ${path.join(dist, outputName + '.exe')}`)
}

async function download(url, file) {
    if (fs.existsSync(file)) return file
    fs.mkdirSync(path.dirname(file), { recursive: true })
    console.log(`> Downloading ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
    fs.writeFileSync(file + '.part', Buffer.from(await res.arrayBuffer()))
    fs.renameSync(file + '.part', file)
    return file
}

function findDirs(root, name, out = []) {
    if (!fs.existsSync(root)) return out
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const full = path.join(root, entry.name)
        if (entry.name === name) out.push(full)
        else findDirs(full, name, out)
    }
    return out
}

function dirSize(dir) {
    let total = 0
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        total += entry.isDirectory() ? dirSize(full) : fs.statSync(full).size
    }
    return total
}

function findIscc() {
    if (process.platform !== 'win32') return null
    const candidates = [
        path.join(process.env['ProgramFiles(x86)'] || '', 'Inno Setup 6', 'ISCC.exe'),
        path.join(process.env.ProgramFiles || '', 'Inno Setup 6', 'ISCC.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
    ]
    return candidates.find(p => fs.existsSync(p)) || null
}
