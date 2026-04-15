"use client"

import { useEffect } from "react"
import MenuCard from "../menuCard"
import MenuGrid from "../menuGrid"
import type { ServerState } from "../../../types/serverState"

interface NetworkInterfaceScreenProps {
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    sendMessage: (type: string, data?: Record<string, unknown>) => void
    onNavigateBack: () => void
    serverState: ServerState | null
}

export function getNetworkInterfaceScreenItemCount(serverState: ServerState | null): number {
    // AUTO + available interfaces
    return 1 + (serverState?.network?.available?.length ?? 0)
}

export default function NetworkInterfaceScreen({
    selectedIndex,
    onSetSelectedIndex,
    sendMessage,
    onNavigateBack,
    serverState,
}: NetworkInterfaceScreenProps) {

    useEffect(() => {
        sendMessage('action:list-interfaces')
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const availableInterfaces = serverState?.network?.available ?? []

    interface CardDef {
        id: string
        icon: string
        label: string
        badge?: string
        badgeActive?: boolean
        action: () => void
    }

    const cards: CardDef[] = [
        {
            id: 'auto',
            icon: '\u25CE',
            label: 'AUTO',
            badge: 'DEFAULT',
            badgeActive: serverState?.network?.interface === null,
            action: () => {
                sendMessage('action:set-network-interface', { ip: null })
                onNavigateBack()
            },
        },
        ...availableInterfaces.map((iface) => ({
            id: `iface-${iface.ip}`,
            icon: '\u21C4',
            label: iface.name,
            badge: iface.ip,
            badgeActive: iface.ip === serverState?.network?.interface,
            action: () => {
                sendMessage('action:set-network-interface', { ip: iface.ip })
                onNavigateBack()
            },
        })),
    ]

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
                        card.action()
                    }}
                />
            ))}
        </MenuGrid>
    )
}
