import {
    createConnection,
    createLongLivedTokenAuth,
    subscribeEntities,
    Connection,
    HassEntities,
} from 'home-assistant-js-websocket'
import { NounRegistry } from './nouns'

export class HAConnectionManager {
    private url: string
    private token: string
    private nounRegistry: NounRegistry
    private connection: Connection | null = null
    private unsubscribe: (() => void) | null = null
    private onConnectionChange: (connected: boolean) => void

    constructor(
        url: string,
        token: string,
        nounRegistry: NounRegistry,
        onConnectionChange: (connected: boolean) => void
    ) {
        this.url = url
        this.token = token
        this.nounRegistry = nounRegistry
        this.onConnectionChange = onConnectionChange
    }

    async connect(): Promise<void> {
        try {
            // Convert http(s) URL to ws(s) URL for WebSocket connection
            const wsUrl = this.url
                .replace(/^http:/, 'ws:')
                .replace(/^https:/, 'wss:')
                .replace(/\/$/, '') + '/api/websocket'

            console.log(`[HA] Connecting to ${wsUrl}`)

            const auth = createLongLivedTokenAuth(this.url, this.token)

            // Timeout to avoid hanging indefinitely if HA is unreachable
            const CONNECTION_TIMEOUT = 10000
            const connection = await Promise.race([
                createConnection({ auth }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`Connection timeout after ${CONNECTION_TIMEOUT / 1000}s`)), CONNECTION_TIMEOUT)
                )
            ])
            this.connection = connection

            console.log('[HA] Connected successfully')
            this.onConnectionChange(true)

            // Subscribe to entity state changes
            const subscribedEntities = this.nounRegistry.getSubscribedEntities()
            if (subscribedEntities.length > 0) {
                console.log(`[HA] Subscribing to ${subscribedEntities.length} entities`)
                const unsub = subscribeEntities(this.connection, (entities: HassEntities) => {
                    for (const entityId of subscribedEntities) {
                        const entity = entities[entityId]
                        if (entity) {
                            this.nounRegistry.updateFromEntity(
                                entityId,
                                entity.state,
                                entity.attributes
                            )
                        }
                    }
                })
                // subscribeEntities returns a Promise<UnsubscribeFunc> in some versions
                if (unsub && typeof (unsub as any).then === 'function') {
                    (unsub as any).then((fn: () => void) => { this.unsubscribe = fn })
                } else {
                    this.unsubscribe = unsub as unknown as () => void
                }
            }

            // Handle disconnection
            this.connection.addEventListener('disconnected', () => {
                console.log('[HA] Connection lost')
                this.onConnectionChange(false)
            })

            this.connection.addEventListener('ready', () => {
                console.log('[HA] Connection restored')
                this.onConnectionChange(true)
            })

        } catch (err) {
            console.error('[HA] Connection failed:', err)
            this.onConnectionChange(false)
        }
    }

    async callService(domain: string, service: string, data?: Record<string, any>): Promise<void> {
        if (!this.connection) {
            console.log('[HA] Cannot call service — not connected')
            return
        }
        try {
            await this.connection.sendMessagePromise({
                type: 'call_service',
                domain,
                service,
                service_data: data,
            })
        } catch (err) {
            console.error(`[HA] Service call ${domain}.${service} failed:`, err)
        }
    }

    disconnect(): void {
        if (this.unsubscribe) {
            this.unsubscribe()
            this.unsubscribe = null
        }
        if (this.connection) {
            this.connection.close()
            this.connection = null
        }
        this.onConnectionChange(false)
        console.log('[HA] Disconnected')
    }
}
