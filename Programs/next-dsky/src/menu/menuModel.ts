/**
 * Shared menu model — single source of truth for screen items and actions.
 * Imported by both server (for logic/key handling) and client (for rendering).
 * No React, no "use client" — pure TypeScript data.
 */

import type { MenuScreen, ServerState, MenuState } from '../types/serverState'

// --- Item actions ---

export type ItemAction =
    | { type: 'navigate'; screen: MenuScreen }
    | { type: 'action'; action: string; data?: Record<string, unknown>; then?: 'close' | 'back' }
    | { type: 'action+navigate'; action: string; screen: MenuScreen; data?: Record<string, unknown> }
    | { type: 'noop' }

export interface MenuItemDef {
    id: string
    icon: string
    label: string
    badge?: string
    badgeActive?: boolean
    action: ItemAction
}

// --- Shared constants ---

const YAAGC_VERSIONS = [
    { name: 'Comanche055', value: 'Comanche055', icon: '\u25B3' },
    { name: 'Luminary099', value: 'Luminary099', icon: '\u25C7' },
    { name: 'Luminary210', value: 'Luminary210', icon: '\u25C8' },
    { name: 'Start my own YaAGC', value: 'own', icon: '\u25B7' },
]

// --- Screen items ---

function mainScreenItems(serverState: ServerState): MenuItemDef[] {
    const items: MenuItemDef[] = [
        { id: 'simulate', icon: '\u25C7', label: 'SIMULATE', action: { type: 'navigate', screen: 'simulate' } },
    ]
    if (serverState.ha.enabled) {
        items.push({ id: 'ha', icon: '\u25CE', label: 'HOME ASST', action: { type: 'navigate', screen: 'haMenu' } })
    }
    items.push(
        { id: 'apps',     icon: '\u25A6', label: 'APPS', action: { type: 'navigate', screen: 'apps' } },
        { id: 'commands', icon: '\u2630', label: 'COMMANDS', action: { type: 'navigate', screen: 'commands' } },
        { id: 'settings', icon: '\u2699', label: 'SETTINGS', action: { type: 'navigate', screen: 'settings' } },
    )
    return items
}

function haMenuScreenItems(serverState: ServerState): MenuItemDef[] {
    const haActive = serverState.app.id === 'homeassistant'
    return [
        haActive
            ? { id: 'ha-quit', icon: '\u2298', label: 'QUIT', action: { type: 'action', action: 'action:enter-idle', then: 'close' } }
            : { id: 'ha-enable', icon: '\u25CE', label: 'ENABLE', action: { type: 'action', action: 'action:switch-app', data: { app: 'homeassistant' }, then: 'close' } },
        { id: 'ha-config', icon: '\u2699', label: 'CONFIGURE', action: { type: 'navigate', screen: 'haSetup' } },
    ]
}

function simulateScreenItems(): MenuItemDef[] {
    return [
        { id: 'yaagc',   icon: '\u25B3', label: 'yaAGC', action: { type: 'navigate', screen: 'yaAgcSelect' } },
        { id: 'nassp',   icon: '\u2609', label: 'NASSP', action: { type: 'action', action: 'action:switch-app', data: { app: 'nassp' }, then: 'close' } },
        { id: 'reentry', icon: '\u2604', label: 'REENTRY', action: { type: 'action', action: 'action:switch-app', data: { app: 'reentry' }, then: 'close' } },
        { id: 'ksp',     icon: '\u2641', label: 'KSP', action: { type: 'action', action: 'action:switch-app', data: { app: 'ksp' }, then: 'close' } },
        { id: 'bridge',  icon: '\u21C4', label: 'BRIDGE', action: { type: 'navigate', screen: 'bridgeSelect' } },
    ]
}

function appsScreenItems(): MenuItemDef[] {
    return [
        { id: 'calculator', icon: '\u2211', label: 'CALCULATOR', action: { type: 'action', action: 'action:switch-app', data: { app: 'calculator' }, then: 'close' } },
        { id: 'clock',      icon: '\u25F4', label: 'CLOCK', action: { type: 'action', action: 'action:switch-app', data: { app: 'clock' }, then: 'close' } },
        { id: 'random',     icon: '\u2684', label: 'RANDOM', action: { type: 'action', action: 'action:switch-app', data: { app: 'random' }, then: 'close' } },
        { id: 'games',      icon: '\u2B23', label: 'GAMES', action: { type: 'navigate', screen: 'games' } },
    ]
}

function settingsScreenItems(serverState: ServerState): MenuItemDef[] {
    const items: MenuItemDef[] = [
        {
            id: 'serial',
            icon: '\u2B80',
            label: 'SERIAL',
            badge: serverState.serial.port || 'None',
            badgeActive: !!serverState.serial.port,
            action: { type: 'navigate', screen: 'serialSelect' },
        },
    ]

    if (!serverState.network.locked && (serverState.network.available?.length ?? 0) > 1) {
        items.push({
            id: 'network',
            icon: '\u25CE',
            label: 'NETWORK',
            badge: serverState.network.interface || 'Auto',
            badgeActive: !!serverState.network.interface,
            action: { type: 'navigate', screen: 'networkInterface' },
        })
    }

    if (serverState.wifi.available) {
        items.push({
            id: 'wifi',
            icon: 'wifi-svg',
            label: 'WIFI',
            badge: serverState.wifi.running ? 'RUNNING' : undefined,
            badgeActive: serverState.wifi.running,
            action: serverState.wifi.running
                ? { type: 'navigate', screen: 'wifi' }
                : { type: 'action+navigate', action: 'action:wifi-connect', screen: 'wifi' },
        })
    }

    if (serverState.reboot) {
        items.push({
            id: 'reboot',
            icon: '\u21BB',
            label: 'REBOOT',
            action: { type: 'action', action: 'action:reboot' },
        })
    }

    if (serverState.shutdown) {
        items.push({
            id: 'shutdown',
            icon: '\u23FB',
            label: 'SHUTDOWN',
            action: { type: 'action', action: 'action:shutdown' },
        })
    }

    items.push({
        id: 'about',
        icon: '\u24D8',
        label: 'ABOUT',
        action: { type: 'navigate', screen: 'about' },
    })

    return items
}

function yaAgcSelectScreenItems(): MenuItemDef[] {
    return YAAGC_VERSIONS.map(v => ({
        id: v.value,
        icon: v.icon,
        label: v.name,
        action: { type: 'action' as const, action: 'action:switch-app', data: { app: 'yaagc', yaagcVersion: v.value }, then: 'close' as const },
    }))
}

function bridgeSelectScreenItems(serverState: ServerState): MenuItemDef[] {
    const apis = serverState.bridge.discovered ?? []
    return [
        { id: 'public', icon: '\u2295', label: 'PUBLIC', action: { type: 'action', action: 'action:switch-app', data: { app: 'bridge', bridgeUrl: 'wss://dsky.ortizma.com/ws' }, then: 'close' } },
        ...apis.map(api => ({
            id: `api-${api.ip}:${api.port}`,
            icon: '\u21C4',
            label: api.name ?? api.ip,
            action: { type: 'action' as const, action: 'action:switch-app', data: { app: 'bridge', bridgeUrl: api.url }, then: 'close' as const },
        })),
        { id: 'rescan', icon: '\u21BB', label: 'RESCAN', action: { type: 'action', action: 'action:scan-bridges' } },
        { id: 'manual', icon: '\u270E', label: 'MANUAL URL', action: { type: 'action', action: 'action:switch-app', data: { app: 'bridge', bridgeUrl: 'wss://' }, then: 'close' } },
    ]
}

function serialSelectScreenItems(serverState: ServerState): MenuItemDef[] {
    const ports = serverState.serial.available ?? []
    return [
        { id: 'none', icon: '\u2298', label: 'NO SERIAL', action: { type: 'action', action: 'action:set-serial', data: { port: null }, then: 'back' } },
        ...ports.map(p => ({
            id: `port-${p.path}`,
            icon: '\u21C4',
            label: p.name,
            badge: p.path === serverState.serial.port ? 'ACTIVE' : undefined,
            badgeActive: p.path === serverState.serial.port ? true : undefined,
            action: { type: 'action' as const, action: 'action:set-serial', data: { port: p.path }, then: 'back' as const },
        })),
        { id: 'refresh', icon: '\u21BB', label: 'REFRESH', action: { type: 'action', action: 'action:list-ports' } },
    ]
}

function networkInterfaceScreenItems(serverState: ServerState): MenuItemDef[] {
    const ifaces = serverState.network.available ?? []
    return [
        {
            id: 'auto',
            icon: '\u25CE',
            label: 'AUTO',
            badge: 'DEFAULT',
            badgeActive: serverState.network.interface === null,
            action: { type: 'action', action: 'action:set-network-interface', data: { ip: null }, then: 'back' },
        },
        ...ifaces.map(iface => ({
            id: `iface-${iface.ip}`,
            icon: '\u21C4',
            label: iface.name,
            badge: iface.ip,
            badgeActive: iface.ip === serverState.network.interface,
            action: { type: 'action' as const, action: 'action:set-network-interface', data: { ip: iface.ip }, then: 'back' as const },
        })),
    ]
}

// --- Public API ---

/**
 * Get the list of selectable items for a given screen.
 * Returns [] for screens with no card grid (info panels, QR screens, etc.).
 */
export function getScreenItems(screen: MenuScreen, serverState: ServerState, _menuState: MenuState): MenuItemDef[] {
    switch (screen) {
        case 'main':             return mainScreenItems(serverState)
        case 'haMenu':           return haMenuScreenItems(serverState)
        case 'simulate':         return simulateScreenItems()
        case 'apps':             return appsScreenItems()
        case 'settings':         return settingsScreenItems(serverState)
        case 'yaAgcSelect':      return yaAgcSelectScreenItems()
        case 'bridgeSelect':     return bridgeSelectScreenItems(serverState)
        case 'serialSelect':     return serialSelectScreenItems(serverState)
        case 'networkInterface': return networkInterfaceScreenItems(serverState)
        // Screens with no selectable items
        case 'commands':
        case 'about':
        case 'games':
        case 'haSetup':
        case 'wifi':
        default:
            return []
    }
}

/**
 * Get the number of selectable items for a given screen.
 */
export function getScreenItemCount(screen: MenuScreen, serverState: ServerState, menuState: MenuState): number {
    return getScreenItems(screen, serverState, menuState).length
}
