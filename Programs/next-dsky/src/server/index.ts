import { WebSocketServer } from 'ws'
import { exec } from 'child_process'
import { AgcIntegration, getIntegration, ConfigIntegration, ConfigResult } from './integrations'
import { createSerial, createSerialFromConfig, setSerialListener, updateSerialState, closeSerial } from './serial'
import { initWebSocket, setWebSocketListener, updateWebSocketState, setConfigListener, broadcastConfigState } from './socket'
import { mdnsService } from './mdnsService'

let activeIntegration: AgcIntegration | null = null
let configIntegration: ConfigIntegration | null = null
let pendingUpdate: any = null
let programOptions: any = {}
let wifiConnectRunning = false

const setWifiConnectRunning = (running: boolean) => {
    wifiConnectRunning = running
    if (configIntegration) {
        // This will broadcast via the integration callback
        configIntegration.setWifiConnectRunning(running)
    }
}

const launchWifiConnect = () => {
    // wifi-connect is only allowed in config mode
    if (!configIntegration) {
        console.log('[Server] wifi-connect ignored - not in config mode')
        return
    }
    if (wifiConnectRunning) {
        console.log('[Server] wifi-connect already running; ignoring request')
        return
    }
    console.log('[Server] Launching wifi-connect...')
    setWifiConnectRunning(true)
    exec('sudo wifi-connect --portal-ssid "DSKY Replica"', (err) => {
        if (err) {
            console.error('[Server] wifi-connect failed:', err)
        } else {
            console.log('[Server] wifi-connect completed')
        }
        setWifiConnectRunning(false)
    })
}

const stopIntegration = () => {
    if (activeIntegration) {
        console.log('[Server] Stopping active integration')
        activeIntegration.stop()
    }
    activeIntegration = null
}

// Perform full reset - stop integration, close serial, switch to config
const performReset = async () => {
    console.log('[Server] Performing full reset')
    stopIntegration()
    await closeSerial()

    // Reopen serial if it was specified via CLI (needed for config navigation)
    if (programOptions.serial) {
        await createSerial(programOptions.serial, programOptions.baud)
    }

    await startConfigMode()
}

const startConfigMode = async () => {
    // Create and start config integration
    // Pass preset serial port if specified via CLI
    configIntegration = new ConfigIntegration(programOptions.serial, programOptions.interface)
    
    // Set up config state broadcasting
    configIntegration.setConfigCallback((configState) => {
        broadcastConfigState(configState)
    })

    // Set up completion handler
    configIntegration.setOnComplete(async (result: ConfigResult) => {
        console.log(`[Server] Config complete, starting: ${result.inputSource}`)
        await startSelectedIntegration(result)
    })

    // Set up network scan request handler
    configIntegration.setOnScanRequest(() => {
        triggerNetworkScan()
    })

    // Windows: set mDNS outbound interface from config selection
    configIntegration.setOnNetworkInterfaceSelected((ip) => {
        mdnsService.setRuntimeInterface(ip)
    })

    // Set up WiFi Connect handler (only if --wifi-connect arg is passed)
    console.log(`[Server] WiFi Connect option: ${programOptions.wifiConnect ? 'enabled' : 'disabled'}`)
    if (programOptions.wifiConnect) {
        configIntegration.setOnWifiConfigure(() => {
            launchWifiConnect()
        })
    }

    // Start config as the active integration
    activeIntegration = configIntegration
    await configIntegration.start((state) => {
        pendingUpdate = state
    })

    // Broadcast initial config state
    broadcastConfigState(configIntegration.getConfigState())
}

const startSelectedIntegration = async (config: ConfigResult) => {
    // Stop config integration
    stopIntegration()
    configIntegration = null

    // Create serial connection if configured
    if (config.serialPort) {
        console.log(`[Server] Creating serial connection to: ${config.serialPort}`)
        await createSerialFromConfig(config.serialPort, programOptions.baud || '9600')
    }

    // Build options for the integration
    const integrationOptions: Record<string, any> = { ...programOptions }
    if (config.yaagcVersion) {
        integrationOptions.yaagc = config.yaagcVersion
    }
    if (config.bridgeUrl) {
        integrationOptions.bridgeUrl = config.bridgeUrl
    }
    if (config.haUrl) {
        integrationOptions.haUrl = config.haUrl
    }
    if (config.haToken) {
        integrationOptions.haToken = config.haToken
    }

    // Get and start the selected integration
    activeIntegration = getIntegration(config.inputSource)
    await activeIntegration.start((state) => {
        pendingUpdate = state
    }, integrationOptions)

    // Broadcast that config is now ready (no longer in config mode)
    broadcastConfigState({
        ready: true,
        step: 'confirm',
        stepNumber: 1,
        serialPort: config.serialPort,
        inputSource: config.inputSource,
        bridgeUrl: config.bridgeUrl,
        yaagcVersion: config.yaagcVersion,
        haUrl: config.haUrl,
        haEntities: config.haEntities,
        haSelectedEntityIds: config.haSelectedEntityIds,
        networkInterface: null,
        availableInterfaces: [],
        availablePorts: [],
        discoveredApis: [],
        scanning: false,
        selectedIndex: 0,
        options: []
    })
}

const triggerNetworkScan = () => {
    console.log('[Server] Triggering mDNS rescan...')

    // Get current discovered services and trigger a rescan
    const apis = mdnsService.getDiscoveredServices()
    console.log(`[Server] Currently discovered: ${apis.length} DSKY APIs`)

    if (configIntegration) {
        configIntegration.updateDiscoveredApis(apis)
    }

    // Trigger rescan for fresh results
    mdnsService.rescan()
}

export const initServer = async (wss: WebSocketServer, options: any) => {
    programOptions = options

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

            // Prefer CLI-provided interface without requiring config step.
            if (typeof options.interface === 'string' && options.interface.trim().length > 0) {
                mdnsService.setRuntimeInterface(options.interface.trim())
            }

            mdnsService.start({
                port: Number.isFinite(mdnsPort) ? mdnsPort : 3000,
                name: serviceName,
                version: '0.1.0'
            })

            // Wire mDNS discovery updates to config integration
            mdnsService.setOnDiscoveryUpdate((apis) => {
                if (configIntegration) {
                    configIntegration.updateDiscoveredApis(apis)
                }
            })
        } catch (err) {
            console.error('[Server] mDNS initialization failed:', err)
        }
    } else {
        console.log('[Server] mDNS disabled via DSKY_MDNS_DISABLED')
    }

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

    // Handle config messages from WebSocket (for UI interactions)
    setConfigListener(async (type: string, data?: any) => {
        console.log(`[Server] Config message: ${type}`)

        // Lock out all config interactions while wifi-connect is running
        if (wifiConnectRunning && type !== 'config:wifi') {
            console.log('[Server] Ignoring config message - wifi-connect running')
            return
        }

        // Handle reset specially - it can happen anytime
        if (type === 'config:reset') {
            if (process.env.DISABLE_RESET === '1') {
                console.log('[Server] Reset requested but DISABLE_RESET is enabled')
                return
            }
            performReset()
            return
        }

        // Handle WiFi Connect request (only if enabled)
        if (type === 'config:wifi') {
            if (!programOptions.wifiConnect) {
                console.log('[Server] config:wifi ignored - --wifi-connect not enabled')
                return
            }
            if (!configIntegration) {
                console.log('[Server] config:wifi ignored - not in config mode')
                return
            }
            launchWifiConnect()
            return
        }

        // Other config messages only apply when in config mode
        if (!configIntegration) {
            console.log('[Server] Ignoring config message - not in config mode')
            return
        }

        switch (type) {
            case 'config:refresh-ports':
                await configIntegration.refreshSerialPorts()
                break
            case 'config:scan-apis':
                triggerNetworkScan()
                break
            case 'config:next':
                // In config mode, '+' and '-' are inverted (hardware behavior).
                // Keep "next" semantics for the web UI by sending the '-' key.
                await configIntegration.handleKey('-')
                break
            case 'config:prev':
                // Keep "prev" semantics for the web UI by sending the '+' key.
                await configIntegration.handleKey('+')
                break
            case 'config:select':
                await configIntegration.handleKey('e')
                break
            case 'config:back':
                await configIntegration.handleKey('c')
                break
            case 'config:key':
                if (data?.key) {
                    await configIntegration.handleKey(data.key)
                }
                break
            case 'config:text-input':
                if (data?.text !== undefined) {
                    configIntegration.handleTextInputFromWeb(data.text)
                }
                break
            case 'config:done':
                // Confirm entity selection
                await configIntegration.handleKey('e')
                break
            case 'config:toggle':
                // Toggle entity in haEntities step (web UI click)
                if (data?.index !== undefined) {
                    configIntegration.toggleHaEntity(data.index)
                }
                break
        }
    })

    // Check if mode was specified via CLI (skip config)
    if (options.mode) {
        console.log(`[Server] Mode specified via CLI: ${options.mode}`)
        await startSelectedIntegration({
            inputSource: options.mode,
            serialPort: options.serial || null
        })
    } else {
        // Check for persisted Home Assistant config (auto-start on reboot)
        const { hasPersistedConfig, loadPersistedConfig } = await import('./integrations/homeassistant/settings')
        if (hasPersistedConfig()) {
            console.log('[Server] Found persisted HA config, auto-starting Home Assistant')
            const persisted = loadPersistedConfig()
            await startSelectedIntegration({
                inputSource: 'homeassistant',
                serialPort: options.serial || null,
                haEntities: persisted.entities,
                haSelectedEntityIds: persisted.selectedEntityIds,
            })
        } else {
            // Initialize config mode
            console.log('[Server] Starting in config mode')
            await startConfigMode()
        }
    }

    // Set up keyboard handlers for Serial and WebSocket
    setupKeyboardHandlers(options)
}

const setupKeyboardHandlers = (options: any) => {
    // Serial keyboard handler
    let plusCount = 0
    let minusCount = 0
    let shutdownTimeout: ReturnType<typeof setTimeout> | undefined
    let resetTimeout: ReturnType<typeof setTimeout> | undefined

    setSerialListener(async (data) => {
        const key = data.toString().toLowerCase().substring(0, 1)
        console.log(`[Serial] KeyPress: ${key}`)

        // 'o' is PRO key release - don't let it cancel the reset/shutdown timeouts
        if (key === 'o') return

        // Lock all input while wifi-connect is running
        if (wifiConnectRunning) return

        if (shutdownTimeout) clearTimeout(shutdownTimeout)
        if (resetTimeout) clearTimeout(resetTimeout)

        const isInConfig = configIntegration !== null

        // Three '-' presses & holding PRO for 3 seconds runs the shutdown handler (if any)
        if (key === 'p' && minusCount >= 3 && options.shutdown) {
            shutdownTimeout = setTimeout(() => exec(options.shutdown), 3000)
            return
        }

        // Three '+' presses & holding PRO for 3 seconds resets to config mode
        if (key === 'p' && plusCount >= 3 && !isInConfig && process.env.DISABLE_RESET !== '1') {
            resetTimeout = setTimeout(() => {
                console.log('[Server] PRO+++ detected via Serial')
                performReset()
            }, 3000)
            return
        }

        if (key === '+') plusCount++
        else plusCount = 0
        if (key === '-') minusCount++
        else minusCount = 0

        // Route to active integration
        if (activeIntegration) {
            await activeIntegration.handleKey(key)
        }
    })

    // WebSocket keyboard handler
    let wsPlusCount = 0
    let wsMinusCount = 0
    let wsShutdownTimeout: ReturnType<typeof setTimeout> | undefined
    let wsResetTimeout: ReturnType<typeof setTimeout> | undefined

    setWebSocketListener(async (data) => {
        const key = data.toString().toLowerCase().substring(0, 1)
        console.log(`[WS] KeyPress: ${key}`)

        // 'o' is PRO key release
        if (key === 'o') return

        // Lock all input while wifi-connect is running
        if (wifiConnectRunning) return

        if (wsShutdownTimeout) clearTimeout(wsShutdownTimeout)
        if (wsResetTimeout) clearTimeout(wsResetTimeout)

        const isInConfig = configIntegration !== null

        // Three '-' presses & holding PRO for 3 seconds runs the shutdown handler
        if (key === 'p' && wsMinusCount >= 3 && options.shutdown) {
            wsShutdownTimeout = setTimeout(() => exec(options.shutdown), 3000)
            return
        }

        // Three '+' presses & holding PRO for 3 seconds resets to config mode
        if (key === 'p' && wsPlusCount >= 3 && !isInConfig && process.env.DISABLE_RESET !== '1') {
            wsResetTimeout = setTimeout(() => {
                console.log('[Server] PRO+++ detected via WebSocket')
                performReset()
            }, 3000)
            return
        }

        if (key === '+') wsPlusCount++
        else wsPlusCount = 0
        if (key === '-') wsMinusCount++
        else wsMinusCount = 0

        // Route to active integration
        if (activeIntegration) {
            await activeIntegration.handleKey(key)
        }
    })
}
