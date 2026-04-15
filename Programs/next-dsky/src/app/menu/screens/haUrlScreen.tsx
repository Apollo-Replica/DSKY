"use client"

import { useEffect, type RefObject } from "react"
import type { MenuScreen } from "../useMenuNavigation"

interface HaUrlScreenProps {
    onNavigateTo: (screen: MenuScreen) => void
    onNavigateBack: () => void
    haUrl: string
    onHaUrlChange: (url: string) => void
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

export const HA_URL_SCREEN_ITEM_COUNT = 0

export default function HaUrlScreen({
    onNavigateTo,
    onNavigateBack,
    haUrl,
    onHaUrlChange,
    appKeyHandlerRef,
}: HaUrlScreenProps) {
    // Capture all keys so menu card navigation is bypassed
    useEffect(() => {
        appKeyHandlerRef.current = () => {}
        return () => { appKeyHandlerRef.current = null }
    }, [appKeyHandlerRef])

    const isValid = haUrl.startsWith('http://') || haUrl.startsWith('https://')

    return (
        <div style={{
            fontFamily: 'Gorton, "Arial Narrow", sans-serif',
            color: 'var(--menu-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(4px, 1cqh, 8px)',
        }}>
            <div style={labelStyle}>Home Assistant URL:</div>
            <input
                type="text"
                value={haUrl}
                onChange={(e) => onHaUrlChange(e.target.value)}
                placeholder="http://homeassistant.local:8123"
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
                    onClick={() => onNavigateTo('haToken')}
                    disabled={!isValid}
                >
                    Next
                </button>
            </div>
        </div>
    )
}
