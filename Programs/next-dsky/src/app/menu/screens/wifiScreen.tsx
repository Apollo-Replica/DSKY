"use client"

import type { ServerState } from "../../../types/serverState"

interface WifiScreenProps {
    serverState: ServerState | null
}

export default function WifiScreen({ serverState }: WifiScreenProps) {
    const running = serverState?.wifi?.running === true

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
                WiFi Setup
            </div>

            <div style={{
                background: '#fff',
                padding: '1.5cqh',
                borderRadius: '1cqh',
                lineHeight: 0,
            }}>
                <img
                    src="/wifi-qr.png"
                    alt="WiFi QR for DSKY Replica"
                    style={{ width: '28cqh', height: '28cqh' }}
                />
            </div>

            <div style={{
                fontSize: '2.8cqh',
                color: 'var(--menu-secondary)',
                maxWidth: '80%',
            }}>
                Scan or connect to <span style={{ color: 'var(--menu-primary)', fontWeight: 600 }}>DSKY Replica</span>
            </div>

            <div style={{
                fontSize: '2.2cqh',
                color: 'var(--menu-accent)',
            }}>
                {running ? 'Waiting for wifi-connect\u2026' : 'Done'}
            </div>
        </div>
    )
}
