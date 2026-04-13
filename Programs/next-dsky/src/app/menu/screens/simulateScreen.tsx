"use client"

import MenuCard from "../menuCard"
import MenuGrid from "../menuGrid"

interface SimulateScreenProps {
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    sendConfigMessage: (type: string, data?: Record<string, unknown>) => void
    onClose: () => void
}

interface SimulatorDef {
    id: string
    icon: string
    label: string
    needsConfig?: string
}

const SIMULATORS: SimulatorDef[] = [
    { id: 'yaagc',   icon: '\u25B3', label: 'yaAGC',   needsConfig: 'yaagc' },
    { id: 'nassp',   icon: '\u2609', label: 'NASSP' },
    { id: 'reentry', icon: '\u2604', label: 'REENTRY' },
    { id: 'ksp',     icon: '\u2641', label: 'KSP' },
    { id: 'bridge',  icon: '\u21C4', label: 'BRIDGE',  needsConfig: 'bridge' },
]

export default function SimulateScreen({
    selectedIndex,
    onSetSelectedIndex,
    sendConfigMessage,
    onClose,
}: SimulateScreenProps) {

    const handleSelect = (sim: SimulatorDef) => {
        if (sim.needsConfig) {
            sendConfigMessage('config:reset-and-goto', { step: sim.needsConfig })
        } else {
            sendConfigMessage('config:reset-and-select-source', { source: sim.id })
        }
        onClose()
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
