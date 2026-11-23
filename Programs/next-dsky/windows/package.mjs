// Builds the Windows desktop app (dist/windows/app) and, if Inno Setup is
// available, its installer (dist/next-dsky-v<version>-windows-x64-setup.exe).
//
// Layout of the install folder:
//
//   Next DSKY.exe                 the app (Rust, desktop/): a WebView2 window,
//                                 menu, logs; runs the server hidden
//   server/next-dsky-server.exe   node runtime (official build, renamed)
//   server/server.cjs             the DSKY server bundled into one file
//   server/out/                   static frontend (next build)
//   server/node_modules/          only the native packages
//
//   npm run package:windows                 # build + stage + installer
//   ISCC="C:\path\to\ISCC.exe" npm run ...  # Inno Setup compiler location
//
// Run it on Windows (CI: windows-latest) with Rust (cargo) on PATH.
// Expects `npm ci` to have run.

import { execFileSync, execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Node runtime shipped inside the installer (LTS, x64).
const NODE_VERSION = '24.22.2'
const APP_EXE = 'Next DSKY.exe'
const SERVER_EXE = 'next-dsky-server.exe'

// Packages kept as files, not bundled into server.cjs: native addons or
// helper .exe files located through __dirname.
const EXTERNAL = ['serialport', 'pid-cwd', 'ps-list-commonjs']
// Never loaded in the packaged app (optional ws accelerators, Next dev server).
const IGNORED = ['bufferutil', 'utf-8-validate', 'next']

const here = path.dirname(fileURLToPath(import.meta.url))
const project = path.resolve(here, '..')
const desktop = path.join(project, 'desktop')
const dist = path.join(project, 'dist')
const stage = path.join(dist, 'windows', 'app')
const serverDir = path.join(stage, 'server')
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

const run = (cmd, args, opts = {}) => {
    console.log(`$ ${cmd} ${args.join(' ')}`)
    execFileSync(cmd, args, { stdio: 'inherit', cwd: project, ...opts })
}

// 1. Frontend (static export to out/)
if (!process.argv.includes('--skip-build')) {
    // npx is a .cmd on Windows, which only runs through a shell.
    console.log('$ npx next build')
    execSync('npx next build', { stdio: 'inherit', cwd: project })
}

// 2. The app window (Rust)
run(process.env.CARGO || 'cargo', ['build', '--release', '--locked'], {
    cwd: desktop,
    env: { ...process.env, DSKY_VERSION: version },
})

fs.rmSync(stage, { recursive: true, force: true })
fs.mkdirSync(serverDir, { recursive: true })
fs.copyFileSync(path.join(desktop, 'target', 'release', 'next-dsky.exe'), path.join(stage, APP_EXE))

// The MSVC build (CI) needs no DLLs. A GNU/LLVM-mingw build (some dev PCs)
// imports WebView2Loader.dll and libunwind.dll: ship them next to the exe.
const exeBytes = fs.readFileSync(path.join(stage, APP_EXE))
const findOnPath = (file) => (process.env.PATH || '').split(path.delimiter)
    .flatMap(dir => [path.join(dir, file), path.join(dir, '..', 'x86_64-w64-mingw32', 'bin', file)])
    .find(p => fs.existsSync(p))
const dllSources = {
    'WebView2Loader.dll': () => {
        const build = path.join(desktop, 'target', 'release', 'build')
        const dir = fs.readdirSync(build).find(d => d.startsWith('webview2-com-sys-') &&
            fs.existsSync(path.join(build, d, 'out', 'x64', 'WebView2Loader.dll')))
        return dir && path.join(build, dir, 'out', 'x64', 'WebView2Loader.dll')
    },
    'libunwind.dll': () => findOnPath('libunwind.dll'),
}
for (const [dll, locate] of Object.entries(dllSources)) {
    if (!exeBytes.includes(Buffer.from(dll))) continue
    const src = locate()
    if (!src) throw new Error(`${APP_EXE} needs ${dll}, which was not found`)
    fs.copyFileSync(src, path.join(stage, dll))
    console.log(`> Shipping ${dll} (non-MSVC build)`)
}

// 3. The server: one bundle + frontend + native packages
const esbuild = await import('esbuild')
await esbuild.build({
    entryPoints: [path.join(project, 'server.ts')],
    outfile: path.join(serverDir, 'server.cjs'),
    bundle: true,
    platform: 'node',
    target: `node${NODE_VERSION.split('.')[0]}`,
    format: 'cjs',
    // The packaged server is always production: static frontend, no Next.
    define: { 'process.env.NODE_ENV': '"production"' },
    external: [...EXTERNAL, ...IGNORED],
    logLevel: 'warning',
})
fs.cpSync(path.join(project, 'out'), path.join(serverDir, 'out'), { recursive: true })
fs.writeFileSync(path.join(serverDir, 'package.json'), JSON.stringify({
    name: 'next-dsky', version, private: true,
    description: 'Next DSKY server (Windows desktop app)',
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
    fs.cpSync(pkgDir, path.join(serverDir, path.relative(project, pkgDir)), { recursive: true })
    const meta = JSON.parse(fs.readFileSync(pkgJson, 'utf8'))
    for (const dep of Object.keys({ ...meta.dependencies, ...meta.optionalDependencies })) {
        if (IGNORED.includes(dep)) continue
        copyPackage(dep, pkgDir)
    }
}
for (const name of EXTERNAL) copyPackage(name, project)

// Keep only the Windows x64 native builds.
for (const prebuilds of findDirs(path.join(serverDir, 'node_modules'), 'prebuilds')) {
    for (const entry of fs.readdirSync(prebuilds)) {
        if (entry !== 'win32-x64') fs.rmSync(path.join(prebuilds, entry), { recursive: true, force: true })
    }
}

// 4. Node runtime, verified against nodejs.org's published checksums.
//    Renamed so Task Manager and the firewall prompt say what it is.
const nodeExe = await download(`https://nodejs.org/dist/v${NODE_VERSION}/win-x64/node.exe`,
    path.join(cache, `node-v${NODE_VERSION}-win-x64.exe`))
const sums = await (await fetch(`https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt`)).text()
const expected = sums.split('\n').find(l => l.trim().endsWith(' win-x64/node.exe'))?.split(/\s+/)[0]
const actual = createHash('sha256').update(fs.readFileSync(nodeExe)).digest('hex')
if (!expected || expected !== actual) throw new Error(`node.exe checksum mismatch (${actual} != ${expected})`)
fs.copyFileSync(nodeExe, path.join(serverDir, SERVER_EXE))

console.log(`> Staged ${stage} (${(dirSize(stage) / 1e6).toFixed(1)} MB)`)

// 5. Installer
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
