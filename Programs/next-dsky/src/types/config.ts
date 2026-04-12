/**
 * Shared types for the configuration wizard.
 * Used by both server (config.ts) and client (ConfigDisplay, ConfigPageContent).
 */

export interface DiscoveredAPI {
    ip: string
    port: number
    url: string
    name?: string
    version?: string
    mode?: string
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

export interface ConfigState {
    ready: boolean
    step: 'network' | 'serial' | 'source' | 'bridge' | 'manualUrl' | 'yaagc' | 'confirm'
        | 'haSetup' | 'haUrl' | 'haToken' | 'haDiscover' | 'haEntities'
    stepNumber: number
    serialPort: string | null
    inputSource: string | null
    bridgeUrl?: string
    yaagcVersion?: string
    networkInterface: string | null
    availableInterfaces: NetworkInterfaceOption[]
    availablePorts: Array<{path: string, name: string}>
    discoveredApis: DiscoveredAPI[]
    scanning: boolean
    selectedIndex: number
    options: string[]
    resetDisabled?: boolean
    textInput?: string
    wifiConnectAvailable?: boolean
    wifiConnectRunning?: boolean
    // Home Assistant fields
    haUrl?: string
    haToken?: string
    haEntities?: DiscoveredEntity[]
    haSelectedEntityIds?: string[]
    haDiscoverError?: string
    localUrl?: string
}

export interface ConfigResult {
    inputSource: string
    serialPort: string | null
    bridgeUrl?: string
    yaagcVersion?: string
    haUrl?: string
    haToken?: string
    haEntities?: DiscoveredEntity[]
    haSelectedEntityIds?: string[]
}
