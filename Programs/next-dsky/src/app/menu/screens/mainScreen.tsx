"use client"

import MenuCard from "../menuCard"
import MenuGrid from "../menuGrid"
import type { MenuScreen } from "../useMenuNavigation"
import type { ConfigState } from "../../../types/config"

interface MainScreenProps {
    selectedIndex: number
    onSelect: (screen: MenuScreen) => void
    onSetSelectedIndex: (index: number) => void
    configState: ConfigState | null
    sendConfigMessage: (type: string, data?: Record<string, unknown>) => void
    onClose: () => void
}

interface CardDef {
    id: string
    icon: string
    label: string
    screen?: MenuScreen
    action?: string
}

const CARDS: CardDef[] = [
    { id: 'simulate', icon: '\u25C7', label: 'SIMULATE', screen: 'simulate' },
    { id: 'connect',  icon: '\u25CE', label: 'HOME ASST', screen: 'connect' },
    { id: 'apps',     icon: '\u25A6', label: 'APPS',     screen: 'apps' },
    { id: 'commands', icon: '\u2630', label: 'COMMANDS', screen: 'commands' },
    { id: 'random',   icon: '\u2684', label: 'RANDOM',   action: 'random' },
    { id: 'settings', icon: '\u2699', label: 'SETTINGS', screen: 'settings' },
]

export const MAIN_SCREEN_ITEM_COUNT = CARDS.length

export default function MainScreen({
    selectedIndex,
    onSelect,
    onSetSelectedIndex,
    configState,
    sendConfigMessage,
    onClose,
}: MainScreenProps) {

    const handleCardClick = (card: typeof CARDS[number]) => {
        if (card.screen) {
            onSelect(card.screen)
        } else if (card.action === 'random') {
            sendConfigMessage('config:reset-and-select-source', { source: 'random' })
            onClose()
        }
    }

    return (
        <MenuGrid>
            {CARDS.map((card, i) => (
                <MenuCard
                    key={card.id}
                    index={i + 1}
                    icon={card.icon}
                    label={card.label}
                    selected={selectedIndex === i}
                    onClick={() => {
                        onSetSelectedIndex(i)
                        handleCardClick(card)
                    }}
                />
            ))}
        </MenuGrid>
    )
}
