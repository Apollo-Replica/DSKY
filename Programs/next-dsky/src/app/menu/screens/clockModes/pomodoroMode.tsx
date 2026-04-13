"use client"

import type { PomodoroState } from "../../hooks/usePomodoro"
import { formatPomodoroMs } from "../../hooks/usePomodoro"

interface PomodoroModeProps {
    state: PomodoroState
    blinkVisible: boolean
}

export default function PomodoroMode({ state, blinkVisible }: PomodoroModeProps) {
    const isIdle = state.phase === 'idle'
    const isWork = state.phase === 'work'
    const isBreak = state.phase === 'break'
    const isDone = state.phase === 'done'
    const inSetup = state.setupField !== null

    const workMin = Math.round(state.workDuration / 60_000)
    const breakMin = Math.round(state.breakDuration / 60_000)

    const workDisplay = state.setupField === 'work' && state.setupDigits.length > 0
        ? state.setupDigits
        : String(workMin)

    const breakDisplay = state.setupField === 'break' && state.setupDigits.length > 0
        ? state.setupDigits
        : String(breakMin)

    const sessionsDisplay = state.setupField === 'sessions' && state.setupDigits.length > 0
        ? state.setupDigits
        : String(state.totalSessions)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Phase indicator */}
            <div style={{
                fontSize: '3cqh',
                color: isDone ? 'var(--menu-accent)' : isWork ? '#4ade80' : isBreak ? 'var(--menu-accent)' : 'var(--menu-secondary)',
                textAlign: 'center',
                fontWeight: 700,
            }}>
                {isDone ? 'COMPLETE!' : isIdle ? 'POMODORO' : isWork ? 'WORK' : 'BREAK'}
                {state.paused && ' (PAUSED)'}
            </div>

            {/* Timer */}
            {!isDone && (
                <div style={{
                    fontSize: '7cqh',
                    color: 'var(--menu-primary)',
                    textAlign: 'center',
                    fontWeight: 700,
                    padding: '1.5cqh 0',
                    fontFamily: 'monospace',
                }}>
                    {formatPomodoroMs(state.remaining)}
                </div>
            )}

            {/* Done message */}
            {isDone && (
                <div style={{
                    fontSize: '4cqh',
                    color: 'var(--menu-primary)',
                    textAlign: 'center',
                    padding: '2cqh 0',
                }}>
                    {state.completedSessions}/{state.totalSessions}
                </div>
            )}

            {/* Sessions progress */}
            {!isDone && (
                <div style={{
                    fontSize: '2.5cqh',
                    color: 'var(--menu-secondary)',
                    textAlign: 'center',
                    marginBottom: '1cqh',
                }}>
                    Session: <span style={{ color: 'var(--menu-primary)' }}>{state.completedSessions}</span>
                    <span style={{ color: 'var(--menu-secondary)' }}>/{state.totalSessions}</span>
                </div>
            )}

            {/* Settings — always visible, blink on active field during setup */}
            <div style={{
                borderTop: '1px solid var(--menu-border)',
                paddingTop: '2cqh',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5cqh',
            }}>
                <SettingRow
                    label="WORK"
                    value={workDisplay}
                    unit="min"
                    active={state.setupField === 'work'}
                    blinkVisible={blinkVisible}
                    color="var(--menu-primary)"
                />
                <SettingRow
                    label="BREAK"
                    value={breakDisplay}
                    unit="min"
                    active={state.setupField === 'break'}
                    blinkVisible={blinkVisible}
                    color="var(--menu-primary)"
                />
                <SettingRow
                    label="SESSIONS"
                    value={sessionsDisplay}
                    unit=""
                    active={state.setupField === 'sessions'}
                    blinkVisible={blinkVisible}
                    color="var(--menu-primary)"
                />
            </div>

            {/* Hints */}
            <div style={{
                fontSize: '2.2cqh',
                color: 'var(--menu-secondary)',
                textAlign: 'center',
                marginTop: 'auto',
                paddingTop: '1cqh',
            }}>
                {isDone ? (
                    <span>any key to reset</span>
                ) : inSetup ? (
                    <>
                        <K>0-9</K> set{' \u00A0 '}
                        <K>PRO</K> next{' \u00A0 '}
                        <K>RSET</K> cancel
                    </>
                ) : isIdle ? (
                    <>
                        <K>ENTR</K> start{' \u00A0 '}
                        <K>PRO</K> setup
                    </>
                ) : (
                    <>
                        <K>ENTR</K> {state.paused ? 'resume' : 'pause'}
                        {' \u00A0 '}
                        <K>CLR</K> reset
                    </>
                )}
            </div>
        </div>
    )
}

function SettingRow({ label, value, unit, active, blinkVisible, color }: {
    label: string
    value: string
    unit: string
    active: boolean
    blinkVisible: boolean
    color: string
}) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontSize: '3cqh',
            padding: '0 2cqw',
        }}>
            <span style={{
                color: active ? color : 'var(--menu-secondary)',
                fontWeight: active ? 700 : 400,
            }}>
                {label}
            </span>
            <span style={{
                color: color,
                fontWeight: 700,
                fontFamily: 'monospace',
                opacity: active && !blinkVisible ? 0 : 1,
                transition: 'opacity 0.1s',
            }}>
                {value}{unit && <span style={{ fontSize: '2.2cqh', color: 'var(--menu-secondary)', fontWeight: 400 }}>{unit}</span>}
            </span>
        </div>
    )
}

function K({ children }: { children: React.ReactNode }) {
    return <span style={{ color: 'var(--menu-primary)', fontWeight: 600 }}>{children}</span>
}
