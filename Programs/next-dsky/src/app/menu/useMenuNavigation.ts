"use client"

import { useState, useRef, useCallback, useEffect } from "react"

export type MenuScreen =
    | 'main'
    | 'simulate'
    | 'connect'
    | 'commands'
    | 'settings'
    | 'about'

export interface MenuState {
    isOpen: boolean
    activeScreen: MenuScreen
    selectedIndex: number
    screenHistory: MenuScreen[]
}

interface UseMenuNavigationOptions {
    sendKey: (key: string) => void
}

const TRIGGER_KEY = 'n'
const TRIGGER_COUNT = 3
const TRIGGER_TIMEOUT = 800 // ms between each n press

export function useMenuNavigation({ sendKey }: UseMenuNavigationOptions) {
    const [menuState, setMenuState] = useState<MenuState>({
        isOpen: false,
        activeScreen: 'main',
        selectedIndex: 0,
        screenHistory: [],
    })

    // Refs to avoid stale closures in event handlers
    const menuStateRef = useRef(menuState)
    menuStateRef.current = menuState

    // Trigger buffer for triple-N detection
    const triggerBuffer = useRef<number[]>([])
    const triggerTimeout = useRef<NodeJS.Timeout | null>(null)
    // Buffer to hold 'n' keys that might need to be flushed to WebSocket
    const pendingKeys = useRef<string[]>([])

    const openMenu = useCallback((screen: MenuScreen = 'main') => {
        setMenuState({
            isOpen: true,
            activeScreen: screen,
            selectedIndex: 0,
            screenHistory: screen === 'main' ? [] : ['main'],
        })
        triggerBuffer.current = []
        pendingKeys.current = []
    }, [])

    const closeMenu = useCallback(() => {
        setMenuState({
            isOpen: false,
            activeScreen: 'main',
            selectedIndex: 0,
            screenHistory: [],
        })
    }, [])

    const navigateTo = useCallback((screen: MenuScreen) => {
        setMenuState(prev => ({
            ...prev,
            activeScreen: screen,
            selectedIndex: 0,
            screenHistory: [...prev.screenHistory, prev.activeScreen],
        }))
    }, [])

    const navigateBack = useCallback(() => {
        setMenuState(prev => {
            if (prev.screenHistory.length === 0) {
                // At root, close menu
                return {
                    isOpen: false,
                    activeScreen: 'main' as MenuScreen,
                    selectedIndex: 0,
                    screenHistory: [],
                }
            }
            const history = [...prev.screenHistory]
            const previousScreen = history.pop()!
            return {
                ...prev,
                activeScreen: previousScreen,
                selectedIndex: 0,
                screenHistory: history,
            }
        })
    }, [])

    const setSelectedIndex = useCallback((index: number) => {
        setMenuState(prev => ({ ...prev, selectedIndex: index }))
    }, [])

    const moveSelection = useCallback((delta: number, maxItems: number) => {
        setMenuState(prev => {
            let next = prev.selectedIndex + delta
            if (next < 0) next = maxItems - 1
            if (next >= maxItems) next = 0
            return { ...prev, selectedIndex: next }
        })
    }, [])

    // Flush pending 'n' keys to WebSocket (when trigger fails)
    const flushPendingKeys = useCallback(() => {
        for (const key of pendingKeys.current) {
            sendKey(key)
        }
        pendingKeys.current = []
        triggerBuffer.current = []
    }, [sendKey])

    const clearTriggerTimeout = useCallback(() => {
        if (triggerTimeout.current) {
            clearTimeout(triggerTimeout.current)
            triggerTimeout.current = null
        }
    }, [])

    // Handle a key event. Returns true if the key was consumed (should not be sent to WS)
    const handleKeyEvent = useCallback((key: string): boolean => {
        const state = menuStateRef.current

        if (state.isOpen) {
            // Menu is open — consume all keys
            return true
        }

        // Menu is closed — check for triple-N trigger
        if (key === TRIGGER_KEY) {
            triggerBuffer.current.push(Date.now())
            pendingKeys.current.push(key)

            clearTriggerTimeout()

            if (triggerBuffer.current.length >= TRIGGER_COUNT) {
                // Check timing: all presses within timeout of each other
                const times = triggerBuffer.current
                let valid = true
                for (let i = 1; i < times.length; i++) {
                    if (times[i] - times[i - 1] > TRIGGER_TIMEOUT) {
                        valid = false
                        break
                    }
                }
                if (valid) {
                    // Triple-N detected — open menu
                    pendingKeys.current = []
                    triggerBuffer.current = []
                    openMenu()
                    return true
                } else {
                    // Timing failed — flush and reset
                    flushPendingKeys()
                    return false
                }
            }

            // Waiting for more N presses — set timeout to flush if not completed
            triggerTimeout.current = setTimeout(() => {
                flushPendingKeys()
            }, TRIGGER_TIMEOUT)

            return true // consume the 'n' while buffering
        } else {
            // Non-N key pressed while buffering — flush buffer and let key through
            if (pendingKeys.current.length > 0) {
                clearTriggerTimeout()
                flushPendingKeys()
            }
            return false
        }
    }, [openMenu, flushPendingKeys, clearTriggerTimeout])

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            clearTriggerTimeout()
        }
    }, [clearTriggerTimeout])

    return {
        menuState,
        openMenu,
        closeMenu,
        navigateTo,
        navigateBack,
        setSelectedIndex,
        moveSelection,
        handleKeyEvent,
    }
}
