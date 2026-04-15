"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import type { MenuState, MenuScreen } from "./useMenuNavigation"
import type { ServerState } from "../../types/serverState"
import type { DskyState, DskyClient } from "../../types/dsky"
import { SCREEN_AREA } from "./constants"
import MainScreen from "./screens/mainScreen"
import SimulateScreen from "./screens/simulateScreen"
import ConnectScreen from "./screens/connectScreen"
import CommandsScreen from "./screens/commandsScreen"
import SettingsScreen from "./screens/settingsScreen"
import AboutScreen from "./screens/aboutScreen"
import AppsScreen from "./screens/appsScreen"
import CalculatorScreen from "./screens/calculatorScreen"
import ClockScreen from "./screens/clockScreen"
import GamesScreen from "./screens/gamesScreen"
import YaagcVersionScreen from "./screens/yaagcVersionScreen"
import BridgeSelectScreen from "./screens/bridgeSelectScreen"
import SerialSelectScreen from "./screens/serialSelectScreen"
import NetworkInterfaceScreen from "./screens/networkInterfaceScreen"
import HaUrlScreen from "./screens/haUrlScreen"
import HaTokenScreen from "./screens/haTokenScreen"
import HaDiscoverScreen from "./screens/haDiscoverScreen"
import HaEntitiesScreen from "./screens/haEntitiesScreen"
import WifiScreen from "./screens/wifiScreen"

interface MenuOverlayProps {
    menuState: MenuState
    onClose: () => void
    onNavigateTo: (screen: MenuScreen) => void
    onNavigateBack: () => void
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    onMoveSelection: (delta: number, maxItems: number) => void
    serverState: ServerState | null
    clients: DskyClient[]
    wsConnected: boolean
    viewMode: 'screen' | 'full'
    onCycleViewMode: () => void
    sendMessage: (type: string, data?: Record<string, unknown>) => void
    sendKey: (key: string) => void
    dskyState: DskyState
    appKeyHandlerRef: RefObject<((key: string) => void) | null>
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
    serverState,
    clients,
    wsConnected,
    viewMode,
    onCycleViewMode,
    sendMessage,
    sendKey,
    dskyState,
    appKeyHandlerRef,
    mode = 'overlay',
}: MenuOverlayProps) {
    const overlayRef = useRef<HTMLDivElement>(null)

    // HA flow state — lifted here so it persists across screen navigation
    const [haUrl, setHaUrl] = useState('http://')
    const [haToken, setHaToken] = useState('')

    useEffect(() => {
        if (menuState.isOpen) {
            overlayRef.current?.focus()
        }
    }, [menuState.isOpen])

    if (!menuState.isOpen) return null

    const isSubScreen = menuState.activeScreen !== 'main'
    const isAppScreen = menuState.activeScreen === 'calculator'
        || menuState.activeScreen === 'clock'
    const isTextInputScreen = menuState.activeScreen === 'haUrl'
        || menuState.activeScreen === 'haToken'

    const renderScreen = () => {
        switch (menuState.activeScreen) {
            case 'main':
                return (
                    <MainScreen
                        selectedIndex={selectedIndex}
                        onSelect={onNavigateTo}
                        onSetSelectedIndex={onSetSelectedIndex}
                        sendMessage={sendMessage}
                        onClose={onClose}
                    />
                )
            case 'simulate':
                return (
                    <SimulateScreen
                        selectedIndex={selectedIndex}
                        onSetSelectedIndex={onSetSelectedIndex}
                        onNavigateTo={onNavigateTo}
                        sendMessage={sendMessage}
                        onClose={onClose}
                    />
                )
            case 'connect':
                return (
                    <ConnectScreen
                        selectedIndex={selectedIndex}
                        onSetSelectedIndex={onSetSelectedIndex}
                        serverState={serverState}
                        onNavigateTo={onNavigateTo}
                        onClose={onClose}
                    />
                )
            case 'commands':
                return (
                    <CommandsScreen serverState={serverState} />
                )
            case 'settings':
                return (
                    <SettingsScreen
                        selectedIndex={selectedIndex}
                        onSetSelectedIndex={onSetSelectedIndex}
                        onSelect={onNavigateTo}
                        serverState={serverState}
                        sendMessage={sendMessage}
                        viewMode={viewMode}
                        onCycleViewMode={onCycleViewMode}
                        onClose={onClose}
                    />
                )
            case 'about':
                return (
                    <AboutScreen
                        serverState={serverState}
                        wsConnected={wsConnected}
                        clients={clients}
                    />
                )
            case 'apps':
                return (
                    <AppsScreen
                        selectedIndex={selectedIndex}
                        onSelect={onNavigateTo}
                        onSetSelectedIndex={onSetSelectedIndex}
                    />
                )
            case 'calculator':
                return <CalculatorScreen appKeyHandlerRef={appKeyHandlerRef} />
            case 'clock':
                return <ClockScreen appKeyHandlerRef={appKeyHandlerRef} />
            case 'games':
                return <GamesScreen />
            case 'yaagcVersion':
                return (
                    <YaagcVersionScreen
                        selectedIndex={selectedIndex}
                        onSetSelectedIndex={onSetSelectedIndex}
                        sendMessage={sendMessage}
                        onClose={onClose}
                    />
                )
            case 'bridgeSelect':
                return (
                    <BridgeSelectScreen
                        selectedIndex={selectedIndex}
                        onSetSelectedIndex={onSetSelectedIndex}
                        sendMessage={sendMessage}
                        onClose={onClose}
                        serverState={serverState}
                    />
                )
            case 'serialSelect':
                return (
                    <SerialSelectScreen
                        selectedIndex={selectedIndex}
                        onSetSelectedIndex={onSetSelectedIndex}
                        sendMessage={sendMessage}
                        onNavigateBack={onNavigateBack}
                        serverState={serverState}
                    />
                )
            case 'networkInterface':
                return (
                    <NetworkInterfaceScreen
                        selectedIndex={selectedIndex}
                        onSetSelectedIndex={onSetSelectedIndex}
                        sendMessage={sendMessage}
                        onNavigateBack={onNavigateBack}
                        serverState={serverState}
                    />
                )
            case 'haUrl':
                return (
                    <HaUrlScreen
                        onNavigateTo={onNavigateTo}
                        onNavigateBack={onNavigateBack}
                        haUrl={haUrl}
                        onHaUrlChange={setHaUrl}
                        appKeyHandlerRef={appKeyHandlerRef}
                    />
                )
            case 'haToken':
                return (
                    <HaTokenScreen
                        onNavigateBack={onNavigateBack}
                        sendMessage={sendMessage}
                        onNavigateTo={onNavigateTo}
                        haUrl={haUrl}
                        haToken={haToken}
                        onHaTokenChange={setHaToken}
                        appKeyHandlerRef={appKeyHandlerRef}
                    />
                )
            case 'haDiscover':
                return (
                    <HaDiscoverScreen
                        serverState={serverState}
                        onNavigateBack={onNavigateBack}
                        onNavigateTo={onNavigateTo}
                    />
                )
            case 'haEntities':
                return (
                    <HaEntitiesScreen
                        selectedIndex={selectedIndex}
                        onSetSelectedIndex={onSetSelectedIndex}
                        sendMessage={sendMessage}
                        onClose={onClose}
                        onNavigateBack={onNavigateBack}
                        serverState={serverState}
                        haUrl={haUrl}
                        haToken={haToken}
                    />
                )
            case 'wifi':
                return (
                    <WifiScreen
                        serverState={serverState}
                        onNavigateBack={onNavigateBack}
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
                backgroundColor: 'rgba(10, 20, 10, 0.7)',
                backdropFilter: 'blur(0.5cqw)',
                WebkitBackdropFilter: 'blur(0.5cqw)',
                borderRadius: '1.5cqw',
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
                {!isAppScreen && !isTextInputScreen && (
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
                )}
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
