"use client"

import type { CountdownState } from "../../hooks/useCountdown"
import { formatDigitsAsTime, formatMs } from "../../hooks/useCountdown"

interface CountdownModeProps {
    state: CountdownState
}

export default function CountdownMode({ state }: CountdownModeProps) {
    if (state.phase === 'setup') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{
                    fontSize: '2.5cqh',
                    color: 'var(--menu-secondary)',
                    textAlign: 'center',
                    marginBottom: '1cqh',
                }}>
                    SET TIME (HHMMSS)
                </div>

                <div style={{
                    fontSize: '7cqh',
                    color: 'var(--menu-primary)',
                    textAlign: 'center',
                    fontWeight: 700,
                    padding: '2cqh 0',
                    fontFamily: 'monospace',
                }}>
                    {formatDigitsAsTime(state.inputDigits)}
                </div>

                <div style={{
                    fontSize: '2.2cqh',
                    color: 'var(--menu-secondary)',
                    textAlign: 'center',
                    marginTop: 'auto',
                }}>
                    <K>0-9</K> time{' \u00A0 '}
                    <K>ENTR</K> start{' \u00A0 '}
                    <K>CLR</K> del
                </div>
            </div>
        )
    }

    const isDone = state.phase === 'done'
    const isPaused = state.phase === 'paused'

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{
                fontSize: '2.5cqh',
                color: isDone ? '#f87171' : isPaused ? 'var(--menu-accent)' : 'var(--menu-secondary)',
                textAlign: 'center',
                marginBottom: '1cqh',
            }}>
                {isDone ? 'TIME UP!' : isPaused ? 'PAUSED' : 'COUNTING DOWN'}
            </div>

            <div style={{
                fontSize: '7cqh',
                color: isDone ? (state.flash ? '#f87171' : 'transparent') : 'var(--menu-primary)',
                textAlign: 'center',
                fontWeight: 700,
                padding: '2cqh 0',
                fontFamily: 'monospace',
                transition: 'color 0.15s',
            }}>
                {formatMs(state.remaining)}
            </div>

            <div style={{
                fontSize: '2.2cqh',
                color: 'var(--menu-secondary)',
                textAlign: 'center',
                marginTop: 'auto',
            }}>
                {isDone ? (
                    <span>any key to reset</span>
                ) : (
                    <>
                        <K>ENTR</K> {isPaused ? 'resume' : 'pause'}
                        {' \u00A0 '}
                        <K>CLR</K> stop
                    </>
                )}
            </div>
        </div>
    )
}

function K({ children }: { children: React.ReactNode }) {
    return <span style={{ color: 'var(--menu-primary)', fontWeight: 600 }}>{children}</span>
}
