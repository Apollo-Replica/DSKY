import { exec } from 'child_process'
import { SerialPort } from 'serialport'
import { createSerial, createSerialFromConfig, closeSerial } from './serial'
import { mdnsService } from './mdnsService'
import { detectNetworkInterfaces } from './networkInterfaces'
import { closeMenu } from './menuController'
import { serverState, updateSerial, updateNetwork, updateBridge, updateHa, updateWifi } from './stateManager'
import { activeIntegration, programOptions, startIntegration, startCustomApp, enterIdle } from './integrationManager'

let wifiConnectRunning = false

export const isWifiConnectRunning = () => wifiConnectRunning

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

const handleSwitchApp = async (data: any) => {
    const { app, serialPort, bridgeUrl, yaagcVersion, haUrl, haToken, haEntities, haSelectedEntityIds } = data
    if (!app) {
        console.log('[Server] action:switch-app missing app')
        return
    }

    if (app === 'calculator' || app === 'clock') {
        startCustomApp(app)
        return
    }

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

export const handleHaConfigure = async (data: any) => {
    const { url, token, entityIds, entities } = data
    if (!url || !token) {
        console.log('[Server] action:ha-configure missing url or token')
        return
    }

    if (entities && entityIds) {
        try {
            const { generateNounMappings, persistNounMappings } = await import('./integrations/homeassistant/entityDiscovery')
            const nouns = generateNounMappings(entityIds, entities)
            persistNounMappings(nouns, url, token)
        } catch (err) {
            console.error('[Server] Failed to persist HA noun mappings:', err)
        }
    }

    await closeSerial()
    const port = programOptions.serial || null

    await startIntegration({
        app: 'homeassistant',
        serialPort: port,
        haUrl: url,
        haToken: token,
        haEntities: entities,
        haSelectedEntityIds: entityIds,
    })

    updateHa({ configured: true, url, token, entities, selectedIds: entityIds })
    closeMenu()
}

export const handleHaReconfigure = async () => {
    console.log('[Server] Removing HA configuration')
    await closeSerial()
    if (programOptions.serial) {
        await createSerial(programOptions.serial, programOptions.baud)
    }
    try {
        const fs = await import('fs')
        const path = await import('path')
        const filePath = path.resolve('ha_entities.json')
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        console.log('[Server] Deleted ha_entities.json')
    } catch (err) {
        console.error('[Server] Failed to delete ha_entities.json:', err)
    }
    updateHa({ configured: false, url: undefined, token: undefined, entities: undefined, selectedIds: undefined, error: undefined })
    enterIdle()
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

export const dispatchAction = async (type: string, data?: any) => {
    switch (type) {
        case 'action:switch-app':      await handleSwitchApp(data); break
        case 'action:set-serial':      await handleSetSerial(data); break
        case 'action:list-ports':      await handleListPorts(); break
        case 'action:scan-bridges':    handleScanBridges(); break
        case 'action:discover-ha':     await handleDiscoverHa(data); break
        case 'action:wifi-connect':
            if (programOptions.wifiConnect) launchWifiConnect()
            else console.log('[Server] WiFi connect not enabled (no --wifi-connect arg)')
            break
        case 'action:list-interfaces':        handleListInterfaces(); break
        case 'action:set-network-interface':   handleSetNetworkInterface(data); break
        case 'action:shutdown':               handleShutdown(); break
        case 'action:enter-idle':
            await closeSerial()
            if (programOptions.serial) {
                await createSerial(programOptions.serial, programOptions.baud)
            }
            enterIdle()
            break
        default:
            console.log(`[Server] Unknown action: ${type}`)
    }
}
