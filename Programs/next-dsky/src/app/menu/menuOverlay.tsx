"use client"

import { useEffect, useRef } from "react"
import type { ServerState, MenuScreen } from "../../types/serverState"
import type { DskyClient } from "../../types/dsky"
import { SCREEN_AREA } from "./constants"
import { getScreenItems } from "../../menu/menuModel"
import MenuCard from "./menuCard"
import MenuGrid from "./menuGrid"
import CommandsScreen from "./screens/commandsScreen"
import AboutScreen from "./screens/aboutScreen"
import GamesScreen from "./screens/gamesScreen"
import HaSetupScreen from "./screens/haSetupScreen"
import WifiScreen from "./screens/wifiScreen"

interface MenuOverlayProps {
    serverState: ServerState | null
    clients: DskyClient[]
    wsConnected: boolean
    sendMessage: (type: string, data?: Record<string, unknown>) => void
    mode?: 'overlay' | 'screen'
}

// Card-grid screens rendered generically from menuModel
const CARD_GRID_SCREENS: Set<MenuScreen> = new Set([
    'main', 'simulate', 'apps', 'settings', 'haMenu',
    'yaAgcSelect', 'bridgeSelect', 'serialSelect', 'networkInterface',
])

// WiFi SVG icon for settings screen
function WifiIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '1em', height: '1em' }}>
            <path d="M12 20h.01" />
            <path d="M8.5 16.429a5 5 0 0 1 7 0" />
            <path d="M5 12.859a10 10 0 0 1 14 0" />
            <path d="M1.5 9.288a15 15 0 0 1 21 0" />
        </svg>
    )
}

export default function MenuOverlay({
    serverState,
    clients,
    wsConnected,
    sendMessage,
    mode = 'overlay',
}: MenuOverlayProps) {
    const overlayRef = useRef<HTMLDivElement>(null)

    const menuState = serverState?.menu
    const isOpen = menuState?.isOpen === true

    useEffect(() => {
        if (isOpen) {
            overlayRef.current?.focus()
        }
    }, [isOpen])

    if (!isOpen || !menuState || !serverState) return null

    const activeScreen = menuState.activeScreen
    const selectedIndex = menuState.selectedIndex
    const isSubScreen = activeScreen !== 'main'

    const renderScreen = () => {
        // Card-grid screens: render from menuModel
        if (CARD_GRID_SCREENS.has(activeScreen)) {
            const items = getScreenItems(activeScreen, serverState, menuState)
            const columns = activeScreen === 'networkInterface' ? 1 : undefined

            return (
                <>
                    {activeScreen === 'bridgeSelect' && serverState.bridge.scanning && (
                        <div style={{
                            textAlign: 'center',
                            fontFamily: 'monospace',
                            fontSize: '2.8cqh',
                            color: 'var(--menu-accent)',
                            marginBottom: '1.5cqh',
                        }}>
                            Discovering...
                        </div>
                    )}
                    <MenuGrid columns={columns}>
                        {items.map((item, i) => (
                            <MenuCard
                                key={item.id}
                                index={i + 1}
                                icon={item.icon === 'wifi-svg' ? <WifiIcon /> : item.icon}
                                label={item.label}
                                badge={item.badge}
                                badgeActive={item.badgeActive}
                                selected={selectedIndex === i}
                                onClick={() => sendMessage('action:menu-select', { index: i })}
                            />
                        ))}
                    </MenuGrid>
                </>
            )
        }

        // Special screens
        switch (activeScreen) {
            case 'commands':
                return <CommandsScreen serverState={serverState} />
            case 'about':
                return <AboutScreen serverState={serverState} wsConnected={wsConnected} clients={clients} />
            case 'games':
                return <GamesScreen />
            case 'haSetup':
                return <HaSetupScreen serverState={serverState} />
            case 'wifi':
                return <WifiScreen serverState={serverState} />
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

            {/* Content area */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                padding: '2.5cqh 3cqw',
                boxSizing: 'border-box',
                overflow: 'hidden',
            }}>
                {/* Scrollable screen content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    scrollbarWidth: 'none',
                }}>
                    {renderScreen()}
                </div>

                {/* Nav hints */}
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
