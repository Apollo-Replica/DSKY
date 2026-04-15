"use client"

import type { ServerState } from "../../../types/serverState"
import type { DskyClient } from "../../../types/dsky"
import { panelStyle, sectionStyle, titleStyle, rowStyle, keyStyle, valueStyle } from "../panelStyles"

interface AboutScreenProps {
    serverState: ServerState | null
    wsConnected: boolean
    clients: DskyClient[]
}

export default function AboutScreen({ serverState, wsConnected, clients }: AboutScreenProps) {
    const connectedClients = clients?.length || 0

    return (
        <div style={panelStyle}>
            <div style={sectionStyle}>
                <div style={titleStyle}>Connection</div>
                <div style={rowStyle}>
                    <span style={keyStyle}>Status</span>
                    <span style={valueStyle}>
                        {wsConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
                <div style={rowStyle}>
                    <span style={keyStyle}>Clients</span>
                    <span style={valueStyle}>{connectedClients}</span>
                </div>
            </div>

            <div style={sectionStyle}>
                <div style={titleStyle}>Configuration</div>
                <div style={rowStyle}>
                    <span style={keyStyle}>App</span>
                    <span style={valueStyle}>
                        {serverState?.app?.id || 'Idle'}
                    </span>
                </div>
                <div style={rowStyle}>
                    <span style={keyStyle}>Serial</span>
                    <span style={valueStyle}>
                        {serverState?.serial?.port || 'None'}
                    </span>
                </div>
                {serverState?.app?.bridgeUrl && (
                    <div style={rowStyle}>
                        <span style={keyStyle}>Bridge</span>
                        <span style={valueStyle}>{serverState.app.bridgeUrl}</span>
                    </div>
                )}
                {serverState?.app?.yaagcVersion && (
                    <div style={rowStyle}>
                        <span style={keyStyle}>yaAGC</span>
                        <span style={valueStyle}>{serverState.app.yaagcVersion}</span>
                    </div>
                )}
                {serverState?.app?.haUrl && (
                    <div style={rowStyle}>
                        <span style={keyStyle}>HA URL</span>
                        <span style={valueStyle}>{serverState.app.haUrl}</span>
                    </div>
                )}
            </div>
        </div>
    )
}
