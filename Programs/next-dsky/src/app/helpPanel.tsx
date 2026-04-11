"use client"

import { useState } from "react"
import { assignNouns } from "../utils/nounAssignment"

interface HelpPanelProps {
    config: any
}

export default function HelpPanel({ config }: HelpPanelProps) {
    const [open, setOpen] = useState(false)

    if (config?.inputSource !== 'homeassistant') return null

    const assignments = (config?.haSelectedEntityIds && config?.haEntities)
        ? assignNouns(config.haSelectedEntityIds, config.haEntities)
        : []

    return (
        <>
            <button
                onClick={() => setOpen(!open)}
                className="help-toggle"
                title="Commands & Devices"
            >
                ?
            </button>

            <div className={`help-sidebar ${open ? 'open' : ''}`}>
                <div className="help-header">
                    <h2>DSKY Commands</h2>
                    <button onClick={() => setOpen(false)} className="help-close">✕</button>
                </div>

                {assignments.length > 0 && (
                    <div className="help-section">
                        <h3>Your Devices</h3>
                        {assignments.map(a => (
                            <div key={a.noun} className="help-device">
                                <span className="help-noun">N{a.noun}</span>
                                <span className="help-label">{a.friendlyName}</span>
                                {a.toggleable && (
                                    <span className="help-hint">V40 N{a.noun} ENTR</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="help-section">
                    <h3>Commands</h3>
                    <div className="help-cmd"><span className="help-verb">V16</span> Nxx ENTR <span className="help-desc">Monitor device</span></div>
                    <div className="help-cmd"><span className="help-verb">V06</span> Nxx ENTR <span className="help-desc">Display once</span></div>
                    <div className="help-cmd"><span className="help-verb">V40</span> Nxx ENTR <span className="help-desc">Toggle on/off</span></div>
                    <div className="help-cmd"><span className="help-verb">V16</span> N36 ENTR <span className="help-desc">Clock</span></div>
                    <div className="help-cmd"><span className="help-verb">V35</span> ENTR <span className="help-desc">Lamp test</span></div>
                </div>

                <div className="help-section">
                    <h3>Keys</h3>
                    <div className="help-cmd"><span className="help-verb">VERB</span> + digits <span className="help-desc">Enter verb</span></div>
                    <div className="help-cmd"><span className="help-verb">NOUN</span> + digits <span className="help-desc">Enter noun</span></div>
                    <div className="help-cmd"><span className="help-verb">ENTR</span> <span className="help-desc">Execute</span></div>
                    <div className="help-cmd"><span className="help-verb">CLR</span> <span className="help-desc">Clear input</span></div>
                    <div className="help-cmd"><span className="help-verb">RSET</span> <span className="help-desc">Reset error</span></div>
                    <div className="help-cmd"><span className="help-verb">KEY REL</span> <span className="help-desc">Restore display</span></div>
                </div>
            </div>
        </>
    )
}
