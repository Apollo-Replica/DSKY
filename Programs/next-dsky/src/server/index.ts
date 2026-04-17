import { WebSocketServer } from 'ws'
import { createSerial } from './serial'
import { initWebSocket, setWebSocketListener, updateWebSocketState, setMessageListener } from './socket'
import { updateSerialState, setSerialListener } from './serial'
import { mdnsService } from './mdnsService'
import { detectNetworkInterfaces, pickBestInterface } from './networkInterfaces'
import { initMenuController, openMenu, closeMenu, navigateBack, setSelectedIndex, moveSelection, selectItem, processKey } from './menuController'
import { cleanup as cleanupClock } from './apps/clockApp'
import { serverState, broadcast, updateBridge, updateHa } from './stateManager'
import { activeIntegration, programOptions, setProgramOptions, consumePendingUpdate, startIntegration, startCustomApp, enterIdle, routeKeyToApp } from './integrationManager'
import { dispatchAction, handleHaConfigure, handleHaReconfigure, isWifiConnectRunning } from './actionHandlers'

// --- Key Routing ---

function createKeyHandler(label: string) {
    let plusCount = 0
    let resetTimeout: ReturnType<typeof setTimeout> | undefined

    return async (data: Buffer | string) => {
        const key = data.toString().toLowerCase().substring(0, 1)
        console.log(`[${label}] KeyPress: ${key}`)

        if (key === 'o') return

        if (isWifiConnectRunning()) return

        if (resetTimeout) clearTimeout(resetTimeout)

        const consumed = await processKey(key)
        if (consumed) {
            plusCount = 0
            return
        }

        if (key === 'p' && plusCount >= 3 && (activeIntegration !== null || serverState.app.id !== null)) {
            resetTimeout = setTimeout(async () => {
                console.log(`[Server] PRO+++ detected via ${label}`)
                const { closeSerial, createSerial } = await import('./serial')
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

        await routeKeyToApp(key)
    }
}

const setupKeyboardHandlers = () => {
    setSerialListener(createKeyHandler('Serial'))
    setWebSocketListener(createKeyHandler('WS'))
}

// --- Server Init ---

export const initServer = async (wss: WebSocketServer, options: any) => {
    setProgramOptions(options)

    serverState.wifi.available = !!options.wifiConnect
    serverState.shutdown = !!options.shutdown
    serverState.reboot = !!options.reboot
    serverState.serial.port = options.serial || null
    serverState.ha.enabled = process.env.DSKY_HOMEASSISTANT === '1'

    initMenuController({
        handleAction: (action, data) => dispatchAction(action, data),
        getServerState: () => serverState,
        broadcast,
        flushKeyToIntegration: async (key) => {
            await routeKeyToApp(key)
        },
    })

    initWebSocket(wss)

    const resolvedPort =
        typeof options.port === 'string'
            ? parseInt(options.port, 10)
            : (options.port ?? 3000)
    const port = Number.isFinite(resolvedPort) ? resolvedPort : 3000

    if (typeof options.interface === 'string' && options.interface.trim().length > 0) {
        serverState.network.interface = options.interface.trim()
    } else if (process.platform === 'win32') {
        const best = pickBestInterface()
        if (best) serverState.network.interface = best
    }

    const baseUrlOverride = process.env.DSKY_BASE_URL?.trim()
    if (baseUrlOverride) {
        serverState.baseUrl = baseUrlOverride.replace(/\/+$/, '')
        serverState.network.locked = true
        console.log(`[Server] baseUrl overridden via DSKY_BASE_URL: ${serverState.baseUrl}`)
    } else {
        const ip = serverState.network.interface || pickBestInterface() || 'localhost'
        serverState.baseUrl = `http://${ip}:${port}`
    }

    // Initialize mDNS service (publishing only — baseUrl is always set above)
    if (process.env.DSKY_MDNS_DISABLED !== '1') {
        try {
            const serviceName = process.env.DSKY_NAME || undefined

            if (serverState.network.interface) {
                mdnsService.setRuntimeInterface(serverState.network.interface)
            }

            mdnsService.start({
                port,
                name: serviceName,
                version: '0.1.0'
            })

            mdnsService.setOnDiscoveryUpdate((apis) => {
                updateBridge({ discovered: apis, scanning: false })
            })
        } catch (err) {
            console.error('[Server] mDNS initialization failed:', err)
        }
    } else {
        console.log('[Server] mDNS disabled via DSKY_MDNS_DISABLED')
    }

    serverState.network.available = detectNetworkInterfaces()

    const shutdown = () => {
        console.log('[Server] Shutting down...')
        cleanupClock()
        mdnsService.stop()
        process.exit(0)
    }
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)

    await createSerial(options.serial, options.baud)

    const doUpdate = () => {
        const update = consumePendingUpdate()
        if (update) {
            updateSerialState(update)
            updateWebSocketState(update)
        }
    }
    setInterval(doUpdate, 70)

    setMessageListener(async (type: string, data?: any) => {
        console.log(`[Server] Message: ${type}`)

        if (isWifiConnectRunning() && type !== 'action:wifi-connect') {
            console.log('[Server] Ignoring message - wifi-connect running')
            return
        }

        switch (type) {
            case 'action:menu-open':
                openMenu(data?.screen)
                return
            case 'action:menu-close':
                closeMenu()
                return
            case 'action:menu-back':
                navigateBack()
                return
            case 'action:menu-select':
                selectItem(data?.index ?? 0)
                return
            case 'action:menu-set-index':
                setSelectedIndex(data?.index ?? 0)
                return
            case 'action:menu-move':
                moveSelection(data?.delta ?? 0)
                return
            case 'action:ha-configure':
                await handleHaConfigure(data)
                return
            case 'action:ha-reconfigure':
                await handleHaReconfigure()
                return
        }

        await dispatchAction(type, data)
    })

    // Start the appropriate integration
    if (options.mode) {
        console.log(`[Server] App specified via CLI: ${options.mode}`)
        if (options.mode === 'calculator' || options.mode === 'clock') {
            startCustomApp(options.mode)
        } else {
            await startIntegration({
                app: options.mode,
                serialPort: options.serial || null,
                yaagcVersion: options.yaagc,
            })
        }
    } else {
        if (serverState.ha.enabled) {
            const { hasPersistedConfig, loadPersistedConfig } = await import('./integrations/homeassistant/settings')
            if (hasPersistedConfig()) {
                console.log('[Server] Found persisted HA config, remembering for later')
                const persisted = loadPersistedConfig()
                updateHa({
                    configured: true,
                    url: persisted.url,
                    token: persisted.token,
                    entities: persisted.entities,
                    selectedIds: persisted.selectedEntityIds,
                })
            }
        } else {
            console.log('[Server] Home Assistant disabled (set DSKY_HOMEASSISTANT=1 to enable)')
        }
        console.log('[Server] Starting idle')
        enterIdle()
        broadcast()
    }

    setupKeyboardHandlers()
}
