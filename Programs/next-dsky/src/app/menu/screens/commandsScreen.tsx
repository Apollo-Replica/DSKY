"use client"

import { assignNouns } from "../../../utils/nounAssignment"
import type { ServerState } from "../../../types/serverState"
import { panelStyle, sectionStyle, titleStyle, rowStyle, keyStyle, valueStyle, hintStyle } from "../panelStyles"

interface CommandsScreenProps {
    serverState: ServerState | null
}

export default function CommandsScreen({ serverState }: CommandsScreenProps) {
    const isHA = serverState?.app?.id === 'homeassistant'
    const assignments = (isHA && serverState?.ha?.selectedIds && serverState?.ha?.entities)
        ? assignNouns(serverState.ha.selectedIds, serverState.ha.entities)
        : []

    return (
        <div style={panelStyle}>
            {assignments.length > 0 && (
                <div style={sectionStyle}>
                    <div style={titleStyle}>Your Devices</div>
                    {assignments.map((a) => (
                        <div key={a.noun} style={rowStyle}>
                            <span style={keyStyle}>N{a.noun}</span>
                            <span style={valueStyle}>{a.friendlyName}</span>
                            {a.toggleable && (
                                <span style={hintStyle}> V40 N{a.noun} ENTR</span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div style={sectionStyle}>
                <div style={titleStyle}>Commands</div>
                {isHA && (
                    <>
                        <div style={rowStyle}>
                            <span style={keyStyle}>V16</span>
                            <span style={valueStyle}>Nxx ENTR</span>
                            <span style={hintStyle}>Monitor device</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={keyStyle}>V06</span>
                            <span style={valueStyle}>Nxx ENTR</span>
                            <span style={hintStyle}>Display once</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={keyStyle}>V40</span>
                            <span style={valueStyle}>Nxx ENTR</span>
                            <span style={hintStyle}>Toggle on/off</span>
                        </div>
                    </>
                )}
                <div style={rowStyle}>
                    <span style={keyStyle}>V16</span>
                    <span style={valueStyle}>N36 ENTR</span>
                    <span style={hintStyle}>Clock</span>
                </div>
                <div style={rowStyle}>
                    <span style={keyStyle}>V35</span>
                    <span style={valueStyle}>ENTR</span>
                    <span style={hintStyle}>Lamp test</span>
                </div>
            </div>

            <div style={sectionStyle}>
                <div style={titleStyle}>Keys</div>
                <div style={rowStyle}>
                    <span style={keyStyle}>VERB</span>
                    <span style={valueStyle}>+ digits</span>
                    <span style={hintStyle}>Enter verb</span>
                </div>
                <div style={rowStyle}>
                    <span style={keyStyle}>NOUN</span>
                    <span style={valueStyle}>+ digits</span>
                    <span style={hintStyle}>Enter noun</span>
                </div>
                <div style={rowStyle}>
                    <span style={keyStyle}>ENTR</span>
                    <span style={valueStyle}></span>
                    <span style={hintStyle}>Execute command</span>
                </div>
                <div style={rowStyle}>
                    <span style={keyStyle}>CLR</span>
                    <span style={valueStyle}></span>
                    <span style={hintStyle}>Clear input</span>
                </div>
                <div style={rowStyle}>
                    <span style={keyStyle}>RSET</span>
                    <span style={valueStyle}></span>
                    <span style={hintStyle}>Reset error</span>
                </div>
                <div style={rowStyle}>
                    <span style={keyStyle}>KEY REL</span>
                    <span style={valueStyle}></span>
                    <span style={hintStyle}>Restore display</span>
                </div>
                <div style={rowStyle}>
                    <span style={keyStyle}>PRO</span>
                    <span style={valueStyle}></span>
                    <span style={hintStyle}>Proceed</span>
                </div>
            </div>

            <div style={{ ...sectionStyle, marginBottom: 0 }}>
                <div style={titleStyle}>Menu</div>
                <div style={rowStyle}>
                    <span style={keyStyle}>NNN</span>
                    <span style={valueStyle}></span>
                    <span style={hintStyle}>NOUN x3 opens menu</span>
                </div>
            </div>
        </div>
    )
}
