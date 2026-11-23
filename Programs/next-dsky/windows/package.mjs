// Builds the Windows install folder (dist/windows/app) and, if Inno Setup is
// available, the installer (dist/next-dsky-<version>-windows-x64-setup.exe).
//
// The result runs on a bare Windows PC: it ships its own node runtime, the
// static frontend (out/) and the server bundled into one file. Only the
// packages with native parts (serialport, ps-list, pid-cwd) stay as files.
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

// Node runtime shipped inside the installer (LTS, x64).
const NODE_VERSION = '24.22.2'

// Packages bundled as files, not into server.cjs: native addons or
// helper .exe files located through __dirname.
const EXTERNAL = ['serialport', 'pid-cwd', 'ps-list-commonjs']
// Optional ws accelerators; ws works without them.
const IGNORED = ['bufferutil', 'utf-8-validate', 'next']

const here = path.dirname(fileURLToPath(import.meta.url))
const project = path.resolve(here, '..')
const dist = path.join(project, 'dist')
const stage = path.join(dist, 'windows', 'app')
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
// 1. Frontend (static export to out/) and server bundle (dist/server.cjs)
if (!process.argv.includes('--skip-build')) {
    // npx is a .cmd on Windows, which only runs through a shell.
    console.log('$ npx next build')
    execSync('npx next build', { stdio: 'inherit', cwd: project })
}
const esbuild = await import('esbuild')
await esbuild.build({
    entryPoints: [path.join(project, 'server.ts')],
    outfile: path.join(dist, 'server.cjs'),
    bundle: true,
    platform: 'node',
    target: `node${NODE_VERSION.split('.')[0]}`,
    format: 'cjs',
    // The installed app is always production: static frontend, no Next.
    define: { 'process.env.NODE_ENV': '"production"' },
    external: [...EXTERNAL, ...IGNORED],
    logLevel: 'warning',
})

// 2. Stage the install folder
fs.rmSync(stage, { recursive: true, force: true })
fs.mkdirSync(stage, { recursive: true })
fs.copyFileSync(path.join(dist, 'server.cjs'), path.join(stage, 'server.cjs'))
fs.cpSync(path.join(project, 'out'), path.join(stage, 'out'), { recursive: true })
fs.copyFileSync(path.join(here, 'dsky.ico'), path.join(stage, 'dsky.ico'))
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
    name: 'next-dsky', version, private: true,
    description: 'Next DSKY for Windows (installed build)',
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
    const rel = path.relative(project, pkgDir)
    fs.cpSync(pkgDir, path.join(stage, rel), { recursive: true })
    const meta = JSON.parse(fs.readFileSync(pkgJson, 'utf8'))
    for (const dep of Object.keys({ ...meta.dependencies, ...meta.optionalDependencies })) {
        if (IGNORED.includes(dep)) continue
        copyPackage(dep, pkgDir)
    }
}
for (const name of EXTERNAL) copyPackage(name, project)

// Keep only the Windows x64 native builds.
for (const prebuilds of findDirs(path.join(stage, 'node_modules'), 'prebuilds')) {
    for (const entry of fs.readdirSync(prebuilds)) {
        if (entry !== 'win32-x64') fs.rmSync(path.join(prebuilds, entry), { recursive: true, force: true })
    }
}

// 3. Node runtime, verified against nodejs.org's published checksums.
//    Renamed so Task Manager and the firewall prompt show "next-dsky.exe".
const nodeExe = await download(`https://nodejs.org/dist/v${NODE_VERSION}/win-x64/node.exe`,
    path.join(cache, `node-v${NODE_VERSION}-win-x64.exe`))
const sums = await (await fetch(`https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt`)).text()
const expected = sums.split('\n').find(l => l.trim().endsWith(' win-x64/node.exe'))?.split(/\s+/)[0]
const actual = createHash('sha256').update(fs.readFileSync(nodeExe)).digest('hex')
if (!expected || expected !== actual) throw new Error(`node.exe checksum mismatch (${actual} != ${expected})`)
fs.copyFileSync(nodeExe, path.join(stage, 'next-dsky.exe'))

const size = dirSize(stage)
console.log(`> Staged ${stage} (${(size / 1e6).toFixed(1)} MB)`)

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
