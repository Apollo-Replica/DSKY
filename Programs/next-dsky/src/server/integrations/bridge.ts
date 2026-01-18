import { client as WebSocketClient, connection as WebSocketConnection } from 'websocket'
import { AgcIntegration } from './AgcIntegration'

export class BridgeIntegration extends AgcIntegration {
    readonly name = 'Bridge'
    readonly id = 'bridge'
    
    private client: WebSocketClient | null = null
    private activeConnection: WebSocketConnection | null = null
    private bridgeHost: string = ''
    private shouldReconnect = true

    async handleKey(key: string): Promise<void> {
        if (this.activeConnection) {
            this.activeConnection.sendUTF(key)
        }
    }

    protected async onStart(options: Record<string, any>): Promise<void> {
        this.client = new WebSocketClient()
        this.shouldReconnect = true
        
        this.client.on('connectFailed', () => this.onDisconnect())
        this.client.on('connect', (connection) => this.onConnect(connection))
        
        this.bridgeHost = options.bridgeUrl || 'wss://dsky.ortizma.com/ws'
        console.log(`[Bridge] Connecting to: ${this.bridgeHost}`)
        this.connectClient()
    }

    protected onStop(): void {
        this.shouldReconnect = false
        if (this.activeConnection) {
            this.activeConnection.close()
            this.activeConnection = null
        }
        this.client = null
    }

    private async onDisconnect(): Promise<void> {
        this.activeConnection = null
        if (!this.shouldReconnect || !this.running) return
        console.log('[Bridge] Connection failed, reconnecting...')
        await new Promise(r => setTimeout(r, 1000))
        if (this.shouldReconnect && this.running) {
            this.connectClient()
        }
    }

    private onConnect(connection: WebSocketConnection): void {
        console.log('[Bridge] Connected!')
        this.activeConnection = connection
        connection.on('message', (message: any) => {
            if (message.type === 'utf8') {
                this.emitState(JSON.parse(message.utf8Data))
            }
        })
        connection.on('close', () => this.onDisconnect())
    }

    private connectClient(): void {
        if (!this.client || !this.shouldReconnect || !this.running) return
        this.client.connect(this.bridgeHost, 'echo-protocol')
    }
}
