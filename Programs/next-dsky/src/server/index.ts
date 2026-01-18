import { WebSocketServer } from 'ws'
import { exec } from 'child_process'
import { getReentryKeyboardHandler, watchStateReentry } from './integrations/reentry'
import { getNASSPKeyboardHandler, watchStateNASSP } from './integrations/nassp'
import { getKSPKeyboardHandler, watchStateKSP } from './integrations/ksp'
import { getYaAGCKeyboardHandler, watchStateYaAGC } from './integrations/yaAGC'
import { getHAKeyboardHandler, watchStateHA } from './integrations/homeassistant'
import { getBridgeKeyboardHandler, watchStateBridge } from './integrations/bridge'
import { watchStateRandom } from './integrations/random'
import { createSerial, createSerialFromConfig, setSerialListener, updateSerialState, closeSerial } from './serial'
import { initWebSocket, setWebSocketListener, updateWebSocketState, setConfigListener } from './socket'
import {
    initConfig,
    getConfigState,
    resetToConfig,
    configNext,
    configPrev,
    configSelect,
    configBack,
    configDirectSelect,
    updateConfig,
    updateDiscoveredApis,
    refreshSerialPorts
} from './configState'
import { scanForDSKYApis } from './networkScan'

let activeWatcher: any = null
let pendingUpdate: any = null
let keyboardHandler: ((key: string) => any) | null = null
let programOptions: any = {}

const watchState = async (inputSource: string, callback: (state: any) => void, options: any = {}) => {
    switch (inputSource) {
        case "reentry":
            return watchStateReentry(callback)
        case "nassp":
            return watchStateNASSP(callback)
        case "ksp":
            return watchStateKSP(callback)
        case "bridge":
            return await watchStateBridge(callback, options)
        case "yaagc":
            return watchStateYaAGC(callback, options)
        case "homeassistant":
            return watchStateHA(callback)
        case "random":
        default:
            return await watchStateRandom(callback)
    }
}

const getKeyboardHandler = async (inputSource: string) => {
    switch (inputSource) {
        case "reentry":
            return getReentryKeyboardHandler()
        case "nassp":
            return getNASSPKeyboardHandler()
        case "ksp":
            return await getKSPKeyboardHandler()
        case "bridge":
            return await getBridgeKeyboardHandler()
        case "yaagc":
            return await getYaAGCKeyboardHandler()
        case "homeassistant":
            return await getHAKeyboardHandler()
        default:
            return async (_data: string) => {}
    }
}

const stopWatcher = () => {
    if (activeWatcher && typeof activeWatcher === 'function') {
        console.log('[Config] Stopping active watcher')
        activeWatcher() // Call the stop function
    }
    activeWatcher = null
    keyboardHandler = null
}

// Perform full reset - stop watcher, close serial, reset to config
const performReset = () => {
    console.log('[Config] Performing full reset')
    stopWatcher()
    closeSerial()
    resetToConfig()
}

const startWatcher = async (options: any) => {
    const config = getConfigState()
    const inputSource = config.inputSource || 'random'

    console.log(`[Config] Starting watcher for: ${inputSource}`)

    // Create serial connection if configured
    if (config.serialPort) {
        console.log(`[Config] Creating serial connection to: ${config.serialPort}`)
        await createSerialFromConfig(config.serialPort, options.baud || '9600')
    }

    // Build options for the watcher
    const watcherOptions = { ...options }
    if (config.yaagcVersion) {
        watcherOptions.yaagc = config.yaagcVersion
    }
    if (config.bridgeUrl) {
        watcherOptions.bridgeUrl = config.bridgeUrl
    }

    activeWatcher = await watchState(inputSource, (state) => {
        pendingUpdate = state
    }, watcherOptions)

    keyboardHandler = await getKeyboardHandler(inputSource)

    if (options.callback) {
        exec(options.callback)
    }
}

// Config keyboard handler
const handleConfigKey = async (key: string) => {
    const config = getConfigState()

    switch (key) {
        case '+':
        case 'v':
            configNext()
            break
        case '-':
        case 'n':
            configPrev()
            break
        case 'e':
        case 'p':
            const result = await configSelect()
            if (result.done && result.startWatcher) {
                // Start the actual watcher with selected config
                await startWatcher(programOptions)
            }
            // Check if we need to trigger a network scan
            if (config.step === 'source' && config.inputSource === 'bridge') {
                triggerNetworkScan()
            }
            break
        case 'c':
            configBack()
            break
        case 'o':
            // PRO release - ignore in config mode
            break
        default:
            if (/[0-9]/.test(key)) {
                configDirectSelect(parseInt(key))
            }
    }
}

const triggerNetworkScan = async () => {
    updateConfig({ scanning: true })
    console.log('[Config] Starting network scan...')

    try {
        const apis = await scanForDSKYApis((current, total) => {
            if (current % 50 === 0) {
                console.log(`[Config] Scanning: ${current}/${total}`)
            }
        })
        console.log(`[Config] Found ${apis.length} DSKY APIs`)
        updateDiscoveredApis(apis)
    } catch (error) {
        console.error('[Config] Network scan failed:', error)
        updateDiscoveredApis([])
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

    // Handle config messages from WebSocket
    setConfigListener(async (type: string, data?: any) => {
        console.log(`[Config] Received: ${type}`)
        switch (type) {
            case 'config:refresh-ports':
                await refreshSerialPorts()
                break
            case 'config:scan-apis':
                await triggerNetworkScan()
                break
            case 'config:next':
                configNext()
                break
            case 'config:prev':
                configPrev()
                break
            case 'config:select':
                const result = await configSelect()
                if (result.done && result.startWatcher) {
                    await startWatcher(programOptions)
                }
                const config = getConfigState()
                if (config.scanning) {
                    triggerNetworkScan()
                }
                break
            case 'config:back':
                configBack()
                break
            case 'config:key':
                if (data?.key) {
                    await handleConfigKey(data.key)
                }
                break
            case 'config:reset':
                if (process.env.DISABLE_RESET === '1') {
                    console.log('[Config] Reset requested but DISABLE_RESET is enabled')
                    return
                }
                performReset()
        }
    })

    // Check if mode was specified via CLI (skip config)
    if (options.mode) {
        console.log(`[Config] Mode specified via CLI: ${options.mode}`)
        updateConfig({
            ready: true,
            inputSource: options.mode,
            serialPort: options.serial || null
        })
        await startWatcher(options)
    } else {
        // Initialize config mode
        console.log('[Config] Starting in config mode')
        await initConfig()
    }

    // Set up keyboard handlers
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

        const config = getConfigState()

        // Three '-' presses & holding PRO for 3 seconds runs the shutdown handler (if any)
        if (key == 'p' && minusCount >= 3 && options.shutdown) {
            shutdownTimeout = setTimeout(() => exec(options.shutdown), 3000)
            return
        }

        // Three '+' presses & holding PRO for 3 seconds resets to config mode
        if (key == 'p' && plusCount >= 3 && config.ready && process.env.DISABLE_RESET !== '1') {
            resetTimeout = setTimeout(() => {
                console.log('[Config] PRO+++ detected via Serial')
                performReset()
            }, 3000)
            return
        }

        if (key == '+') plusCount++
        else plusCount = 0
        if (key == '-') minusCount++
        else minusCount = 0

        // Route to appropriate handler based on config state
        if (!config.ready) {
            await handleConfigKey(key)
        } else if (keyboardHandler) {
            await keyboardHandler(key)
        }
    })

    // Separate counters for WebSocket (web interface)
    let wsPlusCount = 0
    let wsMinusCount = 0
    let wsShutdownTimeout: ReturnType<typeof setTimeout> | undefined
    let wsResetTimeout: ReturnType<typeof setTimeout> | undefined

    setWebSocketListener(async (data) => {
        const key = data.toString().toLowerCase().substring(0, 1)
        console.log(`[WS] KeyPress: ${key}`)

        // 'o' is PRO key release - don't process it as a regular key
        // and don't let it cancel the reset/shutdown timeouts
        if (key === 'o') return

        if (wsShutdownTimeout) clearTimeout(wsShutdownTimeout)
        if (wsResetTimeout) clearTimeout(wsResetTimeout)

        const config = getConfigState()

        // Three '-' presses & holding PRO for 3 seconds runs the shutdown handler (if any)
        if (key == 'p' && wsMinusCount >= 3 && options.shutdown) {
            wsShutdownTimeout = setTimeout(() => exec(options.shutdown), 3000)
            return
        }

        // Three '+' presses & holding PRO for 3 seconds resets to config mode
        if (key == 'p' && wsPlusCount >= 3 && config.ready && process.env.DISABLE_RESET !== '1') {
            wsResetTimeout = setTimeout(() => {
                console.log('[Config] PRO+++ detected via WebSocket')
                performReset()
            }, 3000)
            return
        }

        if (key == '+') wsPlusCount++
        else wsPlusCount = 0
        if (key == '-') wsMinusCount++
        else wsMinusCount = 0

        if (!config.ready) {
            await handleConfigKey(key)
        } else if (keyboardHandler) {
            await keyboardHandler(key)
        }
    })
}
