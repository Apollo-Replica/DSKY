import { WebSocketServer } from 'ws'
import { exec } from 'child_process'
import { SerialPort } from 'serialport'
import { AgcIntegration, getIntegration } from './integrations'
import { createSerial, createSerialFromConfig, setSerialListener, updateSerialState, closeSerial } from './serial'
import { initWebSocket, setWebSocketListener, updateWebSocketState, setMessageListener, broadcastServerState } from './socket'
import { mdnsService } from './mdnsService'
import { detectNetworkInterfaces, pickBestInterface } from './networkInterfaces'
import { V35_TEST } from '../utils/dskyStates'
import type { ServerState } from '../types/serverState'

let activeIntegration: AgcIntegration | null = null
let pendingUpdate: any = null
let programOptions: any = {}
let wifiConnectRunning = false

// --- Server State ---

let serverState: ServerState = {
    app: { id: null },
    serial: { port: null, available: [] },
    network: { interface: null, available: [] },
    bridge: { discovered: [], scanning: false },
    ha: {},
    wifi: { available: false, running: false },
    shutdown: false,
}

const broadcast = () => broadcastServerState(serverState)

const updateApp = (partial: Partial<ServerState['app']>) => {
    serverState = { ...serverState, app: { ...serverState.app, ...partial } }
    broadcast()
}

const updateSerial = (partial: Partial<ServerState['serial']>) => {
    serverState = { ...serverState, serial: { ...serverState.serial, ...partial } }
    broadcast()
}

const updateNetwork = (partial: Partial<ServerState['network']>) => {
    serverState = { ...serverState, network: { ...serverState.network, ...partial } }
    broadcast()
}

const updateBridge = (partial: Partial<ServerState['bridge']>) => {
    serverState = { ...serverState, bridge: { ...serverState.bridge, ...partial } }
    broadcast()
}

const updateHa = (partial: Partial<ServerState['ha']>) => {
    serverState = { ...serverState, ha: { ...serverState.ha, ...partial } }
    broadcast()
}

const updateWifi = (partial: Partial<ServerState['wifi']>) => {
    serverState = { ...serverState, wifi: { ...serverState.wifi, ...partial } }
    broadcast()
}

// --- WiFi Connect ---

const launchWifiConnect = () => {
    if (wifiConnectRunning) {
        console.log('[Server] wifi-connect already running; ignoring request')
        return
    }
    console.log('[Server] Launching wifi-connect...')
    wifiConnectRunning = true
    updateWifi({ running: true })
    exec('sudo wifi-connect --portal-ssid "DSKY Replica"', (err) => {
        if (err) {
            console.error('[Server] wifi-connect failed:', err)
        } else {
            console.log('[Server] wifi-connect completed')
        }
        wifiConnectRunning = false
        updateWifi({ running: false })
    })
}

// --- Integration Management ---

const stopIntegration = () => {
    if (activeIntegration) {
        console.log('[Server] Stopping active integration')
        activeIntegration.stop()
    }
    activeIntegration = null
}

const enterIdle = () => {
    stopIntegration()
    mdnsService.setApp('idle')
    updateApp({ id: null, yaagcVersion: undefined, bridgeUrl: undefined, haUrl: undefined })
    // Emit test pattern so DSKY screen shows something
    pendingUpdate = V35_TEST
}

interface IntegrationConfig {
    app: string
    serialPort?: string | null
    bridgeUrl?: string
    yaagcVersion?: string
    haUrl?: string
    haToken?: string
    haEntities?: any[]
    haSelectedEntityIds?: string[]
}

const startIntegration = async (config: IntegrationConfig) => {
    console.log(`[Server] Starting integration: ${config.app}`)
    stopIntegration()

    // Create serial connection if configured
    if (config.serialPort) {
        console.log(`[Server] Creating serial connection to: ${config.serialPort}`)
        await createSerialFromConfig(config.serialPort, programOptions.baud || '9600')
    }

    // Build options for the integration
    const integrationOptions: Record<string, any> = { ...programOptions }
    if (config.yaagcVersion) integrationOptions.yaagc = config.yaagcVersion
    if (config.bridgeUrl) integrationOptions.bridgeUrl = config.bridgeUrl
    if (config.haUrl) integrationOptions.haUrl = config.haUrl
    if (config.haToken) integrationOptions.haToken = config.haToken

    // Get and start the selected integration
    activeIntegration = getIntegration(config.app)
    mdnsService.setApp(config.app)
    await activeIntegration.start((state) => {
        pendingUpdate = state
    }, integrationOptions)

    // Update server state
    updateApp({
        id: config.app,
        bridgeUrl: config.bridgeUrl,
        yaagcVersion: config.yaagcVersion,
        haUrl: config.haUrl,
    })
    updateSerial({ port: config.serialPort ?? serverState.serial.port })
    if (config.haEntities || config.haSelectedEntityIds) {
        updateHa({
            entities: config.haEntities,
            selectedIds: config.haSelectedEntityIds,
        })
    }
}

// --- Action Handlers ---

const handleSwitchApp = async (data: any) => {
    const { app, serialPort, bridgeUrl, yaagcVersion, haUrl, haToken, haEntities, haSelectedEntityIds } = data
    if (!app) {
        console.log('[Server] action:switch-app missing app')
        return
    }

    // For HA: persist noun mappings for auto-start on reboot
    if (app === 'homeassistant' && haEntities && haSelectedEntityIds) {
        try {
            const { generateNounMappings, persistNounMappings } = await import('./integrations/homeassistant/entityDiscovery')
            const nouns = generateNounMappings(haSelectedEntityIds, haEntities)
            persistNounMappings(nouns, haUrl, haToken)
        } catch (err) {
            console.error('[Server] Failed to persist HA noun mappings:', err)
        }
    }

    await closeSerial()

    // Reopen CLI serial if specified (needed for the new integration)
    const port = serialPort !== undefined ? serialPort : (programOptions.serial || null)

    await startIntegration({
        app,
        serialPort: port,
        bridgeUrl,
        yaagcVersion,
        haUrl,
        haToken,
        haEntities,
        haSelectedEntityIds,
    })
}

const handleSetSerial = async (data: any) => {
    const { port } = data
    await closeSerial()
    if (port) {
        await createSerialFromConfig(port, programOptions.baud || '9600')
    }
    updateSerial({ port: port || null })
}

const handleListPorts = async () => {
    try {
        const ports = await SerialPort.list()
        const available = ports.map((p: any) => ({
            path: p.path,
            name: p.friendlyName || p.path,
        }))
        updateSerial({ available })
    } catch (err) {
        console.error('[Server] Failed to list serial ports:', err)
    }
}

const handleScanBridges = () => {
    console.log('[Server] Triggering mDNS rescan...')
    const apis = mdnsService.getDiscoveredServices()
    updateBridge({ discovered: apis, scanning: true })
    mdnsService.rescan()
}

const handleDiscoverHa = async (data: any) => {
    const { url, token } = data
    if (!url || !token) {
        updateHa({ error: 'URL and token are required' })
        return
    }

    // Clear previous results
    updateHa({ entities: undefined, selectedIds: undefined, error: undefined })

    try {
        console.log(`[Server] Discovering HA entities at ${url}`)
        const { discoverEntities } = await import('./integrations/homeassistant/entityDiscovery')
        const entities = await discoverEntities(url, token)
        console.log(`[Server] Found ${entities.length} entities`)
        updateHa({
            entities,
            selectedIds: entities.map((e: any) => e.entity_id),
        })
    } catch (err: any) {
        console.error('[Server] HA entity discovery failed:', err?.message || err)
        updateHa({ error: err?.message || 'Connection failed' })
    }
}

const handleListInterfaces = () => {
    const available = detectNetworkInterfaces()
    updateNetwork({ available })
}

const handleSetNetworkInterface = (data: any) => {
    const { ip } = data
    mdnsService.setRuntimeInterface(ip || null)
    updateNetwork({ interface: ip || null })
}

const handleShutdown = () => {
    if (!programOptions.shutdown) {
        console.log('[Server] Shutdown not available (no --shutdown arg)')
        return
    }
    console.log('[Server] Executing shutdown command...')
    exec(programOptions.shutdown)
}

// --- Server Init ---

export const initServer = async (wss: WebSocketServer, options: any) => {
    programOptions = options

    // Initialize server state from CLI options
    serverState.wifi.available = !!options.wifiConnect
    serverState.shutdown = !!options.shutdown
    serverState.serial.port = options.serial || null

    // Initialize WebSocket server
    initWebSocket(wss)

    // Initialize mDNS service for advertisement and discovery
    if (process.env.DSKY_MDNS_DISABLED !== '1') {
        try {
            const serviceName = process.env.DSKY_NAME || undefined
            const mdnsPort =
                typeof options.port === 'string'
                    ? parseInt(options.port, 10)
                    : (options.port ?? 3000)

            // Set mDNS interface: CLI arg takes priority, then auto-detect on Windows
            if (typeof options.interface === 'string' && options.interface.trim().length > 0) {
                mdnsService.setRuntimeInterface(options.interface.trim())
                serverState.network.interface = options.interface.trim()
            } else if (process.platform === 'win32') {
                const best = pickBestInterface()
                if (best) {
                    mdnsService.setRuntimeInterface(best)
                    serverState.network.interface = best
                }
            }

            mdnsService.start({
                port: Number.isFinite(mdnsPort) ? mdnsPort : 3000,
                name: serviceName,
                version: '0.1.0'
            })

            // Wire mDNS discovery updates to server state
            mdnsService.setOnDiscoveryUpdate((apis) => {
                updateBridge({ discovered: apis, scanning: false })
            })
        } catch (err) {
            console.error('[Server] mDNS initialization failed:', err)
        }
    } else {
        console.log('[Server] mDNS disabled via DSKY_MDNS_DISABLED')
    }

    // Detect available network interfaces
    serverState.network.available = detectNetworkInterfaces()

    // Set up graceful shutdown
    const shutdown = () => {
        console.log('[Server] Shutting down...')
        mdnsService.stop()
        process.exit(0)
    }
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)

    // Create serial connection if specified via CLI
    await createSerial(options.serial, options.baud)

    // Set up the update loop
    const doUpdate = () => {
        if (pendingUpdate) {
            updateSerialState(pendingUpdate)
            updateWebSocketState(pendingUpdate)
            pendingUpdate = null
        }
    }
    setInterval(doUpdate, 70)

    // Handle messages from WebSocket clients
    setMessageListener(async (type: string, data?: any) => {
        console.log(`[Server] Message: ${type}`)

        // Lock out interactions while wifi-connect is running
        if (wifiConnectRunning && type !== 'action:wifi-connect') {
            console.log('[Server] Ignoring message - wifi-connect running')
            return
        }

        switch (type) {
            case 'action:switch-app':
                await handleSwitchApp(data)
                break
            case 'action:set-serial':
                await handleSetSerial(data)
                break
            case 'action:list-ports':
                await handleListPorts()
                break
            case 'action:scan-bridges':
                handleScanBridges()
                break
            case 'action:discover-ha':
                await handleDiscoverHa(data)
                break
            case 'action:wifi-connect':
                if (programOptions.wifiConnect) {
                    launchWifiConnect()
                } else {
                    console.log('[Server] WiFi connect not enabled (no --wifi-connect arg)')
                }
                break
            case 'action:list-interfaces':
                handleListInterfaces()
                break
            case 'action:set-network-interface':
                handleSetNetworkInterface(data)
                break
            case 'action:shutdown':
                handleShutdown()
                break
            case 'action:enter-idle':
                await closeSerial()
                if (programOptions.serial) {
                    await createSerial(programOptions.serial, programOptions.baud)
                }
                enterIdle()
                break
            default:
                console.log(`[Server] Unknown message type: ${type}`)
        }
    })

    // Start the appropriate integration
    if (options.mode) {
        console.log(`[Server] App specified via CLI: ${options.mode}`)
        await startIntegration({
            app: options.mode,
            serialPort: options.serial || null,
            yaagcVersion: options.yaagc,
        })
    } else {
        // Check for persisted Home Assistant config (auto-start on reboot)
        const { hasPersistedConfig, loadPersistedConfig } = await import('./integrations/homeassistant/settings')
        if (process.env.DSKY_HOMEASSISTANT === '1' && hasPersistedConfig()) {
            console.log('[Server] Found persisted HA config, auto-starting Home Assistant')
            const persisted = loadPersistedConfig()
            await startIntegration({
                app: 'homeassistant',
                serialPort: options.serial || null,
                haEntities: persisted.entities,
                haSelectedEntityIds: persisted.selectedEntityIds,
            })
        } else {
            // No mode specified — start idle, client will auto-open menu
            console.log('[Server] Starting idle (no integration)')
            enterIdle()
            // Broadcast initial state
            broadcastServerState(serverState)
        }
    }

    // Set up keyboard handlers for Serial and WebSocket
    setupKeyboardHandlers()
}

// --- Keyboard Handling ---

function createKeyHandler(label: string) {
    let plusCount = 0
    let resetTimeout: ReturnType<typeof setTimeout> | undefined

    return async (data: Buffer | string) => {
        const key = data.toString().toLowerCase().substring(0, 1)
        console.log(`[${label}] KeyPress: ${key}`)

        // 'o' is PRO key release - don't let it cancel the reset timeout
        if (key === 'o') return

        // Lock all input while wifi-connect is running
        if (wifiConnectRunning) return

        if (resetTimeout) clearTimeout(resetTimeout)

        // Three '+' presses & holding PRO for 3 seconds enters idle (opens menu)
        if (key === 'p' && plusCount >= 3 && activeIntegration !== null) {
            resetTimeout = setTimeout(async () => {
                console.log(`[Server] PRO+++ detected via ${label}`)
                await closeSerial()
                if (programOptions.serial) {
                    await createSerial(programOptions.serial, programOptions.baud)
                }
                enterIdle()
            }, 3000)
            return
        }

        if (key === '+') plusCount++
        else plusCount = 0

        // Route to active integration
        if (activeIntegration) {
            await activeIntegration.handleKey(key)
        }
    }
}

const setupKeyboardHandlers = () => {
    setSerialListener(createKeyHandler('Serial'))
    setWebSocketListener(createKeyHandler('WS'))
}
