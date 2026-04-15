/**
 * Server state broadcast to all connected clients.
 * Contains current integration status, available hardware, and discovery results.
 */

export interface DiscoveredAPI {
    ip: string
    port: number
    url: string
    name?: string
    version?: string
    app?: string
}

export interface DiscoveredEntity {
    entity_id: string
    friendly_name: string
    domain: string
    device_class?: string
}

export interface NetworkInterfaceOption {
    name: string
    ip: string
}

export interface AppState {
    id: string | null
    yaagcVersion?: string
    bridgeUrl?: string
    haUrl?: string
}

export interface ServerState {
    app: AppState

    serial: {
        port: string | null
        available: Array<{ path: string; name: string }>
    }

    network: {
        interface: string | null
        available: NetworkInterfaceOption[]
    }

    bridge: {
        discovered: DiscoveredAPI[]
        scanning: boolean
    }

    ha: {
        entities?: DiscoveredEntity[]
        selectedIds?: string[]
        error?: string
    }

    wifi: {
        available: boolean
        running: boolean
    }

    shutdown: boolean
}
