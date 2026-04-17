import { getMenuState } from './menuController'
import { broadcastServerState } from './socket'
import { checkWifiAutoNav, checkHaAutoNav } from './menuController'
import type { ServerState } from '../types/serverState'

export let serverState: ServerState = {
    menu: { isOpen: false, activeScreen: 'main', selectedIndex: 0, screenHistory: [] },
    app: { id: null },
    serial: { port: null, available: [] },
    network: { interface: null, available: [], locked: false },
    bridge: { discovered: [], scanning: false },
    ha: { configured: false },
    wifi: { available: false, running: false },
    shutdown: false,
    reboot: false,
    baseUrl: null,
}

export const setServerState = (state: ServerState) => {
    serverState = state
}

export const broadcast = () => {
    serverState.menu = getMenuState()
    broadcastServerState(serverState)
}

export const updateApp = (partial: Partial<ServerState['app']>) => {
    serverState = { ...serverState, app: { ...serverState.app, ...partial } }
    broadcast()
}

export const updateSerial = (partial: Partial<ServerState['serial']>) => {
    serverState = { ...serverState, serial: { ...serverState.serial, ...partial } }
    broadcast()
}

export const updateNetwork = (partial: Partial<ServerState['network']>) => {
    serverState = { ...serverState, network: { ...serverState.network, ...partial } }
    broadcast()
}

export const updateBridge = (partial: Partial<ServerState['bridge']>) => {
    serverState = { ...serverState, bridge: { ...serverState.bridge, ...partial } }
    broadcast()
}

export const updateHa = (partial: Partial<ServerState['ha']>) => {
    const wasBefore = serverState.ha.configured
    serverState = { ...serverState, ha: { ...serverState.ha, ...partial } }
    broadcast()
    if (!wasBefore && serverState.ha.configured) {
        checkHaAutoNav(serverState.ha.configured)
    }
}

export const updateWifi = (partial: Partial<ServerState['wifi']>) => {
    const wasRunning = serverState.wifi.running
    serverState = { ...serverState, wifi: { ...serverState.wifi, ...partial } }
    broadcast()
    checkWifiAutoNav(wasRunning, serverState.wifi.running)
}
