"use client"

import MenuCard from "../menuCard"
import MenuGrid from "../menuGrid"
import type { MenuScreen } from "../useMenuNavigation"

interface AppsScreenProps {
    selectedIndex: number
    onSelect: (screen: MenuScreen) => void
    onSetSelectedIndex: (index: number) => void
}

const CARDS = [
    { id: 'calculator', icon: '\u2211', label: 'CALCULATOR', screen: 'calculator' as MenuScreen },
    { id: 'clock',      icon: '\u25F4', label: 'CLOCK',      screen: 'clock' as MenuScreen },
    { id: 'games',      icon: '\u2B23', label: 'GAMES',      screen: 'games' as MenuScreen },
]

export const APPS_SCREEN_ITEM_COUNT = CARDS.length

export default function AppsScreen({
    selectedIndex,
    onSelect,
    onSetSelectedIndex,
}: AppsScreenProps) {

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
                        onSelect(card.screen)
                    }}
                />
            ))}
        </MenuGrid>
    )
}
