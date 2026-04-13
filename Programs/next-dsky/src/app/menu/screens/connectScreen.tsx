"use client"

import MenuCard from "../menuCard"
import MenuGrid from "../menuGrid"
import type { ConfigState } from "../../../types/config"

interface ConnectScreenProps {
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    configState: ConfigState | null
    sendConfigMessage: (type: string, data?: Record<string, unknown>) => void
    onClose: () => void
}

export default function ConnectScreen({
    selectedIndex,
    onSetSelectedIndex,
    configState,
    sendConfigMessage,
    onClose,
}: ConnectScreenProps) {

    const isConnected = configState?.inputSource === 'homeassistant'

    const handleSetup = () => {
        sendConfigMessage('config:reset-and-goto', { step: 'haSetup' })
        onClose()
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

export function getConnectScreenItemCount(configState: ConfigState | null): number {
    return configState?.inputSource === 'homeassistant' ? 2 : 1
}
