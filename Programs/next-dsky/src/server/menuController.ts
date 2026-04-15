/**
 * Server-side menu state management.
 * Handles navigation, selection, key routing, and triple-N detection.
 */

import type { MenuScreen, MenuState, ServerState } from '../types/serverState'
import { getScreenItems, getScreenItemCount, type ItemAction } from '../menu/menuModel'

// --- Types ---

export interface MenuActionCallbacks {
    /** Execute a server action (e.g., 'action:switch-app') */
    handleAction: (action: string, data?: Record<string, unknown>) => void
    /** Get current server state (for item resolution) */
    getServerState: () => ServerState
    /** Broadcast state to all clients */
    broadcast: () => void
    /** Flush a buffered key to the active integration */
    flushKeyToIntegration: (key: string) => Promise<void>
}

// --- State ---

let menuState: MenuState = {
    isOpen: false,
    activeScreen: 'main',
    selectedIndex: 0,
    screenHistory: [],
}

let callbacks: MenuActionCallbacks

// Triple-N detection state
const TRIGGER_KEY = 'n'
const TRIGGER_COUNT = 3
const TRIGGER_TIMEOUT = 800

let triggerBuffer: number[] = []
let pendingKeys: string[] = []
let triggerTimeout: ReturnType<typeof setTimeout> | null = null

// --- Init ---

export function initMenuController(cb: MenuActionCallbacks) {
    callbacks = cb
}

// --- State access ---

export function getMenuState(): MenuState {
    return menuState
}

// --- Navigation ---

export function openMenu(screen: MenuScreen = 'main') {
    menuState = {
        isOpen: true,
        activeScreen: screen,
        selectedIndex: 0,
        screenHistory: screen === 'main' ? [] : ['main'],
    }
    callbacks.broadcast()
}

export function closeMenu() {
    menuState = {
        isOpen: false,
        activeScreen: 'main',
        selectedIndex: 0,
        screenHistory: [],
    }
    callbacks.broadcast()
}

export function navigateTo(screen: MenuScreen) {
    menuState = {
        ...menuState,
        activeScreen: screen,
        selectedIndex: 0,
        screenHistory: [...menuState.screenHistory, menuState.activeScreen],
    }

    // On-enter side effects
    switch (screen) {
        case 'serialSelect':
            callbacks.handleAction('action:list-ports')
            break
        case 'networkInterface':
            callbacks.handleAction('action:list-interfaces')
            break
    }

    callbacks.broadcast()
}

export function navigateBack() {
    if (menuState.screenHistory.length === 0) {
        closeMenu()
        return
    }
    const history = [...menuState.screenHistory]
    const previousScreen = history.pop()!
    menuState = {
        ...menuState,
        activeScreen: previousScreen,
        selectedIndex: 0,
        screenHistory: history,
    }
    callbacks.broadcast()
}

// --- Selection ---

export function setSelectedIndex(index: number) {
    const serverState = callbacks.getServerState()
    const maxItems = getScreenItemCount(menuState.activeScreen, serverState, menuState)
    if (index >= 0 && index < maxItems) {
        menuState = { ...menuState, selectedIndex: index }
        callbacks.broadcast()
    }
}

export function moveSelection(delta: number) {
    const serverState = callbacks.getServerState()
    const maxItems = getScreenItemCount(menuState.activeScreen, serverState, menuState)
    if (maxItems === 0) return

    let next = menuState.selectedIndex + delta
    if (next < 0) next = maxItems - 1
    if (next >= maxItems) next = 0
    menuState = { ...menuState, selectedIndex: next }
    callbacks.broadcast()
}

export function selectItem(index: number) {
    const serverState = callbacks.getServerState()
    const items = getScreenItems(menuState.activeScreen, serverState, menuState)
    if (index < 0 || index >= items.length) return

    menuState = { ...menuState, selectedIndex: index }
    executeAction(items[index].action)
}

function executeAction(action: ItemAction) {
    switch (action.type) {
        case 'navigate':
            navigateTo(action.screen)
            break
        case 'action':
            callbacks.handleAction(action.action, action.data)
            if (action.then === 'close') closeMenu()
            else if (action.then === 'back') navigateBack()
            else callbacks.broadcast()
            break
        case 'action+navigate':
            callbacks.handleAction(action.action, action.data)
            navigateTo(action.screen)
            break
        case 'noop':
            callbacks.broadcast()
            break
    }
}

// --- Key routing ---

/**
 * Handle a key press when the menu is open.
 * Maps DSKY keys to menu navigation actions.
 */
export function handleMenuKey(key: string) {
    switch (key) {
        case '+':
        case 'v':
            moveSelection(-1)
            break
        case '-':
        case 'n':
            moveSelection(1)
            break
        case 'e':
        case 'p':
            selectItem(menuState.selectedIndex)
            break
        case 'c':
        case 'r':
            navigateBack()
            break
        case 'k':
            closeMenu()
            break
        default:
            // Number keys: direct selection
            if (/^[1-9]$/.test(key)) {
                const idx = parseInt(key) - 1
                setSelectedIndex(idx)
            }
            break
    }
}

// --- Triple-N detection ---

function clearTriggerTimeout() {
    if (triggerTimeout) {
        clearTimeout(triggerTimeout)
        triggerTimeout = null
    }
}

async function flushPendingKeys() {
    for (const key of pendingKeys) {
        await callbacks.flushKeyToIntegration(key)
    }
    pendingKeys = []
    triggerBuffer = []
}

/**
 * Process a key press. Returns true if the key was consumed (should not go to integration).
 * Handles:
 * - When menu is open: routes to handleMenuKey
 * - When menu is closed: triple-N detection for opening menu
 */
export async function processKey(key: string): Promise<boolean> {
    // Menu is open — consume all keys
    if (menuState.isOpen) {
        handleMenuKey(key)
        return true
    }

    // Menu is closed — check for triple-N trigger
    if (key === TRIGGER_KEY) {
        triggerBuffer.push(Date.now())
        pendingKeys.push(key)

        clearTriggerTimeout()

        if (triggerBuffer.length >= TRIGGER_COUNT) {
            // Check timing: all presses within timeout of each other
            let valid = true
            for (let i = 1; i < triggerBuffer.length; i++) {
                if (triggerBuffer[i] - triggerBuffer[i - 1] > TRIGGER_TIMEOUT) {
                    valid = false
                    break
                }
            }
            if (valid) {
                pendingKeys = []
                triggerBuffer = []
                openMenu()
                return true
            } else {
                await flushPendingKeys()
                return false
            }
        }

        // Waiting for more N presses — set timeout to flush if not completed
        triggerTimeout = setTimeout(() => {
            flushPendingKeys()
        }, TRIGGER_TIMEOUT)

        return true // consume the 'n' while buffering
    } else {
        // Non-N key while buffering — flush buffer and let key through
        if (pendingKeys.length > 0) {
            clearTriggerTimeout()
            await flushPendingKeys()
        }
        return false
    }
}

// --- Auto-navigation hooks ---

/**
 * Call after updating serverState.wifi to handle auto-navigation.
 * If on wifi screen and wifi-connect finished, navigate back.
 */
export function checkWifiAutoNav(wasRunning: boolean, isRunning: boolean) {
    if (menuState.isOpen && menuState.activeScreen === 'wifi' && wasRunning && !isRunning) {
        navigateBack()
    }
}

/**
 * Call after updating serverState.ha to handle auto-navigation.
 * If on haSetup screen and HA became configured, navigate back.
 */
export function checkHaAutoNav(configured: boolean) {
    if (menuState.isOpen && menuState.activeScreen === 'haSetup' && configured) {
        navigateBack()
    }
}
