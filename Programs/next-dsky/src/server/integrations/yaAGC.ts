import * as net from 'net'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { spawn, type ChildProcess, execFile } from 'node:child_process'
import { OFF_TEST } from '../../utils/dskyStates'
import { YAAGC_VERSIONS } from './config'
import { AgcIntegration } from './AgcIntegration'

const codeToString = (code: number): string => {
    if (code === 0) return ""
    if (code === 21) return "0"
    if (code === 3) return "1"
    if (code === 25) return "2"
    if (code === 27) return "3"
    if (code === 15) return "4"
    if (code === 30) return "5"
    if (code === 28) return "6"
    if (code === 19) return "7"
    if (code === 29) return "8"
    if (code === 31) return "9"
    return "?"
}

const parseDskyKey = (ch: string): [number, number, number] => {
    let returnValue: [number, number, number] = [0o32, 0o20000, 0o20000]
    switch (ch) {
        case '0': returnValue = [0o15, 0o20, 0o37]; break
        case '1': returnValue = [0o15, 0o1, 0o37]; break
        case '2': returnValue = [0o15, 0o2, 0o37]; break
        case '3': returnValue = [0o15, 0o3, 0o37]; break
        case '4': returnValue = [0o15, 0o4, 0o37]; break
        case '5': returnValue = [0o15, 0o5, 0o37]; break
        case '6': returnValue = [0o15, 0o6, 0o37]; break
        case '7': returnValue = [0o15, 0o7, 0o37]; break
        case '8': returnValue = [0o15, 0o10, 0o37]; break
        case '9': returnValue = [0o15, 0o11, 0o37]; break
        case '+': returnValue = [0o15, 0o32, 0o37]; break
        case '-': returnValue = [0o15, 0o33, 0o37]; break
        case 'V': returnValue = [0o15, 0o21, 0o37]; break
        case 'N': returnValue = [0o15, 0o37, 0o37]; break
        case 'R': returnValue = [0o15, 0o22, 0o37]; break
        case 'C': returnValue = [0o15, 0o36, 0o37]; break
        case 'P': returnValue = [0o32, 0o0, 0o20000]; break
        case 'PR': returnValue = [0o32, 0o20000, 0o20000]; break
        case 'K': returnValue = [0o15, 0o31, 0o37]; break
        case 'E': returnValue = [0o15, 0o34, 0o37]; break
    }
    return returnValue
}

// Get yaAGC port from version
const getYaAGCPort = (options: { yaagc?: string } = {}): number => {
    const version = options.yaagc || 'Comanche055'
    switch (version) {
        case 'Comanche055': return 19697
        case 'Luminary099': return 19797
        case 'Luminary210': return 19897
        // "own" means user started yaAGC themselves. Historically, VirtualAGC examples use 4000.
        case 'own': return 4000
        default: return 19697
    }
}

export class YaAGCIntegration extends AgcIntegration {
    readonly name = 'yaAGC'
    readonly id = 'yaagc'
    
    private client: net.Socket | null = null
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    private flashInterval: ReturnType<typeof setInterval> | null = null
    private options: { yaagc?: string } = {}
    private yaagcProcess: ChildProcess | null = null
    
    // AGC parsing state
    private last10: number = 0
    private last11: number = 0
    private last163: number = 0
    private plusMinusState1: number = 0
    private plusMinusState2: number = 0
    private plusMinusState3: number = 0
    private vnFlashing: boolean = false
    private vnFlashState: boolean = false
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
        this.last10 = 0
        this.last11 = 0
        this.last163 = 0
        this.plusMinusState1 = 0
        this.plusMinusState2 = 0
        this.plusMinusState3 = 0
        this.vnFlashing = false
        this.vnFlashState = false
        this.state = { ...OFF_TEST }
        this.inputBuffer = []

        // If user selected a known version, we should spawn yaAGC ourselves (like legacy api-dsky did).
        // If version === 'own', we only connect to an already running yaAGC.
        if (version !== 'own') {
            await this.ensureYaAGCStarted(version, port)
        } else {
            console.log(`[yaAGC] Using user-started yaAGC on port ${port}`)
        }

        this.connectSocket(port)

        // Set up verb/noun flashing interval
        this.flashInterval = setInterval(() => {
            this.vnFlashState = !this.vnFlashState
            if (this.vnFlashing) {
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

        // If we spawned yaAGC, stop it too.
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
        // Avoid multiple concurrent sockets.
        this.client?.destroy()
        this.client = new net.Socket()

        this.client.connect({ port, host: '127.0.0.1', keepAlive: true }, () => {
            console.log(`[yaAGC] Socket connected (port ${port})`)
            this.state = { ...OFF_TEST }
        })

        this.client.on('data', (data) => {
            if (!this.running) return
            const newbytes = data.toJSON().data
            if (newbytes.every((byte: number) => byte === 255)) return // Ping packet
            this.inputBuffer = [...this.inputBuffer, ...newbytes]
            while (this.inputBuffer.length >= 4) {
                const relevantData = this.outputFromAGC()
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
        if (this.yaagcProcess) {
            // Already started by this integration instance.
            return
        }

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

        // Windows sometimes needs taskkill to terminate the process tree.
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
        const [channel, value, mask] = tuple
        const outputBuffer = Buffer.alloc(4)
        // First, create and output the mask command
        outputBuffer[0] = 0x20 | ((channel >> 3) & 0x0F)
        outputBuffer[1] = 0x40 | ((channel << 3) & 0x38) | ((mask >> 12) & 0x07)
        outputBuffer[2] = 0x80 | ((mask >> 6) & 0x3F)
        outputBuffer[3] = 0xC0 | (mask & 0x3F)
        this.client.write(outputBuffer)
        // Now, the actual data for the channel
        outputBuffer[0] = 0x00 | ((channel >> 3) & 0x0F)
        outputBuffer[1] = 0x40 | ((channel << 3) & 0x38) | ((value >> 12) & 0x07)
        outputBuffer[2] = 0x80 | ((value >> 6) & 0x3F)
        outputBuffer[3] = 0xC0 | (value & 0x3F)
        this.client.write(outputBuffer)
    }

    private emitCurrentState(): void {
        if (this.vnFlashing && this.vnFlashState) {
            this.emitState({ ...this.state, VerbD1: '', VerbD2: '', NounD1: '', NounD2: '' })
        } else {
            this.emitState(this.state)
        }
    }

    private outputFromAGC(): boolean {
        let ok: number = 1

        if ((this.inputBuffer[0] & 0xF0) !== 0x00) ok = 0
        else if ((this.inputBuffer[1] & 0xC0) !== 0x40) ok = 0
        else if ((this.inputBuffer[2] & 0xC0) !== 0x80) ok = 0
        else if ((this.inputBuffer[3] & 0xC0) !== 0xC0) ok = 0

        if (ok === 0 && this.inputBuffer.length > 0) {
            this.inputBuffer.shift()
            return false
        } else if (ok === 1 && this.inputBuffer.length >= 4) {
            const channel: number = ((this.inputBuffer[0] & 0x0F) << 3) | ((this.inputBuffer[1] & 0x38) >> 3)
            const value: number = ((this.inputBuffer[1] & 0x07) << 12) | ((this.inputBuffer[2] & 0x3F) << 6) | (this.inputBuffer[3] & 0x3F)
            const relevantData = this.parseAGCOutput(channel, value)
            this.inputBuffer.splice(0, 4)
            return relevantData
        }
        return false
    }

    private parseAGCOutput(channel: number, value: number): boolean {
        if (channel === 0o13) {
            value &= 0o3000
        }

        if ((channel === 0o10 && value === this.last10) ||
            (channel === 0o11 && value === this.last11) ||
            (channel === 0o163 && value === this.last163)) return false

        if (![0o163, 0o13, 0o11, 0o10].includes(channel)) return false

        this.state = { ...this.state }
        switch (channel) {
            case 0o10:
                this.last10 = value
                const aaaa = (value >> 11) & 0x0F
                const b = (value >> 10) & 0x01
                const ccccc = (value >> 5) & 0x1F
                const ddddd = value & 0x1F
                let plusMinus: string
                const sc = codeToString(ccccc)
                const sd = codeToString(ddddd)
                switch (aaaa) {
                    case 11:
                        this.state.ProgramD1 = sc
                        this.state.ProgramD2 = sd
                        break
                    case 10:
                        this.state.VerbD1 = sc
                        this.state.VerbD2 = sd
                        break
                    case 9:
                        this.state.NounD1 = sc
                        this.state.NounD2 = sd
                        break
                    case 8:
                        this.state.Register1D1 = sd
                        break
                    case 7:
                        plusMinus = "  "
                        if (b !== 0) {
                            plusMinus = "1+"
                            this.plusMinusState1 |= 1
                        } else {
                            this.plusMinusState1 &= ~1
                        }
                        if (this.plusMinusState1 === 0 && plusMinus === "1+") this.state.Register1Sign = " "
                        else if (this.plusMinusState1 === 0 && plusMinus === "  ") this.state.Register1Sign = " "
                        else if (this.plusMinusState1 === 1 && plusMinus === "1+") this.state.Register1Sign = "+"
                        this.state.Register1D2 = sc
                        this.state.Register1D3 = sd
                        break
                    case 6:
                        plusMinus = "  "
                        if (b !== 0) {
                            plusMinus = "1-"
                            this.plusMinusState1 |= 2
                        } else {
                            this.plusMinusState1 &= ~2
                        }
                        if (this.plusMinusState1 === 0 && plusMinus === "1-") this.state.Register1Sign = ""
                        else if (this.plusMinusState1 === 0 && plusMinus === "  ") this.state.Register1Sign = ""
                        else if (this.plusMinusState1 === 2 && plusMinus === "1-") this.state.Register1Sign = "-"
                        this.state.Register1D4 = sc
                        this.state.Register1D5 = sd
                        break
                    case 5:
                        plusMinus = "  "
                        if (b !== 0) {
                            plusMinus = "2+"
                            this.plusMinusState2 |= 1
                        } else {
                            this.plusMinusState2 &= ~1
                        }
                        if (this.plusMinusState2 === 0 && plusMinus === "2+") this.state.Register2Sign = ""
                        else if (this.plusMinusState2 === 0 && plusMinus === "  ") this.state.Register2Sign = ""
                        else if (this.plusMinusState2 === 1 && plusMinus === "2+") this.state.Register2Sign = "+"
                        this.state.Register2D1 = sc
                        this.state.Register2D2 = sd
                        break
                    case 4:
                        plusMinus = "  "
                        if (b !== 0) {
                            plusMinus = "2-"
                            this.plusMinusState2 |= 2
                        } else {
                            this.plusMinusState2 &= ~2
                        }
                        if (this.plusMinusState2 === 0 && plusMinus === "2-") this.state.Register2Sign = ""
                        else if (this.plusMinusState2 === 0 && plusMinus === " ") this.state.Register2Sign = ""
                        else if (this.plusMinusState2 === 2 && plusMinus === "2-") this.state.Register2Sign = "-"
                        this.state.Register2D3 = sc
                        this.state.Register2D4 = sd
                        break
                    case 3:
                        this.state.Register2D5 = sc
                        this.state.Register3D1 = sd
                        break
                    case 2:
                        plusMinus = "  "
                        if (b !== 0) {
                            plusMinus = "3+"
                            this.plusMinusState3 |= 1
                        } else {
                            this.plusMinusState3 &= ~1
                        }
                        if (this.plusMinusState3 === 0 && plusMinus === "3+") this.state.Register3Sign = ""
                        else if (this.plusMinusState3 === 0 && plusMinus === "  ") this.state.Register3Sign = ""
                        else if (this.plusMinusState3 === 1 && plusMinus === "3+") this.state.Register3Sign = "+"
                        this.state.Register3D2 = sc
                        this.state.Register3D3 = sd
                        break
                    case 1:
                        plusMinus = "  "
                        if (b !== 0) {
                            plusMinus = "3-"
                            this.plusMinusState3 |= 2
                        } else {
                            this.plusMinusState3 &= ~2
                        }
                        if (this.plusMinusState3 === 0 && plusMinus === "3-") this.state.Register3Sign = ""
                        else if (this.plusMinusState3 === 0 && plusMinus === "  ") this.state.Register3Sign = ""
                        else if (this.plusMinusState3 === 2 && plusMinus === "3-") this.state.Register3Sign = "-"
                        this.state.Register3D4 = sc
                        this.state.Register3D5 = sd
                        break
                    case 12:
                        this.state.IlluminatePrioDisp = (value & 0x01) !== 0 ? 1 : 0
                        this.state.IlluminateNoDap = (value & 0x02) !== 0 ? 1 : 0
                        this.state.IlluminateVel = (value & 0x04) !== 0 ? 1 : 0
                        this.state.IlluminateNoAtt = (value & 0x08) !== 0 ? 1 : 0
                        this.state.IlluminateAlt = (value & 0x10) !== 0 ? 1 : 0
                        this.state.IlluminateGimbalLock = (value & 0x20) !== 0 ? 1 : 0
                        this.state.IlluminateTracker = (value & 0x80) !== 0 ? 1 : 0
                        this.state.IlluminateProg = (value & 0x100) !== 0 ? 1 : 0
                        break
                }
                break
            case 0o11:
                this.last11 = value
                this.state.IlluminateCompLight = (value & 0x02) !== 0
                this.state.IlluminateUplinkActy = (value & 0x04) !== 0 ? 1 : 0
                if ((value & 0x20) !== 0) {
                    if (!this.vnFlashing) this.vnFlashing = true
                } else {
                    if (this.vnFlashing !== false) this.vnFlashing = false
                }
                break
            case 0o163:
                this.last163 = value
                this.state.IlluminateTemp = (value & 0x08) !== 0 ? 1 : 0
                this.state.IlluminateStby = (value & 0o400) !== 0 ? 1 : 0
                this.state.IlluminateKeyRel = (value & 0o20) !== 0 ? 1 : 0
                this.state.IlluminateOprErr = (value & 0o100) !== 0 ? 1 : 0
                this.state.IlluminateRestart = (value & 0o200) !== 0 ? 1 : 0
                break
        }
        return true
    }
}
