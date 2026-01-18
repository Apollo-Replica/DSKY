import { WebSocketServer } from 'ws'
import { exec } from 'child_process'
import { AgcIntegration, getIntegration, ConfigIntegration, ConfigResult } from './integrations'
import { createSerial, createSerialFromConfig, setSerialListener, updateSerialState, closeSerial } from './serial'
import { initWebSocket, setWebSocketListener, updateWebSocketState, setConfigListener, broadcastConfigState } from './socket'
import { scanForDSKYApis } from './networkScan'

let activeIntegration: AgcIntegration | null = null
let configIntegration: ConfigIntegration | null = null
let pendingUpdate: any = null
let programOptions: any = {}

const stopIntegration = () => {
    if (activeIntegration) {
        console.log('[Server] Stopping active integration')
        activeIntegration.stop()
    }
    activeIntegration = null
}

// Perform full reset - stop integration, close serial, switch to config
const performReset = () => {
    console.log('[Server] Performing full reset')
    stopIntegration()
    closeSerial()
    startConfigMode()
}

const startConfigMode = async () => {
    // Create and start config integration
    configIntegration = new ConfigIntegration()
    
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

    // Get and start the selected integration
    activeIntegration = getIntegration(config.inputSource)
    await activeIntegration.start((state) => {
        pendingUpdate = state
    }, integrationOptions)

    // Broadcast that config is now ready (no longer in config mode)
    broadcastConfigState({
        ready: true,
        step: 'confirm',
        serialPort: config.serialPort,
        inputSource: config.inputSource,
        bridgeUrl: config.bridgeUrl,
        yaagcVersion: config.yaagcVersion,
        availablePorts: [],
        discoveredApis: [],
        scanning: false,
        selectedIndex: 0,
        options: []
    })

    if (programOptions.callback) {
        exec(programOptions.callback)
    }
}

const triggerNetworkScan = async () => {
    console.log('[Server] Starting network scan...')

    try {
        const apis = await scanForDSKYApis((current, total) => {
            if (current % 50 === 0) {
                console.log(`[Server] Scanning: ${current}/${total}`)
            }
        })
        console.log(`[Server] Found ${apis.length} DSKY APIs`)
        if (configIntegration) {
            configIntegration.updateDiscoveredApis(apis)
        }
    } catch (error) {
        console.error('[Server] Network scan failed:', error)
        if (configIntegration) {
            configIntegration.updateDiscoveredApis([])
        }
    }
}

export const initServer = async (wss: WebSocketServer, options: any) => {
    programOptions = options

    // Initialize WebSocket server
    initWebSocket(wss)

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
        
        // Handle reset specially - it can happen anytime
        if (type === 'config:reset') {
            if (process.env.DISABLE_RESET === '1') {
                console.log('[Server] Reset requested but DISABLE_RESET is enabled')
                return
            }
            performReset()
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
                await triggerNetworkScan()
                break
            case 'config:next':
                await configIntegration.handleKey('+')
                break
            case 'config:prev':
                await configIntegration.handleKey('-')
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
        // Initialize config mode
        console.log('[Server] Starting in config mode')
        await startConfigMode()
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
