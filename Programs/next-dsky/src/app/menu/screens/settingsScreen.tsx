"use client"

import MenuCard from "../menuCard"
import MenuGrid from "../menuGrid"
import type { MenuScreen } from "../useMenuNavigation"
import type { ConfigState } from "../../../types/config"

interface SettingsScreenProps {
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    onSelect: (screen: MenuScreen) => void
    configState: ConfigState | null
    sendConfigMessage: (type: string, data?: Record<string, unknown>) => void
    viewMode: 'screen' | 'full'
    onCycleViewMode: () => void
    onClose: () => void
}

export default function SettingsScreen({
    selectedIndex,
    onSetSelectedIndex,
    onSelect,
    configState,
    sendConfigMessage,
    viewMode,
    onCycleViewMode,
    onClose,
}: SettingsScreenProps) {

    const cards = [
        {
            id: 'serial',
            icon: '\u2B80',
            label: 'SERIAL',
            badge: configState?.serialPort || 'None',
            badgeActive: !!configState?.serialPort,
        },
        {
            id: 'display',
            icon: '\u25A3',
            label: 'DISPLAY',
            badge: viewMode.toUpperCase(),
            badgeActive: viewMode === 'full',
        },
        {
            id: 'about',
            icon: '\u24D8',
            label: 'ABOUT',
        },
    ]

    const handleCardClick = (id: string) => {
        if (id === 'serial') {
            sendConfigMessage('config:goto', { step: 'serial' })
            onClose()
        } else if (id === 'display') {
            onCycleViewMode()
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

export function getSettingsScreenItemCount(): number {
    return 3
}
