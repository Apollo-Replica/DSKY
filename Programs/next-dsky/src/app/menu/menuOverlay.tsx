"use client"

import { useEffect, useRef } from "react"
import type { ServerState, MenuScreen } from "../../types/serverState"
import type { DskyClient } from "../../types/dsky"
import { getScreenItems } from "../../menu/menuModel"
import MenuCard from "./menuCard"
import MenuGrid from "./menuGrid"
import CommandsScreen from "./screens/commandsScreen"
import AboutScreen from "./screens/aboutScreen"
import GamesScreen from "./screens/gamesScreen"
import HaSetupScreen from "./screens/haSetupScreen"
import WifiScreen from "./screens/wifiScreen"
import BridgeManualScreen from "./screens/bridgeManualScreen"

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

const svgBase = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { width: '1em', height: '1em' },
}

// WiFi SVG icon for settings screen
function WifiIcon() {
    return (
        <svg {...svgBase} strokeWidth="2">
            <path d="M12 20h.01" />
            <path d="M8.5 16.429a5 5 0 0 1 7 0" />
            <path d="M5 12.859a10 10 0 0 1 14 0" />
            <path d="M1.5 9.288a15 15 0 0 1 21 0" />
        </svg>
    )
}

// Rocket — SIMS main menu entry
function RocketIcon() {
    return (
        <svg {...svgBase} strokeWidth="1.5">
            <path d="M12 2 C14.5 5 15.5 9 15.5 13 L15.5 17 L8.5 17 L8.5 13 C8.5 9 9.5 5 12 2 Z" />
            <circle cx="12" cy="9.5" r="1.6" />
            <path d="M8.5 14 L5.5 18 L8.5 18" />
            <path d="M15.5 14 L18.5 18 L15.5 18" />
            <path d="M10 18 L12 22 L14 18" />
        </svg>
    )
}

// YaAGC — binary code
function YaAgcIcon() {
    return (
        <svg {...svgBase} strokeWidth="1.5" fontFamily="monospace" fontWeight="700">
            <text x="3" y="9"  fontSize="6" fill="currentColor" stroke="none">1011</text>
            <text x="3" y="15" fontSize="6" fill="currentColor" stroke="none">0110</text>
            <text x="3" y="21" fontSize="6" fill="currentColor" stroke="none">1001</text>
        </svg>
    )
}

// NASSP — two interlocking gears
function NasspIcon() {
    return (
        <svg {...svgBase} strokeWidth="1.2">
            <g transform="translate(8.5 9)">
                <circle r="4" />
                <circle r="1.5" />
                <path d="M0 -5.5 L0 -4 M0 4 L0 5.5 M-5.5 0 L-4 0 M4 0 L5.5 0 M-3.9 -3.9 L-2.8 -2.8 M2.8 2.8 L3.9 3.9 M-3.9 3.9 L-2.8 2.8 M2.8 -2.8 L3.9 -3.9" />
            </g>
            <g transform="translate(16 16)">
                <circle r="3" />
                <circle r="1.1" />
                <path d="M0 -4.2 L0 -3 M0 3 L0 4.2 M-4.2 0 L-3 0 M3 0 L4.2 0 M-3 -3 L-2.1 -2.1 M2.1 2.1 L3 3 M-3 3 L-2.1 2.1 M2.1 -2.1 L3 -3" />
            </g>
        </svg>
    )
}

// Reentry — capsule tilted 45° falling heat-shield-first, plasma trail
// streaming from the heat-shield edges around and behind the capsule.
function ReentryIcon() {
    return (
        <svg {...svgBase} strokeWidth="1.5">
            <g transform="rotate(-45 12 12)">
                <path d="M10.5 15 L13.5 15 L16 21 Q12 22.3 8 21 Z" />
                <circle cx="12" cy="17.5" r="0.5" fill="currentColor" stroke="none" />
                <path d="M8 21 Q3 17 2 5" />
                <path d="M16 21 Q21 17 22 5" />
                <path d="M9 22 Q6 16 5 3" />
                <path d="M15 22 Q18 16 19 3" />
            </g>
        </svg>
    )
}

// KSP — planet with ascent trajectory and achieved (dashed) circular orbit
function KspIcon() {
    return (
        <svg {...svgBase} strokeWidth="1.5">
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="11" strokeDasharray="1 3" />
            <path d="M8 9 Q12 1 19.8 4.2" />
            <circle cx="19.8" cy="4.2" r="1.2" fill="currentColor" stroke="none" />
        </svg>
    )
}

function iconFor(icon: string) {
    switch (icon) {
        case 'wifi-svg':    return <WifiIcon />
        case 'rocket-svg':  return <RocketIcon />
        case 'yaagc-svg':   return <YaAgcIcon />
        case 'nassp-svg':   return <NasspIcon />
        case 'reentry-svg': return <ReentryIcon />
        case 'ksp-svg':     return <KspIcon />
        default:            return icon
    }
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

    // Auto-scroll the selected card into view
    useEffect(() => {
        if (!isOpen) return
        const el = overlayRef.current?.querySelector('[aria-selected="true"]') as HTMLElement | null
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, [isOpen, menuState?.selectedIndex, menuState?.activeScreen])

    if (!isOpen || !menuState || !serverState) return null

    const activeScreen = menuState.activeScreen
    const selectedIndex = menuState.selectedIndex
    const isSubScreen = activeScreen !== 'main'

    const renderScreen = () => {
        // Card-grid screens: render from menuModel
        if (CARD_GRID_SCREENS.has(activeScreen)) {
            const items = getScreenItems(activeScreen, serverState, menuState)
            const columns = (activeScreen === 'networkInterface' || activeScreen === 'serialSelect') ? 1 : undefined

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
                                icon={iconFor(item.icon)}
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
            case 'bridgeManual':
                return <BridgeManualScreen sendMessage={sendMessage} />
            default:
                return null
        }
    }

    return (
        <div
            ref={overlayRef}
            className={mode === 'screen' ? 'menu-overlay-screen' : undefined}
            style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 5,
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
                <div className="menu-scroll-area" style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    paddingRight: '1.5cqw',
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
