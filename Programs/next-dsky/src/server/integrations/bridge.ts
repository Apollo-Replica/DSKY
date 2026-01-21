import WebSocket from 'ws'
import { AgcIntegration } from './AgcIntegration'

export class BridgeIntegration extends AgcIntegration {
    readonly name = 'Bridge'
    readonly id = 'bridge'

    private ws: WebSocket | null = null
    private bridgeHost: string = ''
    private shouldReconnect = true

    async handleKey(key: string): Promise<void> {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(key)
        }
    }

    protected async onStart(options: Record<string, any>): Promise<void> {
        this.shouldReconnect = true
        this.bridgeHost = options.bridgeUrl || 'wss://dsky.ortizma.com/ws'
        console.log(`[Bridge] Connecting to: ${this.bridgeHost}`)
        this.connectClient()
    }

    protected onStop(): void {
        this.shouldReconnect = false
        if (this.ws) {
            this.ws.close()
            this.ws = null
        }
    }

    private async onDisconnect(): Promise<void> {
        this.ws = null
        if (!this.shouldReconnect || !this.running) return
        console.log('[Bridge] Connection closed, reconnecting...')
        await new Promise(r => setTimeout(r, 1000))
        if (this.shouldReconnect && this.running) {
            this.connectClient()
        }
    }

    private connectClient(): void {
        if (!this.shouldReconnect || !this.running) return

        this.ws = new WebSocket(this.bridgeHost)

        this.ws.on('open', () => {
            console.log('[Bridge] Connected!')
        })

        this.ws.on('message', (data: WebSocket.Data) => {
            try {
                const state = JSON.parse(data.toString())
                console.log('[Bridge] Received state:', JSON.stringify(state, null, 2))
                this.emitState(state)
            } catch (e) {
                console.error('[Bridge] Failed to parse message:', data.toString().substring(0, 200))
            }
        })

        this.ws.on('close', () => this.onDisconnect())
        this.ws.on('error', (err) => {
            console.error('[Bridge] WebSocket error:', err.message)
        })
    }
}
