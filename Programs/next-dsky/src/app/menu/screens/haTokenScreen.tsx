"use client"

import { useEffect, type RefObject } from "react"
import type { MenuScreen } from "../useMenuNavigation"

interface HaTokenScreenProps {
    onNavigateBack: () => void
    sendMessage: (type: string, data?: Record<string, unknown>) => void
    onNavigateTo: (screen: MenuScreen) => void
    haUrl: string
    haToken: string
    onHaTokenChange: (token: string) => void
    appKeyHandlerRef: RefObject<((key: string) => void) | null>
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'clamp(4px, 1cqh, 8px)',
    background: 'rgba(10, 20, 10, 0.8)',
    color: 'var(--menu-primary)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--menu-border)',
    borderRadius: 3,
    fontFamily: 'Gorton, "Arial Narrow", sans-serif',
    fontSize: 'clamp(7px, 2.5cqh, 12px)',
    outline: 'none',
    boxSizing: 'border-box' as const,
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

const labelStyle: React.CSSProperties = {
    color: 'var(--menu-secondary)',
    fontSize: 'clamp(6px, 2cqh, 10px)',
    fontFamily: 'Gorton, "Arial Narrow", sans-serif',
    marginBottom: 'clamp(2px, 0.5cqh, 4px)',
}

export const HA_TOKEN_SCREEN_ITEM_COUNT = 0

export default function HaTokenScreen({
    onNavigateBack,
    sendMessage,
    onNavigateTo,
    haUrl,
    haToken,
    onHaTokenChange,
    appKeyHandlerRef,
}: HaTokenScreenProps) {
    // Capture all keys so menu card navigation is bypassed
    useEffect(() => {
        appKeyHandlerRef.current = () => {}
        return () => { appKeyHandlerRef.current = null }
    }, [appKeyHandlerRef])

    const isValid = haToken.trim().length > 0

    const handleDiscover = () => {
        sendMessage('action:discover-ha', { url: haUrl, token: haToken })
        onNavigateTo('haDiscover')
    }

    return (
        <div style={{
            fontFamily: 'Gorton, "Arial Narrow", sans-serif',
            color: 'var(--menu-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(4px, 1cqh, 8px)',
        }}>
            <div style={labelStyle}>Long-Lived Access Token:</div>
            <input
                type="text"
                value={haToken}
                onChange={(e) => onHaTokenChange(e.target.value)}
                placeholder="Paste token here"
                autoFocus
                style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 'clamp(4px, 1cqw, 8px)', marginTop: 'clamp(2px, 0.5cqh, 4px)' }}>
                <button style={btnStyle(false)} onClick={onNavigateBack}>
                    Back
                </button>
                <button
                    style={{
                        ...btnStyle(true),
                        opacity: isValid ? 1 : 0.4,
                        pointerEvents: isValid ? 'auto' : 'none',
                    }}
                    onClick={handleDiscover}
                    disabled={!isValid}
                >
                    Discover
                </button>
            </div>
        </div>
    )
}
