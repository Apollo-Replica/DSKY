"use client"

import { useEffect } from "react"
import MenuCard from "../menuCard"
import MenuGrid from "../menuGrid"
import type { ServerState } from "../../../types/serverState"

interface SerialSelectScreenProps {
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    sendMessage: (type: string, data?: Record<string, unknown>) => void
    onNavigateBack: () => void
    serverState: ServerState | null
}

export default function SerialSelectScreen({
    selectedIndex,
    onSetSelectedIndex,
    sendMessage,
    onNavigateBack,
    serverState,
}: SerialSelectScreenProps) {

    useEffect(() => {
        sendMessage('action:list-ports')
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const availablePorts = serverState?.serial?.available ?? []

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
            id: 'none',
            icon: '\u2298',
            label: 'NO SERIAL',
            action: () => {
                sendMessage('action:set-serial', { port: null })
                onNavigateBack()
            },
        },
        ...availablePorts.map((p) => ({
            id: `port-${p.path}`,
            icon: '\u21C4',
            label: p.name,
            badge: p.path === serverState?.serial?.port ? 'ACTIVE' : undefined,
            badgeActive: p.path === serverState?.serial?.port ? true : undefined,
            action: () => {
                sendMessage('action:set-serial', { port: p.path })
                onNavigateBack()
            },
        })),
        {
            id: 'refresh',
            icon: '\u21BB',
            label: 'REFRESH',
            action: () => {
                sendMessage('action:list-ports')
            },
        },
    ]

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
                        card.action()
                    }}
                />
            ))}
        </MenuGrid>
    )
}

export function getSerialSelectScreenItemCount(serverState: ServerState | null): number {
    const portsCount = serverState?.serial?.available?.length ?? 0
    // NO SERIAL + available ports + REFRESH
    return 1 + portsCount + 1
}
