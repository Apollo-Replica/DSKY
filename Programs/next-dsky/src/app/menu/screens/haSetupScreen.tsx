"use client"

import { useState, useEffect } from "react"
import type { ServerState } from "../../../types/serverState"

interface HaSetupScreenProps {
    serverState: ServerState | null
}

export default function HaSetupScreen({ serverState }: HaSetupScreenProps) {
    const configured = serverState?.ha?.configured === true

    // Build the HA config URL from the current host
    const [haUrl, setHaUrl] = useState('')
    useEffect(() => {
        setHaUrl(`${window.location.origin}/ha`)
    }, [])

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '2cqh',
            textAlign: 'center',
            fontFamily: 'monospace',
        }}>
            <div style={{
                fontSize: '3.5cqh',
                color: 'var(--menu-primary)',
                fontWeight: 700,
            }}>
                Home Assistant
            </div>

            {/* URL display — user navigates here on their phone */}
            <div style={{
                padding: '2cqh 3cqw',
                background: 'rgba(74, 222, 128, 0.08)',
                border: '1px solid var(--menu-border)',
                borderRadius: '1cqh',
                fontSize: '2.8cqh',
                color: 'var(--menu-highlight)',
                fontWeight: 600,
                wordBreak: 'break-all',
                maxWidth: '90%',
            }}>
                {haUrl || '\u2026'}
            </div>

            <div style={{
                fontSize: '2.8cqh',
                color: 'var(--menu-secondary)',
                maxWidth: '80%',
            }}>
                {configured
                    ? <>Visit this URL to reconfigure <span style={{ color: 'var(--menu-primary)', fontWeight: 600 }}>Home Assistant</span></>
                    : <>Open this URL on your phone to configure <span style={{ color: 'var(--menu-primary)', fontWeight: 600 }}>Home Assistant</span></>
                }
            </div>

            <div style={{
                fontSize: '2.2cqh',
                color: 'var(--menu-accent)',
            }}>
                {configured ? 'Connected' : 'Waiting for configuration\u2026'}
            </div>
        </div>
    )
}
