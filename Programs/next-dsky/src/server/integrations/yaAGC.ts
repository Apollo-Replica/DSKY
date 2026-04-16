import * as net from 'net'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { spawn, type ChildProcess, execFile } from 'node:child_process'
import { OFF_TEST } from '../../utils/dskyStates'
import { AgcIntegration } from './AgcIntegration'
import {
    parseDskyKey,
    getYaAGCPort,
    encodeInputPacket,
    decodeOutputPacket,
    parseAGCOutput,
    createParsingState,
    type AGCParsingState,
} from './agcProtocol'

export { YAAGC_VERSIONS } from './agcProtocol'

export class YaAGCIntegration extends AgcIntegration {
    readonly name = 'yaAGC'
    readonly id = 'yaagc'

    private client: net.Socket | null = null
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    private flashInterval: ReturnType<typeof setInterval> | null = null
    private options: { yaagc?: string } = {}
    private yaagcProcess: ChildProcess | null = null

    private parsing: AGCParsingState = createParsingState()
    private state: any = { ...OFF_TEST }
    private inputBuffer: number[] = []

    async handleKey(key: string): Promise<void> {
        const upperKey = key?.toUpperCase()
        if (!this.client) return

        const pressKey = parseDskyKey(upperKey)
        this.sendInputPacketToAGC(pressKey)
        if (upperKey === "P") {
            const releaseProKey = parseDskyKey("PR")
            setTimeout(() => this.sendInputPacketToAGC(releaseProKey), 750)
        }
    }

    protected async onStart(options: Record<string, any>): Promise<void> {
        this.options = options
        const version = (options?.yaagc as string | undefined) || 'Comanche055'
        const port = getYaAGCPort({ yaagc: version })

        // Reset state
        this.parsing = createParsingState()
        this.state = { ...OFF_TEST }
        this.inputBuffer = []

        if (version !== 'own') {
            await this.ensureYaAGCStarted(version, port)
        } else {
            console.log(`[yaAGC] Using user-started yaAGC on port ${port}`)
        }

        this.connectSocket(port)

        this.flashInterval = setInterval(() => {
            this.parsing.vnFlashState = !this.parsing.vnFlashState
            if (this.parsing.vnFlashing) {
                this.emitCurrentState()
            }
        }, 600)
    }

    protected onStop(): void {
        console.log('[yaAGC] Closing socket')
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null
        }
        if (this.flashInterval) {
            clearInterval(this.flashInterval)
            this.flashInterval = null
        }
        if (this.client) {
            this.client.destroy()
            this.client = null
        }
        this.stopSpawnedYaAGC()
    }

    private async handleSocketError(error: string): Promise<void> {
        if (!this.running) return
        console.log(`[yaAGC] Socket ${error}! Reconnecting to port ${getYaAGCPort(this.options)}...`)
        this.client?.destroy()
        this.client = null
        this.reconnectTimeout = setTimeout(() => {
            if (this.running) this.connectSocket(getYaAGCPort(this.options))
        }, 2000)
    }

    private connectSocket(port: number): void {
        this.client?.destroy()
        this.client = new net.Socket()

        this.client.connect({ port, host: '127.0.0.1', keepAlive: true }, () => {
            console.log(`[yaAGC] Socket connected (port ${port})`)
            this.state = { ...OFF_TEST }
        })

        this.client.on('data', (data) => {
            if (!this.running) return
            const newbytes = data.toJSON().data
            if (newbytes.every((byte: number) => byte === 255)) return
            this.inputBuffer = [...this.inputBuffer, ...newbytes]
            while (this.inputBuffer.length >= 4) {
                const relevantData = this.processOutputPacket()
                if (!relevantData) continue
                this.emitCurrentState()
            }
        })

        this.client.on('close', async (hadError: boolean) => {
            if (!hadError && this.running) await this.handleSocketError('closed')
        })

        this.client.on('error', async () => {
            if (this.running) await this.handleSocketError('connection failed')
        })
    }

    private async ensureYaAGCStarted(version: string, port: number): Promise<void> {
        if (this.yaagcProcess) return

        const lmModes: Record<string, string> = {
            Luminary099: 'LM',
            Luminary210: 'LM1'
        }
        const mode = lmModes[version] || 'CM'

        const virtualAgcRoot =
            (process.env.VIRTUALAGC_HOME && process.env.VIRTUALAGC_HOME.trim().length > 0)
                ? process.env.VIRTUALAGC_HOME.trim()
                : path.resolve(os.homedir(), 'VirtualAGC')

        const binDir = path.resolve(virtualAgcRoot, 'bin')
        const resourcesDir = path.resolve(virtualAgcRoot, 'Resources')

        const candidates = os.platform() === 'win32'
            ? [path.resolve(binDir, 'yaAGC.exe'), path.resolve(binDir, 'yaAGC')]
            : [path.resolve(binDir, 'yaAGC')]

        const command = candidates.find(p => fs.existsSync(p))
        if (!command) {
            const msg =
                `[yaAGC] Could not find yaAGC executable.\n` +
                `Looked for: ${candidates.join(', ')}\n` +
                `Set VIRTUALAGC_HOME to your VirtualAGC folder.`
            console.error(msg)
            throw new Error(msg)
        }

        if (!fs.existsSync(resourcesDir)) {
            const msg =
                `[yaAGC] Could not find VirtualAGC Resources folder at '${resourcesDir}'.\n` +
                `Set VIRTUALAGC_HOME to your VirtualAGC folder.`
            console.error(msg)
            throw new Error(msg)
        }

        const coreArg = `--core=source/${version}/${version}.bin`
        const cfgArg = `--cfg=${mode}.ini`
        const portArg = `--port=${port}`
        const args = [coreArg, cfgArg, portArg]

        console.log(`[yaAGC] Starting yaAGC (${version}) on port ${port}`)
        const child = spawn(command, args, {
            cwd: resourcesDir,
            stdio: ['ignore', 'pipe', 'pipe']
        })
        this.yaagcProcess = child

        child.stdout?.on('data', (buf) => {
            const s = String(buf).trim()
            if (s.length) console.log(`[yaAGC] ${s}`)
        })
        child.stderr?.on('data', (buf) => {
            const s = String(buf).trim()
            if (s.length) console.error(`[yaAGC] ${s}`)
        })
        child.on('exit', (code, signal) => {
            console.log(`[yaAGC] yaAGC process exited (code=${code}, signal=${signal})`)
            this.yaagcProcess = null
        })
    }

    private stopSpawnedYaAGC(): void {
        if (!this.yaagcProcess?.pid) return

        const pid = this.yaagcProcess.pid
        console.log(`[yaAGC] Stopping spawned yaAGC (pid ${pid})`)

        try {
            this.yaagcProcess.kill()
        } catch (e) {
            console.error('[yaAGC] Failed to kill yaAGC process:', e)
        }

        if (os.platform() === 'win32') {
            try {
                execFile('taskkill', ['/pid', String(pid), '/t', '/f'], () => { })
            } catch {
                // ignore
            }
        }

        this.yaagcProcess = null
    }

    private sendInputPacketToAGC(tuple: [number, number, number]): void {
        if (!this.client) return
        const [maskBuf, dataBuf] = encodeInputPacket(tuple)
        this.client.write(maskBuf)
        this.client.write(dataBuf)
    }

    private emitCurrentState(): void {
        if (this.parsing.vnFlashing && this.parsing.vnFlashState) {
            this.emitState({ ...this.state, VerbD1: '', VerbD2: '', NounD1: '', NounD2: '' })
        } else {
            this.emitState(this.state)
        }
    }

    private processOutputPacket(): boolean {
        const decoded = decodeOutputPacket(this.inputBuffer)
        if (decoded === null) {
            this.inputBuffer.shift()
            return false
        }

        const [channel, value] = decoded
        this.state = { ...this.state }
        const relevantData = parseAGCOutput(channel, value, this.state, this.parsing)
        this.inputBuffer.splice(0, 4)
        return relevantData
    }
}
