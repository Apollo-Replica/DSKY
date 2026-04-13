"use client"

import type { StopwatchState } from "../../hooks/useStopwatch"

interface StopwatchModeProps {
    state: StopwatchState
}

function formatElapsed(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    const hundredths = Math.floor((ms % 1000) / 10)
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}

export default function StopwatchMode({ state }: StopwatchModeProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Main time display */}
            <div style={{
                fontSize: '7cqh',
                color: 'var(--menu-primary)',
                textAlign: 'center',
                fontWeight: 700,
                padding: '2cqh 0',
                fontFamily: 'monospace',
            }}>
                {formatElapsed(state.elapsed)}
            </div>

            {/* Status */}
            <div style={{
                fontSize: '2.5cqh',
                color: state.running ? '#4ade80' : 'var(--menu-secondary)',
                textAlign: 'center',
                marginBottom: '1.5cqh',
            }}>
                {state.running ? 'RUNNING' : state.elapsed > 0 ? 'STOPPED' : 'READY'}
            </div>

            {/* Laps */}
            {state.laps.length > 0 && (
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    scrollbarWidth: 'none',
                    borderTop: '1px solid var(--menu-border)',
                    paddingTop: '1cqh',
                }}>
                    {state.laps.map((lapMs, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '2.5cqh',
                            color: 'var(--menu-secondary)',
                            padding: '0.3cqh 0',
                        }}>
                            <span style={{ color: 'var(--menu-accent)' }}>L{i + 1}</span>
                            <span>{formatElapsed(lapMs)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Hints */}
            <div style={{
                fontSize: '2.2cqh',
                color: 'var(--menu-secondary)',
                textAlign: 'center',
                marginTop: '1cqh',
            }}>
                <K>ENTR</K> {state.running ? 'stop' : 'start'}
                {' \u00A0 '}
                <K>CLR</K> {state.running ? 'lap' : 'reset'}
            </div>
        </div>
    )
}

function K({ children }: { children: React.ReactNode }) {
    return <span style={{ color: 'var(--menu-primary)', fontWeight: 600 }}>{children}</span>
}
