"use client"

import type { ConfigState } from "../../../types/config"
import type { DskyClient } from "../../../types/dsky"
import { panelStyle, sectionStyle, titleStyle, rowStyle, keyStyle, valueStyle } from "../panelStyles"

interface AboutScreenProps {
    configState: ConfigState | null
    wsConnected: boolean
    clients: DskyClient[]
}

export default function AboutScreen({ configState, wsConnected, clients }: AboutScreenProps) {
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
                    <span style={keyStyle}>Source</span>
                    <span style={valueStyle}>
                        {configState?.inputSource || 'Not configured'}
                    </span>
                </div>
                <div style={rowStyle}>
                    <span style={keyStyle}>Serial</span>
                    <span style={valueStyle}>
                        {configState?.serialPort || 'None'}
                    </span>
                </div>
                {configState?.bridgeUrl && (
                    <div style={rowStyle}>
                        <span style={keyStyle}>Bridge</span>
                        <span style={valueStyle}>{configState.bridgeUrl}</span>
                    </div>
                )}
                {configState?.yaagcVersion && (
                    <div style={rowStyle}>
                        <span style={keyStyle}>yaAGC</span>
                        <span style={valueStyle}>{configState.yaagcVersion}</span>
                    </div>
                )}
                {configState?.haUrl && (
                    <div style={rowStyle}>
                        <span style={keyStyle}>HA URL</span>
                        <span style={valueStyle}>{configState.haUrl}</span>
                    </div>
                )}
            </div>

            <div style={{ ...sectionStyle, marginBottom: 0 }}>
                <div style={titleStyle}>System</div>
                <div style={rowStyle}>
                    <span style={keyStyle}>App</span>
                    <span style={valueStyle}>DSKY Replica</span>
                </div>
            </div>
        </div>
    )
}
