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

// Recolor every menu PNG to the DSKY primary green so logos from different
// sources stay visually unified, regardless of their original hue.
const pngIconStyle = {
    width: '1em',
    height: '1em',
    objectFit: 'contain' as const,
    display: 'block',
    filter: 'brightness(0) saturate(100%) invert(78%) sepia(40%) saturate(470%) hue-rotate(85deg) brightness(95%) contrast(88%)',
}

const MENU_LOGO_FILES: Record<string, string> = {
    'rocket-svg':   'saturnV.png',
    'yaagc-svg':    'YaAGC.png',
    'nassp-svg':    'NASSP.png',
    'reentry-svg':  'rentry.png',
    'ksp-svg':      'ksp.png',
    'ha-svg':       'ha.png',
    'settings-svg': 'settings.png',
    'apps-svg':     'apps.png',
    'commands-svg': 'command.png',
}

function iconFor(icon: string) {
    if (icon === 'wifi-svg') return <WifiIcon />
    const file = MENU_LOGO_FILES[icon]
    if (file) {
        // Plain <img> is intentional: these are 1em decorative icons styled
        // with CSS filter; next/image would add complexity without gains.
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={`/menu-logos/${file}`} alt="" style={pngIconStyle} draggable={false} />
    }
    return icon
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
