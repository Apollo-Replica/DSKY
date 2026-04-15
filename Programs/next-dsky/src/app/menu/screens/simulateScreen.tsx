"use client"

import MenuCard from "../menuCard"
import MenuGrid from "../menuGrid"
import type { MenuScreen } from "../useMenuNavigation"

interface SimulateScreenProps {
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    onNavigateTo: (screen: MenuScreen) => void
    sendMessage: (type: string, data?: Record<string, unknown>) => void
    onClose: () => void
}

interface SimulatorDef {
    id: string
    icon: string
    label: string
    configScreen?: MenuScreen
}

const SIMULATORS: SimulatorDef[] = [
    { id: 'yaagc',   icon: '\u25B3', label: 'yaAGC',   configScreen: 'yaagcVersion' },
    { id: 'nassp',   icon: '\u2609', label: 'NASSP' },
    { id: 'reentry', icon: '\u2604', label: 'REENTRY' },
    { id: 'ksp',     icon: '\u2641', label: 'KSP' },
    { id: 'bridge',  icon: '\u21C4', label: 'BRIDGE',  configScreen: 'bridgeSelect' },
]

export default function SimulateScreen({
    selectedIndex,
    onSetSelectedIndex,
    onNavigateTo,
    sendMessage,
    onClose,
}: SimulateScreenProps) {

    const handleSelect = (sim: SimulatorDef) => {
        if (sim.configScreen) {
            onNavigateTo(sim.configScreen)
        } else {
            sendMessage('action:switch-app', { app: sim.id })
            onClose()
        }
    }

    return (
        <MenuGrid>
            {SIMULATORS.map((sim, i) => (
                <MenuCard
                    key={sim.id}
                    index={i + 1}
                    icon={sim.icon}
                    label={sim.label}
                    selected={selectedIndex === i}
                    onClick={() => {
                        onSetSelectedIndex(i)
                        handleSelect(sim)
                    }}
                />
            ))}
        </MenuGrid>
    )
}

export const SIMULATE_SCREEN_ITEM_COUNT = SIMULATORS.length
