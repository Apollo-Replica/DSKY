import type { PomodoroAppState } from "../../../types/serverState"
import { formatPomodoroMs, K } from "./formatters"

function SettingRow({ label, value, unit, active, blinkVisible }: { label: string; value: string; unit: string; active: boolean; blinkVisible: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '3cqh', padding: '0 2cqw' }}>
            <span style={{ color: active ? 'var(--menu-primary)' : 'var(--menu-secondary)', fontWeight: active ? 700 : 400 }}>{label}</span>
            <span style={{ color: 'var(--menu-primary)', fontWeight: 700, fontFamily: 'monospace', opacity: active && !blinkVisible ? 0 : 1, transition: 'opacity 0.1s' }}>
                {value}{unit && <span style={{ fontSize: '2.2cqh', color: 'var(--menu-secondary)', fontWeight: 400 }}>{unit}</span>}
            </span>
        </div>
    )
}

export default function PomodoroMode({ state, remaining, blinkVisible }: { state: PomodoroAppState; remaining: number; blinkVisible: boolean }) {
    const isIdle = state.phase === 'idle'
    const isWork = state.phase === 'work'
    const isBreak = state.phase === 'break'
    const isDone = state.phase === 'done'
    const inSetup = state.setupField !== null

    const workMin = Math.round(state.workDuration / 60_000)
    const breakMin = Math.round(state.breakDuration / 60_000)

    const workDisplay = state.setupField === 'work' && state.setupDigits.length > 0 ? state.setupDigits : String(workMin)
    const breakDisplay = state.setupField === 'break' && state.setupDigits.length > 0 ? state.setupDigits : String(breakMin)
    const sessionsDisplay = state.setupField === 'sessions' && state.setupDigits.length > 0 ? state.setupDigits : String(state.totalSessions)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ fontSize: '3cqh', color: isDone ? 'var(--menu-accent)' : isWork ? '#4ade80' : isBreak ? 'var(--menu-accent)' : 'var(--menu-secondary)', textAlign: 'center', fontWeight: 700 }}>
                {isDone ? 'COMPLETE!' : isIdle ? 'POMODORO' : isWork ? 'WORK' : 'BREAK'}
                {state.paused && ' (PAUSED)'}
            </div>
            {!isDone && (
                <div style={{ fontSize: '7cqh', color: 'var(--menu-primary)', textAlign: 'center', fontWeight: 700, padding: '1.5cqh 0', fontFamily: 'monospace' }}>
                    {formatPomodoroMs(remaining)}
                </div>
            )}
            {isDone && (
                <div style={{ fontSize: '4cqh', color: 'var(--menu-primary)', textAlign: 'center', padding: '2cqh 0' }}>
                    {state.completedSessions}/{state.totalSessions}
                </div>
            )}
            {!isDone && (
                <div style={{ fontSize: '2.5cqh', color: 'var(--menu-secondary)', textAlign: 'center', marginBottom: '1cqh' }}>
                    Session: <span style={{ color: 'var(--menu-primary)' }}>{state.completedSessions}</span>/{state.totalSessions}
                </div>
            )}
            <div style={{ borderTop: '1px solid var(--menu-border)', paddingTop: '2cqh', display: 'flex', flexDirection: 'column', gap: '1.5cqh' }}>
                <SettingRow label="WORK" value={workDisplay} unit="min" active={state.setupField === 'work'} blinkVisible={blinkVisible} />
                <SettingRow label="BREAK" value={breakDisplay} unit="min" active={state.setupField === 'break'} blinkVisible={blinkVisible} />
                <SettingRow label="SESSIONS" value={sessionsDisplay} unit="" active={state.setupField === 'sessions'} blinkVisible={blinkVisible} />
            </div>
            <div style={{ fontSize: '2.2cqh', color: 'var(--menu-secondary)', textAlign: 'center', marginTop: 'auto', paddingTop: '1cqh' }}>
                {isDone ? <span>any key to reset</span>
                    : inSetup ? <><K>0-9</K> set{' \u00A0 '}<K>PRO</K> next{' \u00A0 '}<K>RSET</K> cancel</>
                        : isIdle ? <><K>ENTR</K> start{' \u00A0 '}<K>PRO</K> setup</>
                            : <><K>ENTR</K> {state.paused ? 'resume' : 'pause'}{' \u00A0 '}<K>CLR</K> reset</>}
            </div>
        </div>
    )
}
