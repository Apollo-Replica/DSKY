"use client"

import { useEffect, useRef } from "react"
import type { ConfigState } from "../../types/config"

interface DskyConfigWizardProps {
    config: ConfigState
    onAction: (action: string) => void
    onTextChange: (text: string) => void
    onToggleEntity: (index: number) => void
}

const STEP_TITLES: Record<string, string> = {
    network: 'NETWORK',
    serial: 'SERIAL PORT',
    source: 'AGC SOURCE',
    bridge: 'BRIDGE TARGET',
    manualUrl: 'WEBSOCKET URL',
    yaagc: 'yaAGC VERSION',
    haSetup: 'HA SETUP',
    haUrl: 'HA URL',
    haToken: 'ACCESS TOKEN',
    haDiscover: 'DISCOVERING',
    haEntities: 'SELECT DEVICES',
    confirm: 'CONFIRM',
}

const panelStyle: React.CSSProperties = {
    fontFamily: 'Gorton, "Arial Narrow", sans-serif',
    color: 'var(--menu-primary)',
    fontSize: 'clamp(7px, 1.2vh, 11px)',
    padding: 'clamp(4px, 1%, 8px)',
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollbarWidth: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(2px, 0.5vh, 6px)',
}

const titleStyle: React.CSSProperties = {
    textAlign: 'center',
    fontSize: 'clamp(8px, 1.5vh, 13px)',
    fontWeight: 700,
    letterSpacing: 2,
    textShadow: '0 0 6px rgba(74, 222, 128, 0.4)',
    marginBottom: 'clamp(2px, 0.5vh, 6px)',
}

const optionStyle = (selected: boolean): React.CSSProperties => ({
    padding: 'clamp(3px, 0.6vh, 6px) clamp(4px, 0.8vh, 8px)',
    background: selected ? 'rgba(74, 222, 128, 0.2)' : 'rgba(10, 20, 10, 0.6)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: selected ? 'var(--menu-primary)' : 'var(--menu-border)',
    borderRadius: 3,
    color: selected ? 'var(--menu-highlight)' : 'var(--menu-primary)',
    cursor: 'pointer',
    fontSize: 'clamp(6px, 1.1vh, 10px)',
    textAlign: 'left',
    display: 'block',
    width: '100%',
    fontFamily: 'Gorton, "Arial Narrow", sans-serif',
    boxShadow: selected ? '0 0 8px rgba(74, 222, 128, 0.2)' : 'none',
})

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'clamp(3px, 0.6vh, 6px)',
    background: 'rgba(10, 20, 10, 0.8)',
    color: 'var(--menu-primary)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--menu-border)',
    borderRadius: 3,
    fontFamily: 'Gorton, "Arial Narrow", sans-serif',
    fontSize: 'clamp(6px, 1vh, 10px)',
    outline: 'none',
}

const btnStyle = (primary: boolean): React.CSSProperties => ({
    padding: 'clamp(3px, 0.6vh, 6px) clamp(6px, 1vh, 10px)',
    background: primary ? 'rgba(74, 222, 128, 0.2)' : 'rgba(30, 30, 30, 0.8)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: primary ? 'var(--menu-primary)' : '#333',
    borderRadius: 3,
    color: primary ? 'var(--menu-primary)' : '#888',
    cursor: 'pointer',
    fontFamily: 'Gorton, "Arial Narrow", sans-serif',
    fontSize: 'clamp(6px, 1vh, 9px)',
})

export default function DskyConfigWizard({ config, onAction, onTextChange, onToggleEntity }: DskyConfigWizardProps) {
    const { step, options, selectedIndex, scanning, textInput } = config
    const isTextInputStep = step === 'manualUrl' || step === 'haUrl' || step === 'haToken'

    const getPlaceholder = () => {
        if (step === 'haUrl') return 'http://homeassistant.local:8123'
        if (step === 'haToken') return 'Paste token here'
        if (step === 'manualUrl') return 'wss://example.com/ws'
        return ''
    }

    return (
        <div style={panelStyle}>
            {/* Step title */}
            <div style={titleStyle}>
                <div style={{ fontSize: 'clamp(6px, 0.9vh, 8px)', color: 'var(--menu-secondary)', marginBottom: 2 }}>
                    STEP {String(config.stepNumber ?? 1).padStart(2, '0')}
                </div>
                {STEP_TITLES[step] || step}
            </div>

            {/* Scanning */}
            {scanning && (
                <div style={{ textAlign: 'center', color: 'var(--menu-accent)', fontSize: 'clamp(6px, 1vh, 9px)' }}>
                    Discovering...
                </div>
            )}

            {/* HA Setup info */}
            {step === 'haSetup' && (
                <div style={{ fontSize: 'clamp(6px, 1vh, 9px)', color: 'var(--menu-secondary)', lineHeight: 1.4 }}>
                    <div style={{ marginBottom: 4 }}>You need your HA URL and a long-lived access token.</div>
                    <div style={{ color: 'var(--menu-primary)', textAlign: 'center', padding: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: 3, marginBottom: 4, wordBreak: 'break-all' }}>
                        {config.localUrl || 'http://localhost:3000/config'}
                    </div>
                    <div style={{ fontSize: 'clamp(5px, 0.8vh, 8px)', color: '#2d6b47' }}>
                        Open this URL on another device for keyboard input.
                    </div>
                </div>
            )}

            {/* HA Discover */}
            {step === 'haDiscover' && (
                <div style={{ textAlign: 'center' }}>
                    {config.haDiscoverError ? (
                        <>
                            <div style={{ color: '#ef4444', marginBottom: 4 }}>{config.haDiscoverError}</div>
                            <button style={btnStyle(false)} onClick={() => onAction('back')}>Back</button>
                        </>
                    ) : (
                        <div style={{ color: '#facc15' }}>Connecting to HA...</div>
                    )}
                </div>
            )}

            {/* Text input steps */}
            {isTextInputStep && (
                <div>
                    <input
                        type="text"
                        value={textInput || ''}
                        onChange={(e) => onTextChange(e.target.value)}
                        placeholder={getPlaceholder()}
                        autoFocus
                        style={inputStyle}
                    />
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <button style={btnStyle(false)} onClick={() => onAction('back')}>Back</button>
                        <button style={btnStyle(true)} onClick={() => onAction('select')}>Confirm</button>
                    </div>
                </div>
            )}

            {/* Options list */}
            {!isTextInputStep && step !== 'haDiscover' && step !== 'haSetup' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(1px, 0.3vh, 3px)' }}>
                    {options.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                if (step === 'haEntities') {
                                    onToggleEntity(index)
                                } else {
                                    for (let i = 0; i < Math.abs(index - selectedIndex); i++) {
                                        onAction(index > selectedIndex ? 'next' : 'prev')
                                    }
                                    onAction('select')
                                }
                            }}
                            style={optionStyle(index === selectedIndex)}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            )}

            {/* Navigation for haSetup */}
            {step === 'haSetup' && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button style={btnStyle(true)} onClick={() => onAction('select')}>Continue</button>
                </div>
            )}

            {/* haEntities — auto-confirm when done selecting */}
            {step === 'haEntities' && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button style={btnStyle(true)} onClick={() => onAction('select')}>Done</button>
                </div>
            )}

            {/* Confirm step — auto-confirm */}
            {step === 'confirm' && (
                <AutoConfirm onAction={onAction} />
            )}
        </div>
    )
}

function AutoConfirm({ onAction }: { onAction: (action: string) => void }) {
    const confirmed = useRef(false)
    useEffect(() => {
        if (!confirmed.current) {
            confirmed.current = true
            const timer = setTimeout(() => onAction('select'), 100)
            return () => clearTimeout(timer)
        }
    }, [onAction])
    return (
        <div style={{ textAlign: 'center', color: 'var(--menu-secondary)', fontSize: 'clamp(6px, 1vh, 9px)' }}>
            Starting...
        </div>
    )
}
