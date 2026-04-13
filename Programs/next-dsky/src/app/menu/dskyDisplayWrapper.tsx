"use client"

import ELDisplay from "../elDisplay"
import DskyConfigWizard from "./dskyConfigWizard"
import type { ConfigState } from "../../types/config"
import type { DskyState } from "../../types/dsky"
import { SCREEN_AREA } from "./constants"

interface Props {
    dskyState: DskyState
    opacity: number
    displayType: string
    oledMode: string
    configState: ConfigState | null
    sendConfigMessage: (type: string, data?: Record<string, unknown>) => void
    mode: 'overlay' | 'screen'
    containerRatio?: number  // 1 = full size, <1 = width-constrained on narrow viewports
}

// Steps that need the config wizard UI
const WIZARD_STEPS = ['serial', 'haSetup', 'haUrl', 'haToken', 'haDiscover', 'haEntities', 'bridge', 'manualUrl', 'yaagc', 'confirm', 'network']

export default function DskyDisplayWrapper({ dskyState, opacity, displayType, oledMode, configState, sendConfigMessage, mode, containerRatio = 1 }: Props) {
    const configReady = configState?.ready !== false

    const showWizard = !configReady && configState && WIZARD_STEPS.includes(configState.step)

    const onAction = (action: string) => {
        switch (action) {
            case 'next': sendConfigMessage('config:next'); break
            case 'prev': sendConfigMessage('config:prev'); break
            case 'select': sendConfigMessage('config:select'); break
            case 'back': sendConfigMessage('config:back'); break
        }
    }

    const onTextChange = (text: string) => {
        sendConfigMessage('config:text-input', { text })
    }

    const onToggleEntity = (index: number) => {
        sendConfigMessage('config:toggle', { index })
    }

    // --- SCREEN MODE ---
    if (mode === 'screen') {
        if (showWizard) {
            return (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'clamp(280px, 40vh, 400px)',
                    maxHeight: '80vh',
                    overflow: 'hidden',
                    zIndex: 1,
                }}>
                    <DskyConfigWizard
                        config={configState}
                        onAction={onAction}
                        onTextChange={onTextChange}
                        onToggleEntity={onToggleEntity}
                    />
                </div>
            )
        }
        // Return ELDisplay directly — no wrapper div that would break absolute CSS positioning
        return <ELDisplay dskyState={dskyState} opacity={opacity} />
    }

    // --- OVERLAY MODE ---
    if (showWizard) {
        return (
            <div style={{
                position: 'absolute',
                left: `${SCREEN_AREA.left}%`,
                top: `${SCREEN_AREA.top}%`,
                width: `${SCREEN_AREA.width}%`,
                height: `${SCREEN_AREA.height}%`,
                zIndex: 3,
                overflow: 'hidden',
            }}>
                <DskyConfigWizard
                    config={configState}
                    onAction={onAction}
                    onTextChange={onTextChange}
                    onToggleEntity={onToggleEntity}
                />
            </div>
        )
    }

    // Normal EL Display — override CSS --scale so the vh-based ELDisplay fits inside the screen area.
    // Parent DSKY container is 96vh tall; screen area is SCREEN_AREA.height% of that.
    // ELDisplay height = 100vh * --scale, so --scale = 0.96 * SCREEN_AREA.height / 100
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
