"use client"

import { useEffect, useRef } from "react"
import type { MenuState, MenuScreen } from "./useMenuNavigation"
import type { ConfigState } from "../../types/config"
import type { DskyState, DskyClient } from "../../types/dsky"
import { SCREEN_AREA } from "./constants"
import MainScreen from "./screens/mainScreen"
import SimulateScreen from "./screens/simulateScreen"
import ConnectScreen from "./screens/connectScreen"
import CommandsScreen from "./screens/commandsScreen"
import SettingsScreen from "./screens/settingsScreen"
import AboutScreen from "./screens/aboutScreen"

interface MenuOverlayProps {
    menuState: MenuState
    onClose: () => void
    onNavigateTo: (screen: MenuScreen) => void
    onNavigateBack: () => void
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    onMoveSelection: (delta: number, maxItems: number) => void
    configState: ConfigState | null
    clients: DskyClient[]
    wsConnected: boolean
    viewMode: 'screen' | 'full'
    onCycleViewMode: () => void
    sendConfigMessage: (type: string, data?: Record<string, unknown>) => void
    sendKey: (key: string) => void
    dskyState: DskyState
    mode?: 'overlay' | 'screen'
}


export default function MenuOverlay({
    menuState,
    onClose,
    onNavigateTo,
    onNavigateBack,
    selectedIndex,
    onSetSelectedIndex,
    onMoveSelection,
    configState,
    clients,
    wsConnected,
    viewMode,
    onCycleViewMode,
    sendConfigMessage,
    sendKey,
    dskyState,
    mode = 'overlay',
}: MenuOverlayProps) {
    const overlayRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (menuState.isOpen) {
            overlayRef.current?.focus()
        }
    }, [menuState.isOpen])

    if (!menuState.isOpen) return null

    const isSubScreen = menuState.activeScreen !== 'main'

    const renderScreen = () => {
        switch (menuState.activeScreen) {
            case 'main':
                return (
                    <MainScreen
                        selectedIndex={selectedIndex}
                        onSelect={onNavigateTo}
                        onSetSelectedIndex={onSetSelectedIndex}
                        configState={configState}
                        sendConfigMessage={sendConfigMessage}
                        onClose={onClose}
                    />
                )
            case 'simulate':
                return (
                    <SimulateScreen
                        selectedIndex={selectedIndex}
                        onSetSelectedIndex={onSetSelectedIndex}
                        sendConfigMessage={sendConfigMessage}
                        onClose={onClose}
                    />
                )
            case 'connect':
                return (
                    <ConnectScreen
                        selectedIndex={selectedIndex}
                        onSetSelectedIndex={onSetSelectedIndex}
                        configState={configState}
                        sendConfigMessage={sendConfigMessage}
                        onClose={onClose}
                    />
                )
            case 'commands':
                return (
                    <CommandsScreen configState={configState} />
                )
            case 'settings':
                return (
                    <SettingsScreen
                        selectedIndex={selectedIndex}
                        onSetSelectedIndex={onSetSelectedIndex}
                        configState={configState}
                        sendConfigMessage={sendConfigMessage}
                        viewMode={viewMode}
                        onCycleViewMode={onCycleViewMode}
                        onClose={onClose}
                    />
                )
            case 'about':
                return (
                    <AboutScreen
                        configState={configState}
                        wsConnected={wsConnected}
                        clients={clients}
                    />
                )
            default:
                return null
        }
    }

    const positionStyle = mode === 'screen'
        ? {
            position: 'absolute' as const,
            inset: 0,
        }
        : {
            position: 'absolute' as const,
            left: `${SCREEN_AREA.left}%`,
            top: `${SCREEN_AREA.top}%`,
            width: `${SCREEN_AREA.right - SCREEN_AREA.left}%`,
            height: `${SCREEN_AREA.bottom - SCREEN_AREA.top}%`,
        }

    return (
        <div
            ref={overlayRef}
            className={mode === 'screen' ? 'menu-overlay-screen' : undefined}
            style={{
                ...positionStyle,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                zIndex: mode === 'screen' ? 1000 : 5,
                backgroundColor: 'transparent',
                outline: 'none',
                fontFamily: 'monospace',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="DSKY Menu"
            tabIndex={-1}
        >
            {/* Scanlines */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px)',
                pointerEvents: 'none',
                zIndex: 10,
            }} />

            {/* Content area — full height flex column */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                padding: '2.5cqh 3cqw',
                boxSizing: 'border-box',
                overflow: 'hidden',
            }}>
                {/* Scrollable screen content — takes all available space */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    scrollbarWidth: 'none',
                }}>
                    {renderScreen()}
                </div>

                {/* Nav hints — compact, pinned at bottom */}
                <div style={{
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '2.5cqw',
                    marginTop: '1.5cqh',
                    fontSize: '3cqh',
                    color: 'var(--menu-secondary)',
                    flexWrap: 'wrap',
                }}>
                    <span><K>+</K>/<K>-</K> nav</span>
                    <span><K>ENTR</K> sel</span>
                    {isSubScreen && <span><K>CLR</K> back</span>}
                    <span><K>K.REL</K> close</span>
                </div>
            </div>
        </div>
    )
}

/* Tiny helper for green key labels in nav hints */
function K({ children }: { children: React.ReactNode }) {
    return (
        <span style={{ color: 'var(--menu-primary)', fontWeight: 600 }}>
            {children}
        </span>
    )
}

