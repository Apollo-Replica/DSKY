"use client"

import { SCREEN_AREA } from "./constants"

interface Props {
    displayType?: string
    mode: 'overlay' | 'screen'
    containerRatio?: number
    children: React.ReactNode
}

export default function DskyDisplayWrapper({ displayType, mode, containerRatio = 1, children }: Props) {

    // --- SCREEN MODE ---
    if (mode === 'screen') {
        return <>{children}</>
    }

    // --- OVERLAY MODE ---
    return (
        <div
            className={`dsky-display-wrapper${displayType ? ` display-${displayType}` : ''}`}
            style={{
                position: 'absolute',
                left: `${SCREEN_AREA.left}%`,
                top: `${SCREEN_AREA.top}%`,
                width: `${SCREEN_AREA.width}%`,
                height: `${SCREEN_AREA.height}%`,
                overflow: 'hidden',
                zIndex: 3,
                containerType: 'size',
                '--scale': 0.96 * containerRatio * SCREEN_AREA.height / 100,
                '--margin-top': '0px',
                '--margin-left': '0px',
            } as React.CSSProperties}
        >
            {children}
        </div>
    )
}
