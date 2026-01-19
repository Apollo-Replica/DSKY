import Bonjour, { Service, Browser } from 'bonjour-service'
import * as os from 'os'

// Service type for discovered services (same as Service but used for clarity)
type RemoteService = Service

const SERVICE_TYPE = 'dsky'
const SERVICE_PROTOCOL = 'tcp'

export interface DiscoveredAPI {
    ip: string
    port: number
    url: string
    name?: string
    version?: string
    mode?: string
}

interface MDNSServiceOptions {
    port: number
    name?: string
    version?: string
}

class MDNSService {
    private bonjour: Bonjour | null = null
    private publishedService: Service | null = null
    private browser: Browser | null = null
    private discoveredServices: Map<string, DiscoveredAPI> = new Map()
    private onDiscoveryUpdate: ((apis: DiscoveredAPI[]) => void) | null = null
    private options: MDNSServiceOptions | null = null
    private currentTxt: Record<string, string> = {}

    start(options: MDNSServiceOptions): void {
        if (this.bonjour) {
            console.log('[mDNS] Already started')
            return
        }

        this.options = options
        console.log('[mDNS] Starting service...')

        // Initialize Bonjour
        this.bonjour = new Bonjour()

        // Build TXT records
        this.currentTxt = {
            version: options.version || '0.1.0',
            wsPath: '/ws',
            mode: 'config',
            hostname: os.hostname()
        }

        // Publish our service
        const serviceName = options.name || `DSKY-${os.hostname()}`
        this.publishedService = this.bonjour.publish({
            name: serviceName,
            type: SERVICE_TYPE,
            port: options.port,
            txt: this.currentTxt
        })

        console.log(`[mDNS] Published: ${serviceName} on port ${options.port}`)

        // Start browsing for other DSKY services
        this.startBrowser()
    }

    private startBrowser(): void {
        if (!this.bonjour) return

        this.browser = this.bonjour.find({ type: SERVICE_TYPE })

        this.browser.on('up', (service: RemoteService) => {
            this.handleServiceUp(service)
        })

        this.browser.on('down', (service: RemoteService) => {
            this.handleServiceDown(service)
        })

        console.log('[mDNS] Browser started, listening for services...')
    }

    private handleServiceUp(service: RemoteService): void {
        // Skip our own service
        if (this.isOwnService(service)) {
            return
        }

        const key = this.getServiceKey(service)
        const api = this.serviceToDiscoveredAPI(service)

        console.log(`[mDNS] Service up: ${service.name} at ${api.ip}:${api.port}`)

        this.discoveredServices.set(key, api)
        this.notifyUpdate()
    }

    private handleServiceDown(service: RemoteService): void {
        const key = this.getServiceKey(service)

        if (this.discoveredServices.has(key)) {
            console.log(`[mDNS] Service down: ${service.name}`)
            this.discoveredServices.delete(key)
            this.notifyUpdate()
        }
    }

    private isOwnService(service: RemoteService): boolean {
        // Check if this is our own published service by comparing name
        if (!this.publishedService || !this.options) return false

        const ownName = this.publishedService.name
        return service.name === ownName
    }

    private getServiceKey(service: RemoteService): string {
        // Use FQDN as unique key, or fall back to name
        return service.fqdn || service.name
    }

    private serviceToDiscoveredAPI(service: RemoteService): DiscoveredAPI {
        // Get the first IPv4 address
        const addresses = service.addresses || []
        const ipv4 = addresses.find((addr: string) => !addr.includes(':')) || service.host || ''

        // Parse TXT records
        const txt = service.txt || {}
        const wsPath = (txt.wsPath as string) || '/ws'

        // Build WebSocket URL
        const protocol = service.port === 443 ? 'wss' : 'ws'
        const url = `${protocol}://${ipv4}:${service.port}${wsPath}`

        return {
            ip: ipv4,
            port: service.port,
            url,
            name: service.name,
            version: txt.version as string,
            mode: txt.mode as string
        }
    }

    private notifyUpdate(): void {
        if (this.onDiscoveryUpdate) {
            this.onDiscoveryUpdate(this.getDiscoveredServices())
        }
    }

    updateMode(mode: string): void {
        this.currentTxt.mode = mode
        // Note: bonjour-service doesn't support updating TXT records after publish
        // The mode will be updated on next restart
        console.log(`[mDNS] Mode updated to: ${mode} (will apply on next announcement)`)
    }

    getDiscoveredServices(): DiscoveredAPI[] {
        return Array.from(this.discoveredServices.values())
    }

    setOnDiscoveryUpdate(callback: (apis: DiscoveredAPI[]) => void): void {
        this.onDiscoveryUpdate = callback
    }

    rescan(): void {
        // Stop and restart browser to force fresh queries
        if (this.browser) {
            this.browser.stop()
        }
        this.startBrowser()

        // Immediately provide cached results
        this.notifyUpdate()
    }

    stop(): void {
        console.log('[mDNS] Stopping service...')

        if (this.browser) {
            this.browser.stop()
            this.browser = null
        }

        if (this.publishedService) {
            this.publishedService.stop?.()
            this.publishedService = null
        }

        if (this.bonjour) {
            this.bonjour.destroy()
            this.bonjour = null
        }

        this.discoveredServices.clear()
        console.log('[mDNS] Service stopped')
    }
}

// Singleton instance
export const mdnsService = new MDNSService()
