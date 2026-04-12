import Bonjour, { Service, Browser } from 'bonjour-service'
import * as os from 'os'

// Service type for discovered services (same as Service but used for clarity)
type RemoteService = Service
type RemoteServiceWithReferer = RemoteService & { referer?: { address?: string } }

const SERVICE_TYPE = 'dsky'
const SERVICE_PROTOCOL = 'tcp'
const DEFAULT_WS_PATH = '/ws'

import type { DiscoveredAPI } from '../types/config'
export type { DiscoveredAPI }

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
    private runtimeInterface: string | null = null

    setRuntimeInterface(ip: string | null): void {
        this.runtimeInterface = ip

        if (this.bonjour && this.options) {
            console.log(`[mDNS] Applying interface override: ${ip ?? '(auto)'}`)
            this.restart()
        } else {
            console.log(`[mDNS] Interface override set (will apply on start): ${ip ?? '(auto)'}`)
        }
    }

    start(options: MDNSServiceOptions): void {
        if (this.bonjour) {
            console.log('[mDNS] Already started')
            return
        }

        this.options = options
        console.log('[mDNS] Starting service...')

        const debugEnabled = process.env.DSKY_MDNS_DEBUG === '1'

        // On Windows (VPNs like Cloudflare WARP / WSL / Hyper-V), the default multicast interface
        // selection can point at the wrong adapter. This forces multicast membership + outbound
        // interface to the provided IPv4 address (e.g. Wi-Fi's 192.168.x.x).
        const interfaceEnv = this.runtimeInterface || ''
        const interfaceCandidates =
            interfaceEnv && interfaceEnv.length > 0
                ? interfaceEnv.split(',').map(s => s.trim()).filter(Boolean)
                : []

        // `multicast-dns` accepts `opts.interface` as a single IP string for binding + outbound multicast.
        // Passing an array breaks `dgram.socket.bind()` ("hostname must be of type string").
        const mdnsInterface = interfaceCandidates[0]

        if (debugEnabled) {
            console.log('[mDNS] Interface override:', mdnsInterface ?? '(none)')
            if (interfaceCandidates.length > 1) {
                console.log(
                    `[mDNS] Note: multiple interfaces provided; using first only: ${mdnsInterface}`
                )
            }
        }

        if (debugEnabled) {
            const ifaces = os.networkInterfaces()
            const summarized = Object.entries(ifaces).map(([name, entries]) => ({
                name,
                addrs: (entries || []).map(e => `${e.family}:${e.address}${e.internal ? ' (internal)' : ''}`)
            }))
            console.log('[mDNS] Network interfaces:', JSON.stringify(summarized, null, 2))
        }

        // Initialize Bonjour (opts are passed to underlying `multicast-dns`)
        // Force bind to all addresses; outbound multicast interface is controlled by `interface`.
        const mdnsOpts: Record<string, any> = { bind: '0.0.0.0' }
        if (mdnsInterface) mdnsOpts.interface = mdnsInterface

        this.bonjour = new Bonjour(mdnsOpts as any, (err: Error) => {
            console.error('[mDNS] Bonjour error:', err.message)
        })

        // Build TXT records
        this.currentTxt = {
            version: options.version || '0.1.0',
            wsPath: DEFAULT_WS_PATH,
            mode: 'config',
            hostname: os.hostname()
        }

        // Publish our service
        const serviceName = options.name || `DSKY-${os.hostname()}`
        this.publishedService = this.bonjour.publish({
            name: serviceName,
            type: SERVICE_TYPE,
            protocol: SERVICE_PROTOCOL,
            port: options.port,
            txt: this.currentTxt,
            // Helps avoid "only AAAA" edge cases on some LANs; can be overridden.
            disableIPv6: process.env.DSKY_MDNS_IPV6 === '1' ? false : true
        })

        console.log(`[mDNS] Published: ${serviceName} on port ${options.port}`)

        // Start browsing for other DSKY services
        this.startBrowser()
    }

    private startBrowser(): void {
        if (!this.bonjour) return

        // Don't filter by protocol here: some mDNS stacks omit it in queries/answers,
        // and we still want to discover them if `type` matches.
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
        // Pick the best reachable address:
        // - Prefer IPv4 from `addresses`
        // - Fall back to `referer.address` (where the announcement came from)
        // - Finally fall back to `host` (may be a hostname)
        const addresses = service.addresses || []
        const ipv4 = addresses.find((addr: string) => !addr.includes(':'))
        const refererAddr = (service as RemoteServiceWithReferer).referer?.address
        const host = service.host || ''
        const ipOrHost = ipv4 || refererAddr || host

        // Parse TXT records
        const txt = service.txt || {}
        const wsPath = (txt.wsPath as string) || DEFAULT_WS_PATH

        // Build WebSocket URL
        const protocol = service.port === 443 ? 'wss' : 'ws'
        const url = `${protocol}://${ipOrHost}:${service.port}${wsPath}`

        return {
            ip: ipOrHost,
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

    private restart(): void {
        if (!this.options) return

        // full restart so multicast interface change takes effect
        this.stop()
        this.start(this.options)
    }
}

// Singleton instance
export const mdnsService = new MDNSService()
