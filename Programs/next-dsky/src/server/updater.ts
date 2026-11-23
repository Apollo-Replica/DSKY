/**
 * OTA updater — checks GitHub Releases for new versions and installs them
 * into versioned release directories with an atomic symlink switch.
 *
 * Safety model (never brick the device):
 * - A release is downloaded, checksum-verified and fully unpacked into a NEW
 *   directory before anything is switched. Any failure before the symlink
 *   swap leaves the running install untouched.
 * - The swap itself is atomic (symlink + rename).
 * - A fresh install carries a `.pending-verify` flag. The launcher
 *   (orangepi.sh) counts boot attempts while the flag exists and rolls the
 *   symlink back to the previous release if the new one crash-loops. The
 *   server removes the flag only after running healthily for a while.
 * - The factory install (the git clone) is never modified or deleted, so the
 *   device can always fall back to it.
 *
 * Only active when DSKY_RELEASES_DIR is set (exported by orangepi.sh on the
 * appliance). Desktop installs never see any of this.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { execFile } from 'child_process'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { updateUpdate } from './stateManager'

// Read in initUpdater(), after server.ts has loaded .env via dotenv — module
// init runs before that, so capturing here would miss .env-provided values.
let RELEASES_DIR = process.env.DSKY_RELEASES_DIR || null
let UPDATE_REPO = process.env.DSKY_UPDATE_REPO || 'Apollo-Replica/DSKY'

const ASSET_SUFFIX = '-linux-arm64.tar.gz'
const PENDING_FLAG = '.pending-verify'
const ATTEMPTS_FILE = '.update-attempts'
const PREVIOUS_POINTER = 'previous'
/** Config files carried over from the running install to a new release. */
const PERSISTED_FILES = ['.env', 'ha_entities.json', 'game_scores.json']

/** How long the new version must stay up before it is considered good. */
const VERIFY_DELAY_MS = 90_000
const AUTO_CHECK_DELAY_MS = 20_000
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

interface PendingAsset {
    version: string
    tarballUrl: string
    sha256Url: string
    size: number
}

let appVersion = '0.0.0'
let pendingAsset: PendingAsset | null = null
let busy = false

export const getAppVersion = () => appVersion

const isSupported = () => !!RELEASES_DIR && process.platform === 'linux'

const readOwnVersion = (): string => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.resolve(process.env.DSKY_APP_DIR || '.', 'package.json'), 'utf8'))
        return typeof pkg.version === 'string' ? pkg.version : '0.0.0'
    } catch {
        return '0.0.0'
    }
}

/** Numeric compare of dotted versions: >0 if a is newer than b. */
const compareVersions = (a: string, b: string): number => {
    const pa = a.split('.').map(n => parseInt(n, 10) || 0)
    const pb = b.split('.').map(n => parseInt(n, 10) || 0)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0)
        if (d !== 0) return d
    }
    return 0
}

// --- Check ---

export const checkForUpdate = async () => {
    if (!isSupported() || busy) return

    updateUpdate({ status: 'checking', error: undefined })
    try {
        const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
            headers: {
                'User-Agent': 'next-dsky-updater',
                'Accept': 'application/vnd.github+json',
            },
        })
        if (res.status === 404) {
            // Repo has no releases yet
            console.log('[Updater] No releases published yet')
            pendingAsset = null
            updateUpdate({ status: 'idle', updateAvailable: false, lastChecked: Date.now(), error: undefined })
            return
        }
        if (!res.ok) throw new Error(`GitHub API: HTTP ${res.status}`)
        const release: any = await res.json()

        const tag: string = release.tag_name || ''
        const version = tag.replace(/^v/, '')
        if (!version) throw new Error('Release has no tag')

        const assets: any[] = release.assets || []
        const tarball = assets.find(a => a.name?.endsWith(ASSET_SUFFIX))
        const sha = assets.find(a => a.name === `${tarball?.name}.sha256`)
        if (!tarball || !sha) throw new Error('Release has no device package')

        const available = compareVersions(version, appVersion) > 0
        pendingAsset = available
            ? { version, tarballUrl: tarball.browser_download_url, sha256Url: sha.browser_download_url, size: tarball.size || 0 }
            : null

        console.log(`[Updater] Installed v${appVersion}, latest v${version}${available ? ' — update available' : ''}`)
        updateUpdate({
            status: 'idle',
            latest: version,
            updateAvailable: available,
            lastChecked: Date.now(),
            error: undefined,
        })
    } catch (err: any) {
        console.error('[Updater] Check failed:', err?.message || err)
        pendingAsset = null
        updateUpdate({ status: 'error', error: err?.message || 'Check failed', lastChecked: Date.now() })
    }
}

// --- Install ---

const sha256OfFile = (filePath: string): Promise<string> =>
    new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256')
        fs.createReadStream(filePath)
            .on('error', reject)
            .on('data', chunk => hash.update(chunk))
            .on('end', () => resolve(hash.digest('hex')))
    })

const extractTarball = (tarPath: string, destDir: string): Promise<void> =>
    new Promise((resolve, reject) => {
        execFile('tar', ['-xzf', tarPath, '-C', destDir], (err, _out, stderr) => {
            if (err) reject(new Error(`tar failed: ${stderr || err.message}`))
            else resolve()
        })
    })

const downloadFile = async (url: string, dest: string, totalSize: number, onProgress?: (pct: number) => void) => {
    const res = await fetch(url, { headers: { 'User-Agent': 'next-dsky-updater' } })
    if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`)

    const total = Number(res.headers.get('content-length')) || totalSize
    let received = 0
    let lastPct = -1

    const counter = new Readable({ read() {} })
    const reader = res.body.getReader()
    const pump = async () => {
        for (;;) {
            const { done, value } = await reader.read()
            if (done) { counter.push(null); break }
            received += value.length
            if (onProgress && total > 0) {
                const pct = Math.min(100, Math.floor((received / total) * 100))
                if (pct !== lastPct) { lastPct = pct; onProgress(pct) }
            }
            counter.push(Buffer.from(value))
        }
    }
    await Promise.all([pump(), pipeline(counter, fs.createWriteStream(dest))])
}

const checkDiskSpace = (dir: string, needed: number) => {
    try {
        const stat = (fs as any).statfsSync?.(dir)
        if (stat && stat.bavail * stat.bsize < needed) {
            throw new Error('Not enough disk space')
        }
    } catch (err: any) {
        if (err?.message === 'Not enough disk space') throw err
        // statfs unavailable — skip the check rather than block the update
    }
}

/** Remove old release dirs, keeping the active one and the rollback target. */
const pruneReleases = () => {
    if (!RELEASES_DIR) return
    try {
        const keep = new Set<string>([fs.realpathSync(process.cwd())])
        const current = path.join(RELEASES_DIR, 'current')
        if (fs.existsSync(current)) keep.add(fs.realpathSync(current))
        const prevFile = path.join(RELEASES_DIR, PREVIOUS_POINTER)
        if (fs.existsSync(prevFile)) {
            const prev = fs.readFileSync(prevFile, 'utf8').trim()
            if (prev && fs.existsSync(prev)) keep.add(fs.realpathSync(prev))
        }
        for (const entry of fs.readdirSync(RELEASES_DIR)) {
            const full = path.join(RELEASES_DIR, entry)
            if (entry === 'current' || entry === PREVIOUS_POINTER) continue
            if (!fs.statSync(full).isDirectory()) continue
            if (keep.has(fs.realpathSync(full))) continue
            console.log(`[Updater] Pruning old release: ${entry}`)
            fs.rmSync(full, { recursive: true, force: true })
        }
    } catch (err) {
        console.error('[Updater] Prune failed (non-fatal):', err)
    }
}

export const installUpdate = async () => {
    if (!isSupported() || busy) return
    if (!pendingAsset) {
        console.log('[Updater] No pending update to install')
        return
    }

    const asset = pendingAsset
    const releasesDir = RELEASES_DIR!
    const tmpDir = path.join(releasesDir, '.tmp')
    const targetDir = path.join(releasesDir, `v${asset.version}`)

    busy = true
    try {
        console.log(`[Updater] Installing v${asset.version}...`)
        fs.mkdirSync(releasesDir, { recursive: true })
        pruneReleases()
        fs.rmSync(tmpDir, { recursive: true, force: true })
        fs.mkdirSync(tmpDir, { recursive: true })
        // Tarball on disk + unpacked copy, plus headroom
        checkDiskSpace(releasesDir, asset.size * 4 + 200 * 1024 * 1024)

        // 1. Download
        updateUpdate({ status: 'downloading', progress: 0, error: undefined })
        const tarPath = path.join(tmpDir, 'release.tar.gz')
        await downloadFile(asset.tarballUrl, tarPath, asset.size, pct => updateUpdate({ progress: pct }))

        // 2. Verify checksum
        updateUpdate({ status: 'installing', progress: undefined })
        const shaRes = await fetch(asset.sha256Url, { headers: { 'User-Agent': 'next-dsky-updater' } })
        if (!shaRes.ok) throw new Error(`Checksum download failed: HTTP ${shaRes.status}`)
        const expected = (await shaRes.text()).trim().split(/\s+/)[0]?.toLowerCase()
        const actual = (await sha256OfFile(tarPath)).toLowerCase()
        if (!expected || expected !== actual) throw new Error('Checksum mismatch')

        // 3. Unpack into a fresh directory
        const extractDir = path.join(tmpDir, 'extract')
        fs.mkdirSync(extractDir, { recursive: true })
        await extractTarball(tarPath, extractDir)
        fs.rmSync(tarPath, { force: true })

        // 4. Sanity-check the unpacked release
        for (const required of ['package.json', 'server.ts', 'node_modules', '.next']) {
            if (!fs.existsSync(path.join(extractDir, required))) {
                throw new Error(`Invalid package: missing ${required}`)
            }
        }

        // 5. Carry over device configuration
        for (const file of PERSISTED_FILES) {
            const src = path.resolve(file)
            if (fs.existsSync(src)) fs.copyFileSync(src, path.join(extractDir, file))
        }

        // 6. Mark as unverified so the launcher can roll back a crash-loop
        fs.writeFileSync(path.join(extractDir, PENDING_FLAG), `v${asset.version}\n`)

        // 7. Move into place and switch the symlink atomically
        fs.rmSync(targetDir, { recursive: true, force: true })
        fs.renameSync(extractDir, targetDir)
        fs.writeFileSync(path.join(releasesDir, PREVIOUS_POINTER), fs.realpathSync(process.cwd()) + '\n')
        const currentLink = path.join(releasesDir, 'current')
        const newLink = path.join(releasesDir, '.current-new')
        fs.rmSync(newLink, { force: true })
        fs.symlinkSync(targetDir, newLink)
        fs.renameSync(newLink, currentLink)
        fs.rmSync(tmpDir, { recursive: true, force: true })

        // 8. Restart — the launcher loop picks up the new release
        console.log(`[Updater] v${asset.version} installed, restarting...`)
        updateUpdate({ status: 'restarting' })
        setTimeout(() => process.exit(0), 1500)
    } catch (err: any) {
        console.error('[Updater] Install failed:', err?.message || err)
        fs.rmSync(tmpDir, { recursive: true, force: true })
        updateUpdate({ status: 'error', error: err?.message || 'Install failed', progress: undefined })
        busy = false
    }
}

// --- Init ---

export const initUpdater = () => {
    RELEASES_DIR = process.env.DSKY_RELEASES_DIR || null
    UPDATE_REPO = process.env.DSKY_UPDATE_REPO || 'Apollo-Replica/DSKY'
    appVersion = readOwnVersion()
    const supported = isSupported()
    updateUpdate({ supported, version: appVersion })
    console.log(`[Updater] v${appVersion}, OTA ${supported ? `enabled (repo: ${UPDATE_REPO})` : 'disabled'}`)
    if (!supported) return

    // Fresh install? Mark it good only after running healthily for a while.
    const flagPath = path.resolve(PENDING_FLAG)
    if (fs.existsSync(flagPath)) {
        console.log(`[Updater] Verifying fresh install (${VERIFY_DELAY_MS / 1000}s)...`)
        setTimeout(() => {
            try {
                fs.rmSync(flagPath, { force: true })
                fs.rmSync(path.resolve(ATTEMPTS_FILE), { force: true })
                console.log(`[Updater] v${appVersion} verified healthy`)
                pruneReleases()
            } catch (err) {
                console.error('[Updater] Failed to clear verify flag:', err)
            }
        }, VERIFY_DELAY_MS)
    }

    // Periodic background check so the menu can show the NEW badge.
    setTimeout(() => { checkForUpdate() }, AUTO_CHECK_DELAY_MS)
    setInterval(() => { checkForUpdate() }, AUTO_CHECK_INTERVAL_MS)
}
