"use client"

import ELDisplay from "../elDisplay"
import type { DskyState } from "../../types/dsky"
import { SCREEN_AREA } from "./constants"

interface Props {
    dskyState: DskyState
    opacity: number
    displayType: string
    oledMode: string
    mode: 'overlay' | 'screen'
    containerRatio?: number
}

export default function DskyDisplayWrapper({ dskyState, opacity, displayType, oledMode, mode, containerRatio = 1 }: Props) {

    // --- SCREEN MODE ---
    if (mode === 'screen') {
        return <ELDisplay dskyState={dskyState} opacity={opacity} />
    }

    // --- OVERLAY MODE ---
    return (
        <div
            className={`dsky-display-wrapper display-${displayType} oled-${oledMode}`}
            style={{
                position: 'absolute',
                left: `${SCREEN_AREA.left}%`,
                top: `${SCREEN_AREA.top}%`,
                width: `${SCREEN_AREA.width}%`,
                height: `${SCREEN_AREA.height}%`,
                overflow: 'hidden',
                zIndex: 3,
                backgroundColor: 'transparent',
                '--scale': 0.96 * containerRatio * SCREEN_AREA.height / 100,
                '--margin-top': '0px',
                '--margin-left': '0px',
            } as React.CSSProperties}
        >
            <ELDisplay dskyState={dskyState} opacity={opacity} />
        </div>
    )
}
