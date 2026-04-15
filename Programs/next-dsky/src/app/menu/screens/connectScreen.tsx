"use client"

import MenuCard from "../menuCard"
import MenuGrid from "../menuGrid"
import type { ServerState } from "../../../types/serverState"
import type { MenuScreen } from "../useMenuNavigation"

interface ConnectScreenProps {
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    serverState: ServerState | null
    onNavigateTo: (screen: MenuScreen) => void
    onClose: () => void
}

export default function ConnectScreen({
    selectedIndex,
    onSetSelectedIndex,
    serverState,
    onNavigateTo,
    onClose,
}: ConnectScreenProps) {

    const isConnected = serverState?.app?.id === 'homeassistant'

    const handleSetup = () => {
        onNavigateTo('haUrl')
    }

    const cards = isConnected
        ? [
            { id: 'status',      icon: '\u25CF', label: 'CONNECTED',   badge: 'ACTIVE', badgeActive: true },
            { id: 'reconfigure', icon: '\u21BA', label: 'RECONFIGURE' },
        ]
        : [
            { id: 'setup', icon: '\u25CE', label: 'SETUP' },
        ]

    const handleCardClick = (id: string) => {
        if (id === 'setup' || id === 'reconfigure') {
            handleSetup()
        }
    }

    return (
        <MenuGrid columns={1}>
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

export function getConnectScreenItemCount(serverState: ServerState | null): number {
    return serverState?.app?.id === 'homeassistant' ? 2 : 1
}
