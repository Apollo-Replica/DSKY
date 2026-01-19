import * as fs from 'fs'
import * as net from 'net'
import * as psList from 'ps-list-commonjs'
import pidCwd from 'pid-cwd'
import { createWatcher } from '../filesystem'
import { AgcIntegration } from './AgcIntegration'

const kOSDictionary: Record<string, string> = {
    COMP_ACTY: 'IlluminateCompLight',
    MD1: 'ProgramD1',
    MD2: 'ProgramD2',
    VD1: 'VerbD1',
    VD2: 'VerbD2',
    ND1: 'NounD1',
    ND2: 'NounD2',
    R1S: 'Register1Sign',
    R1D1: 'Register1D1',
    R1D2: 'Register1D2',
    R1D3: 'Register1D3',
    R1D4: 'Register1D4',
    R1D5: 'Register1D5',
    R2S: 'Register2Sign',
    R2D1: 'Register2D1',
    R2D2: 'Register2D2',
    R2D3: 'Register2D3',
    R2D4: 'Register2D4',
    R2D5: 'Register2D5',
    R3S: 'Register3Sign',
    R3D1: 'Register3D1',
    R3D2: 'Register3D2',
    R3D3: 'Register3D3',
    R3D4: 'Register3D4',
    R3D5: 'Register3D5',
    I1: 'IlluminateUplinkActy',
    I2: 'IlluminateTemp',
    I3: 'IlluminateNoAtt',
    I4: 'IlluminateGimbalLock',
    I5: 'IlluminateStby',
    I6: 'IlluminateProg',
    I7: 'IlluminateKeyRel',
    I8: 'IlluminateRestart',
    I9: 'IlluminateOprErr',
    I10: 'IlluminateTracker',
    I11: 'IlluminateNoDap',
    I12: 'IlluminateAlt',
    I13: 'IlluminatePrioDisp',
    I14: 'IlluminateVel'
}

const kOSJSONtoNormalJSON = (kOSJSON: any): any => {
    const normalJSON: any = {}
    for (let i = 0; i < (kOSJSON.entries.length / 2); i++) {
        const keyIndex = i * 2
        const valueIndex = (i * 2) + 1
        const keyValue = kOSDictionary[kOSJSON.entries[keyIndex].value] || kOSJSON.entries[keyIndex].value
        let value = kOSJSON.entries[valueIndex].value
        if (value === 'b') value = ''
        normalJSON[keyValue] = value
    }
    return normalJSON
}

const getKSPPath = async (): Promise<string | undefined> => {
    const list = await (psList as any)()
    const kspProcess = list.find((p: any) => p.name === 'KSP_x64.exe')
    if (kspProcess) {
        const cwd = await pidCwd(kspProcess.pid)
        if (!cwd) {
            console.log(
                "[KSP] Windows is not returning the KSP path to this shell.\n",
                "If you're running KSP as Administrator, you will need to run the API as administrator, too.\n",
                "Thanks, Microsoft!\n\n"
            )
        } else {
            return cwd
        }
    } else {
        console.log("[KSP] KSP is not running!")
    }

    await new Promise(r => setTimeout(r, 2000))
    return undefined
}

export class KSPIntegration extends AgcIntegration {
    readonly name = 'KSP'
    readonly id = 'ksp'
    
    private kspPath: string | undefined
    private watcherHandle: { cancel: () => void } | null = null
    private kspCheckInterval: ReturnType<typeof setInterval> | null = null
    private telnetClient: net.Socket | null = null
    private keepAliveInterval: ReturnType<typeof setInterval> | null = null
    private apolloCPU = 0

    async handleKey(key: string): Promise<void> {
        if (this.telnetClient) {
            this.telnetClient.write(key)
        }
    }

    protected async onStart(_options: Record<string, any>): Promise<void> {
        // Find KSP path
        while (!this.kspPath && this.running) {
            this.kspPath = await getKSPPath()
        }

        if (!this.running || !this.kspPath) return

        console.log(`[KSP] KSP detected at ${this.kspPath}`)

        const jsonPath = `${this.kspPath}Ships\\Script\\kOS AGC\\DSKY\\AGCoutput.json`

        // Watch for AGC updates
        this.watcherHandle = createWatcher(jsonPath, () => {
            if (!this.running) return
            try {
                const KOSState = JSON.parse(fs.readFileSync(jsonPath).toString())
                const AGCState = kOSJSONtoNormalJSON(KOSState)
                this.emitState(AGCState)
            } catch { }
        })

        // Periodically check if KSP path changed
        this.kspCheckInterval = setInterval(async () => {
            if (!this.running) return
            const newKspPath = await getKSPPath()
            if (newKspPath !== this.kspPath && this.running) {
                // KSP path changed, restart watcher
                this.watcherHandle?.cancel()
                if (this.kspCheckInterval) clearInterval(this.kspCheckInterval)
                this.kspPath = undefined
                await this.onStart(_options)
            }
        }, 5000)

        // Set up telnet connection for keyboard input
        this.setupTelnetClient()
    }

    protected onStop(): void {
        console.log('[KSP] Closing watcher')
        this.watcherHandle?.cancel()
        this.watcherHandle = null
        
        if (this.kspCheckInterval) {
            clearInterval(this.kspCheckInterval)
            this.kspCheckInterval = null
        }
        
        this.toggleKeepAlive(false)
        
        if (this.telnetClient) {
            this.telnetClient.destroy()
            this.telnetClient = null
        }
        
        this.kspPath = undefined
    }

    private setupTelnetClient(): void {
        this.telnetClient = new net.Socket()
        this.apolloCPU = 0
        
        this.telnetClient.connect({ port: 5410, host: '127.0.0.1', keepAlive: true }, () => {
            console.log('[KSP] Telnet socket connected!')
            this.telnetClient?.write('1\r\n')
        })

        this.telnetClient.on('connect', () => {
            this.toggleKeepAlive(true)
        })

        this.telnetClient.on('data', (data) => {
            if (data.includes('<NONE>') && !this.apolloCPU) {
                this.apolloCPU = 0
                console.log("[KSP] kOS CPU Disconnected")
            }
            if (data.includes('Apollo()')) {
                this.toggleKeepAlive(false) // Prevent keepalive from meddling in CPU selection
                this.apolloCPU = 1
            }
            if (this.apolloCPU && data.includes('>')) {
                console.log(`[KSP] Selecting CPU [${this.apolloCPU}]`)
                this.telnetClient?.write(`${this.apolloCPU}\r`)
                this.toggleKeepAlive(true)
            }
        })

        this.telnetClient.on('close', async (hadError: boolean) => {
            if (!hadError && this.running) await this.handleSocketError('closed')
        })

        this.telnetClient.on('error', async () => {
            if (this.running) await this.handleSocketError('connection failed')
        })
    }

    private toggleKeepAlive(enable: boolean): void {
        if (enable && !this.keepAliveInterval) {
            this.keepAliveInterval = setInterval(() => this.telnetClient?.write('a'), 2000)
        }
        if (!enable && this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval)
            this.keepAliveInterval = null
        }
    }

    private async handleSocketError(error: string): Promise<void> {
        if (!this.running) return
        console.log(`[KSP] Telnet socket ${error}! Reconnecting...`)
        this.toggleKeepAlive(false)
        this.telnetClient?.destroy()
        await new Promise(r => setTimeout(r, 2000))
        if (this.running) {
            this.setupTelnetClient()
        }
    }
}
