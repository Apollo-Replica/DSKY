"use client"

import { useState, useEffect } from "react"
import QRCode from "qrcode"
import type { ServerState } from "../../../types/serverState"

interface HaSetupScreenProps {
    serverState: ServerState | null
}

export default function HaSetupScreen({ serverState }: HaSetupScreenProps) {
    const configured = serverState?.ha?.configured === true
    const haUrl = serverState?.baseUrl ? `${serverState.baseUrl}/ha` : null

    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

    useEffect(() => {
        if (!haUrl) return
        QRCode.toDataURL(haUrl, {
            width: 256,
            margin: 1,
            color: { dark: '#000', light: '#fff' },
        }).then(setQrDataUrl).catch(() => {})
    }, [haUrl])

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '1.5cqh',
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

            {/* QR code */}
            {qrDataUrl && (
                <div style={{
                    background: '#fff',
                    padding: '1.2cqh',
                    borderRadius: '1cqh',
                    lineHeight: 0,
                }}>
                    <img
                        src={qrDataUrl}
                        alt="QR code for HA configuration"
                        style={{ width: '28cqh', height: '28cqh' }}
                    />
                </div>
            )}

            {/* URL below QR */}
            {haUrl && (
                <div style={{
                    fontSize: '2cqh',
                    color: 'var(--menu-highlight)',
                    fontWeight: 600,
                    wordBreak: 'break-all',
                    maxWidth: '90%',
                }}>
                    {haUrl}
                </div>
            )}

            <div style={{
                fontSize: '2.5cqh',
                color: 'var(--menu-secondary)',
                maxWidth: '85%',
            }}>
                {configured
                    ? <>Scan to reconfigure</>
                    : <>Scan to configure</>
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
