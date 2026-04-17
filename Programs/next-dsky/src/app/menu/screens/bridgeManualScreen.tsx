"use client"

import { useEffect, useRef, useState } from "react"

interface BridgeManualScreenProps {
    sendMessage: (type: string, data?: Record<string, unknown>) => void
}

export default function BridgeManualScreen({ sendMessage }: BridgeManualScreenProps) {
    const [url, setUrl] = useState("wss://")
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const el = inputRef.current
        if (!el) return
        el.focus()
        const len = el.value.length
        el.setSelectionRange(len, len)
    }, [])

    const canSubmit = /^wss?:\/\/.+/i.test(url.trim())

    const submit = () => {
        const value = url.trim()
        if (!/^wss?:\/\/.+/i.test(value)) return
        sendMessage('action:switch-app', { app: 'bridge', bridgeUrl: value })
        sendMessage('action:menu-close')
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '2.5cqh',
                textAlign: 'center',
                fontFamily: 'monospace',
            }}
            onKeyDownCapture={(e) => {
                // Prevent DSKY key routing from hijacking typing while the input is focused.
                e.stopPropagation()
                if (e.key === 'Enter' && canSubmit) {
                    e.preventDefault()
                    submit()
                }
            }}
        >
            <div style={{
                fontSize: '3.5cqh',
                color: 'var(--menu-primary)',
                fontWeight: 700,
            }}>
                Bridge URL
            </div>

            <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="wss://host:port/path"
                style={{
                    width: '85%',
                    padding: '1.5cqh 2cqw',
                    background: 'rgba(10, 20, 10, 0.85)',
                    border: '1px solid var(--menu-border)',
                    borderRadius: '1cqh',
                    color: 'var(--menu-primary)',
                    fontFamily: 'monospace',
                    fontSize: '2.8cqh',
                    outline: 'none',
                    caretColor: 'var(--menu-primary)',
                }}
            />

            <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                style={{
                    padding: '1.4cqh 4cqw',
                    background: canSubmit ? 'rgba(74, 222, 128, 0.2)' : 'rgba(74, 222, 128, 0.08)',
                    border: '1px solid var(--menu-primary)',
                    borderRadius: '1cqh',
                    color: canSubmit ? 'var(--menu-highlight)' : 'var(--menu-secondary)',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '2.8cqh',
                    letterSpacing: '0.3cqh',
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    textTransform: 'uppercase',
                }}
            >
                Connect
            </button>

            <div style={{
                fontSize: '2.2cqh',
                color: 'var(--menu-secondary)',
                maxWidth: '85%',
            }}>
                Enter a bridge WebSocket URL and press Connect.
            </div>
        </div>
    )
}
