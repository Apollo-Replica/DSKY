"use client"

import MenuCard from "../menuCard"
import MenuGrid from "../menuGrid"
import type { MenuScreen } from "../useMenuNavigation"
import type { ServerState } from "../../../types/serverState"

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

interface SettingsScreenProps {
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    onSelect: (screen: MenuScreen) => void
    serverState: ServerState | null
    sendMessage: (type: string, data?: Record<string, unknown>) => void
    viewMode: 'screen' | 'full'
    onCycleViewMode: () => void
    onClose: () => void
}

export default function SettingsScreen({
    selectedIndex,
    onSetSelectedIndex,
    onSelect,
    serverState,
    sendMessage,
    viewMode,
    onCycleViewMode,
    onClose,
}: SettingsScreenProps) {

    const wifiAvailable = serverState?.wifi?.available === true
    const wifiBusy = serverState?.wifi?.running === true
    const shutdownAvailable = serverState?.shutdown === true
    const hasMultipleInterfaces = (serverState?.network?.available?.length ?? 0) > 1

    const cards = [
        {
            id: 'serial',
            icon: '\u2B80',
            label: 'SERIAL',
            badge: serverState?.serial?.port || 'None',
            badgeActive: !!serverState?.serial?.port,
        },
        {
            id: 'display',
            icon: '\u25A3',
            label: 'DISPLAY',
            badge: viewMode.toUpperCase(),
            badgeActive: viewMode === 'full',
        },
        ...(hasMultipleInterfaces ? [{
            id: 'network',
            icon: '\u25CE',
            label: 'NETWORK',
            badge: serverState?.network?.interface || 'Auto',
            badgeActive: !!serverState?.network?.interface,
        }] : []),
        ...(wifiAvailable ? [{
            id: 'wifi',
            icon: <WifiIcon />,
            label: 'WIFI',
            badge: wifiBusy ? 'RUNNING' : undefined,
            badgeActive: wifiBusy,
        }] : []),
        ...(shutdownAvailable ? [{
            id: 'shutdown',
            icon: '\u23FB',
            label: 'SHUTDOWN',
        }] : []),
        {
            id: 'about',
            icon: '\u24D8',
            label: 'ABOUT',
        },
    ]

    const handleCardClick = (id: string) => {
        if (id === 'serial') {
            onSelect('serialSelect')
        } else if (id === 'display') {
            onCycleViewMode()
        } else if (id === 'network') {
            onSelect('networkInterface')
        } else if (id === 'wifi') {
            if (!wifiBusy) {
                sendMessage('action:wifi-connect')
            }
            onSelect('wifi')
        } else if (id === 'shutdown') {
            sendMessage('action:shutdown')
        } else if (id === 'about') {
            onSelect('about')
        }
    }

    return (
        <MenuGrid>
            {cards.map((card, i) => (
                <MenuCard
                    key={card.id}
                    index={i + 1}
                    icon={card.icon}
                    label={card.label}
                    badge={card.badge}
                    badgeActive={card.badgeActive}
                    selected={selectedIndex === i}
                    onClick={() => {
                        onSetSelectedIndex(i)
                        handleCardClick(card.id)
                    }}
                />
            ))}
        </MenuGrid>
    )
}

export function getSettingsScreenItemCount(serverState?: ServerState | null): number {
    let count = 3 // serial, display, about (always present)
    if (serverState?.wifi?.available) count++
    if (serverState?.shutdown) count++
    if ((serverState?.network?.available?.length ?? 0) > 1) count++
    return count
}
