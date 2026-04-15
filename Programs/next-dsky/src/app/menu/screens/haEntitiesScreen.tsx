"use client"

import { useState, useEffect, useCallback } from "react"
import type { ServerState, DiscoveredEntity } from "../../../types/serverState"

interface HaEntitiesScreenProps {
    selectedIndex: number
    onSetSelectedIndex: (index: number) => void
    sendMessage: (type: string, data?: Record<string, unknown>) => void
    onClose: () => void
    onNavigateBack: () => void
    serverState: ServerState | null
    haUrl: string
    haToken: string
}

const optionStyle = (selected: boolean): React.CSSProperties => ({
    padding: 'clamp(3px, 0.8cqh, 6px) clamp(4px, 1cqw, 8px)',
    background: selected ? 'rgba(74, 222, 128, 0.2)' : 'rgba(10, 20, 10, 0.6)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: selected ? 'var(--menu-primary)' : 'var(--menu-border)',
    borderRadius: 3,
    color: selected ? 'var(--menu-highlight)' : 'var(--menu-primary)',
    cursor: 'pointer',
    fontSize: 'clamp(6px, 2cqh, 10px)',
    textAlign: 'left' as const,
    display: 'block',
    width: '100%',
    fontFamily: 'Gorton, "Arial Narrow", sans-serif',
    boxShadow: selected ? '0 0 8px rgba(74, 222, 128, 0.2)' : 'none',
})

const btnStyle = (primary: boolean): React.CSSProperties => ({
    padding: 'clamp(3px, 0.8cqh, 6px) clamp(6px, 2cqw, 12px)',
    background: primary ? 'rgba(74, 222, 128, 0.2)' : 'rgba(30, 30, 30, 0.8)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: primary ? 'var(--menu-primary)' : '#333',
    borderRadius: 3,
    color: primary ? 'var(--menu-primary)' : '#888',
    cursor: 'pointer',
    fontFamily: 'Gorton, "Arial Narrow", sans-serif',
    fontSize: 'clamp(6px, 2cqh, 10px)',
})

export function getHaEntitiesScreenItemCount(serverState: ServerState | null): number {
    // select-all + entities + done
    return (serverState?.ha?.entities?.length ?? 0) + 2
}

export default function HaEntitiesScreen({
    selectedIndex,
    onSetSelectedIndex,
    sendMessage,
    onClose,
    onNavigateBack,
    serverState,
    haUrl,
    haToken,
}: HaEntitiesScreenProps) {
    const entities: DiscoveredEntity[] = serverState?.ha?.entities ?? []

    const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(
        () => serverState?.ha?.selectedIds ?? entities.map(e => e.entity_id)
    )

    // Sync from server when it changes
    useEffect(() => {
        if (serverState?.ha?.selectedIds) {
            setLocalSelectedIds(serverState.ha.selectedIds)
        }
    }, [serverState?.ha?.selectedIds])

    const allSelected = entities.length > 0 && entities.every(e => localSelectedIds.includes(e.entity_id))

    const toggleSelectAll = useCallback(() => {
        if (allSelected) {
            setLocalSelectedIds([])
        } else {
            setLocalSelectedIds(entities.map(e => e.entity_id))
        }
    }, [allSelected, entities])

    const toggleEntity = useCallback((entityId: string) => {
        setLocalSelectedIds(prev =>
            prev.includes(entityId)
                ? prev.filter(id => id !== entityId)
                : [...prev, entityId]
        )
    }, [])

    const handleDone = () => {
        sendMessage('action:switch-app', {
            app: 'homeassistant',
            haUrl,
            haToken,
            haEntities: serverState?.ha?.entities,
            haSelectedEntityIds: localSelectedIds,
        })
        onClose()
    }

    // Items: 0 = select-all, 1..N = entities, N+1 = done
    const totalItems = entities.length + 2
    const doneIndex = totalItems - 1

    return (
        <div style={{
            fontFamily: 'Gorton, "Arial Narrow", sans-serif',
            color: 'var(--menu-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(2px, 0.5cqh, 4px)',
        }}>
            {/* Select all / Deselect all toggle */}
            <button
                style={optionStyle(selectedIndex === 0)}
                onClick={() => {
                    onSetSelectedIndex(0)
                    toggleSelectAll()
                }}
            >
                {allSelected ? '\u2611' : '\u2610'} {allSelected ? 'Deselect all' : 'Select all'}
            </button>

            {/* Entity list */}
            {entities.map((entity, i) => {
                const isEntitySelected = localSelectedIds.includes(entity.entity_id)
                const itemIndex = i + 1
                return (
                    <button
                        key={entity.entity_id}
                        style={optionStyle(selectedIndex === itemIndex)}
                        onClick={() => {
                            onSetSelectedIndex(itemIndex)
                            toggleEntity(entity.entity_id)
                        }}
                    >
                        {isEntitySelected ? '\u2611' : '\u2610'} {entity.friendly_name}{' '}
                        <span style={{ color: 'var(--menu-secondary)', fontSize: 'clamp(5px, 1.6cqh, 8px)' }}>
                            ({entity.domain})
                        </span>
                    </button>
                )
            })}

            {/* Done button */}
            <div style={{ display: 'flex', gap: 'clamp(4px, 1cqw, 8px)', marginTop: 'clamp(2px, 0.5cqh, 4px)' }}>
                <button style={btnStyle(false)} onClick={onNavigateBack}>
                    Back
                </button>
                <button
                    style={{
                        ...btnStyle(true),
                        ...(selectedIndex === doneIndex ? {
                            boxShadow: '0 0 8px rgba(74, 222, 128, 0.2)',
                        } : {}),
                    }}
                    onClick={handleDone}
                >
                    Done
                </button>
            </div>
        </div>
    )
}
