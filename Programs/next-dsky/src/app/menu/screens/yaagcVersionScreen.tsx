"use client"

import MenuCard from "../menuCard"
import MenuGrid from "../menuGrid"
import { YAAGC_VERSIONS } from "./sourceConstants"

interface YaagcVersionScreenProps {
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    sendMessage: (type: string, data?: Record<string, unknown>) => void
    onClose: () => void
}

const VERSION_ICONS: Record<string, string> = {
    Comanche055: '\u25B3',
    Luminary099: '\u25C7',
    Luminary210: '\u25C8',
    own:         '\u25B7',
}

export default function YaagcVersionScreen({
    selectedIndex,
    onSetSelectedIndex,
    sendMessage,
    onClose,
}: YaagcVersionScreenProps) {

    const handleSelect = (value: string) => {
        sendMessage('action:switch-app', { app: 'yaagc', yaagcVersion: value })
        onClose()
    }

    return (
        <MenuGrid>
            {YAAGC_VERSIONS.map((version, i) => (
                <MenuCard
                    key={version.value}
                    index={i + 1}
                    icon={VERSION_ICONS[version.value] ?? '\u25B3'}
                    label={version.name}
                    selected={selectedIndex === i}
                    onClick={() => {
                        onSetSelectedIndex(i)
                        handleSelect(version.value)
                    }}
                />
            ))}
        </MenuGrid>
    )
}

export const YAAGC_VERSION_SCREEN_ITEM_COUNT = YAAGC_VERSIONS.length
