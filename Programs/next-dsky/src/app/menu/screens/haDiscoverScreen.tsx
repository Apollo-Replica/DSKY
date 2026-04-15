"use client"

import { useEffect } from "react"
import type { ServerState } from "../../../types/serverState"
import type { MenuScreen } from "../useMenuNavigation"

interface HaDiscoverScreenProps {
    serverState: ServerState | null
    onNavigateBack: () => void
    onNavigateTo: (screen: MenuScreen) => void
}

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

export const HA_DISCOVER_SCREEN_ITEM_COUNT = 0

export default function HaDiscoverScreen({
    serverState,
    onNavigateBack,
    onNavigateTo,
}: HaDiscoverScreenProps) {
    // Auto-navigate to entities screen once discovery succeeds
    useEffect(() => {
        if (serverState?.ha?.entities && serverState.ha.entities.length > 0) {
            onNavigateTo('haEntities')
        }
    }, [serverState?.ha?.entities, onNavigateTo])

    const error = serverState?.ha?.error

    return (
        <div style={{
            fontFamily: 'Gorton, "Arial Narrow", sans-serif',
            color: 'var(--menu-primary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(4px, 1cqh, 8px)',
            minHeight: '20cqh',
        }}>
            {error ? (
                <>
                    <div style={{
                        color: '#ef4444',
                        fontSize: 'clamp(7px, 2.5cqh, 12px)',
                        fontFamily: 'Gorton, "Arial Narrow", sans-serif',
                        textAlign: 'center',
                        wordBreak: 'break-word',
                    }}>
                        {error}
                    </div>
                    <button style={btnStyle(false)} onClick={onNavigateBack}>
                        Back
                    </button>
                </>
            ) : (
                <div style={{
                    color: 'var(--menu-accent)',
                    fontSize: 'clamp(8px, 3cqh, 14px)',
                    fontFamily: 'Gorton, "Arial Narrow", sans-serif',
                    letterSpacing: 1,
                }}>
                    Discovering...
                </div>
            )}
        </div>
    )
}
