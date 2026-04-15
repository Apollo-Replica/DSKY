"use client"

import MenuCard from "../menuCard"
import MenuGrid from "../menuGrid"
import type { ServerState } from "../../../types/serverState"

interface BridgeSelectScreenProps {
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    sendMessage: (type: string, data?: Record<string, unknown>) => void
    onClose: () => void
    serverState: ServerState | null
}

export default function BridgeSelectScreen({
    selectedIndex,
    onSetSelectedIndex,
    sendMessage,
    onClose,
    serverState,
}: BridgeSelectScreenProps) {

    const discoveredApis = serverState?.bridge?.discovered ?? []

    interface CardDef {
        id: string
        icon: string
        label: string
        action: () => void
    }

    const cards: CardDef[] = [
        {
            id: 'public',
            icon: '\u2295',
            label: 'PUBLIC',
            action: () => {
                sendMessage('action:switch-app', { app: 'bridge', bridgeUrl: 'wss://dsky.ortizma.com/ws' })
                onClose()
            },
        },
        ...discoveredApis.map((api) => ({
            id: `api-${api.ip}:${api.port}`,
            icon: '\u21C4',
            label: api.name ?? api.ip,
            action: () => {
                sendMessage('action:switch-app', { app: 'bridge', bridgeUrl: api.url })
                onClose()
            },
        })),
        {
            id: 'rescan',
            icon: '\u21BB',
            label: 'RESCAN',
            action: () => {
                sendMessage('action:scan-bridges')
            },
        },
        {
            id: 'manual',
            icon: '\u270E',
            label: 'MANUAL URL',
            action: () => {
                sendMessage('action:switch-app', { app: 'bridge', bridgeUrl: 'wss://' })
                onClose()
            },
        },
    ]

    return (
        <>
            {serverState?.bridge?.scanning && (
                <div style={{
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontSize: '2.8cqh',
                    color: 'var(--menu-accent)',
                    marginBottom: '1.5cqh',
                }}>
                    Discovering...
                </div>
            )}
            <MenuGrid>
                {cards.map((card, i) => (
                    <MenuCard
                        key={card.id}
                        index={i + 1}
                        icon={card.icon}
                        label={card.label}
                        selected={selectedIndex === i}
                        onClick={() => {
                            onSetSelectedIndex(i)
                            card.action()
                        }}
                    />
                ))}
            </MenuGrid>
        </>
    )
}

export function getBridgeSelectScreenItemCount(serverState: ServerState | null): number {
    const discoveredCount = serverState?.bridge?.discovered?.length ?? 0
    // PUBLIC + discovered APIs + RESCAN + MANUAL URL
    return 1 + discoveredCount + 1 + 1
}
