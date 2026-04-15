"use client"

import { useState, useEffect, useRef } from "react"
import type { ServerState, StopwatchAppState, CountdownAppState, AlarmAppState, PomodoroAppState } from "../../types/serverState"

interface ClockAppProps {
    serverState: ServerState
}

const TABS = ['STOP', 'COUNT', 'ALARM', 'POMO'] as const

// --- Format helpers ---

function formatElapsed(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    const hundredths = Math.floor((ms % 1000) / 10)
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}

function formatMs(ms: number): string {
    const totalSec = Math.ceil(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatPomodoroMs(ms: number): string {
    const totalSec = Math.ceil(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDigitsAsTime(digits: string): string {
    const padded = digits.padStart(6, '0')
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`
}

function getCurrentTimeStr(): string {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
}

function formatInputDigits4(digits: string): string {
    const padded = digits.padStart(4, '0')
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`
}

// --- Timer interpolation hook ---

function useTimerInterpolation(clock: ServerState['app']['clock']) {
    const [tick, setTick] = useState(0)
    const rafRef = useRef<number>(0)

    const needsAnimation = clock && (
        (clock.stopwatch.running) ||
        (clock.countdown.phase === 'running') ||
        (clock.pomodoro.phase === 'work' && !clock.pomodoro.paused) ||
        (clock.pomodoro.phase === 'break' && !clock.pomodoro.paused)
    )

    useEffect(() => {
        if (!needsAnimation) return
        const loop = () => {
            setTick(Date.now())
            rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(rafRef.current)
    }, [needsAnimation])

    if (!clock) return { elapsed: 0, remaining: 0, pomoRemaining: 0 }

    const sw = clock.stopwatch
    const elapsed = sw.accumulated + (sw.running ? Date.now() - sw.startedAt : 0)

    const cd = clock.countdown
    const cdRemaining = cd.phase === 'running' ? Math.max(0, cd.endAt - Date.now()) : cd.remaining

    const pomo = clock.pomodoro
    const pomoRemaining = (pomo.phase === 'work' || pomo.phase === 'break') && !pomo.paused && pomo.endAt > 0
        ? Math.max(0, pomo.endAt - Date.now())
        : pomo.remaining

    // suppress unused tick warning — it drives re-renders
    void tick

    return { elapsed, remaining: cdRemaining, pomoRemaining }
}

// --- Main component ---

export default function ClockApp({ serverState }: ClockAppProps) {
    const clock = serverState.app.clock
    const { elapsed, remaining, pomoRemaining } = useTimerInterpolation(clock)

    // Blink for pomodoro setup fields + countdown done + alarm triggered
    const [blinkVisible, setBlinkVisible] = useState(true)
    useEffect(() => {
        const needsBlink = clock && (
            clock.pomodoro.setupField !== null ||
            clock.countdown.phase === 'done' ||
            clock.alarm.triggered
        )
        if (!needsBlink) { setBlinkVisible(true); return }
        const interval = setInterval(() => setBlinkVisible(v => !v), 400)
        return () => clearInterval(interval)
    }, [clock?.pomodoro.setupField, clock?.countdown.phase, clock?.alarm.triggered])

    // Current time for alarm display
    const [currentTime, setCurrentTime] = useState(getCurrentTimeStr())
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(getCurrentTimeStr()), 1000)
        return () => clearInterval(interval)
    }, [])

    if (!clock) return null

    const renderContent = () => {
        switch (TABS[clock.activeTab]) {
            case 'STOP': return <StopwatchMode state={clock.stopwatch} elapsed={elapsed} />
            case 'COUNT': return <CountdownMode state={clock.countdown} remaining={remaining} blinkVisible={blinkVisible} />
            case 'ALARM': return <AlarmMode state={clock.alarm} currentTime={currentTime} blinkVisible={blinkVisible} />
            case 'POMO': return <PomodoroMode state={clock.pomodoro} remaining={pomoRemaining} blinkVisible={blinkVisible} />
        }
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            fontFamily: 'Gorton, "Arial Narrow", sans-serif',
            color: 'var(--menu-primary)',
            overflow: 'hidden',
        }}>
            {/* Tab bar */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--menu-border)',
                flexShrink: 0,
            }}>
                {TABS.map((tab, i) => (
                    <div
                        key={tab}
                        style={{
                            flex: 1,
                            textAlign: 'center',
                            padding: '1.5cqh 0',
                            fontSize: '2.5cqh',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            color: i === clock.activeTab ? 'var(--menu-primary)' : 'var(--menu-secondary)',
                            background: i === clock.activeTab ? 'rgba(74, 222, 128, 0.1)' : 'transparent',
                            borderBottom: i === clock.activeTab ? '2px solid var(--menu-primary)' : '2px solid transparent',
                        }}
                    >
                        {tab}
                    </div>
                ))}
            </div>

            {/* Content area */}
            <div style={{
                flex: 1,
                padding: '2cqh 3cqw',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {renderContent()}
            </div>

            {/* Tab navigation hint */}
            <div style={{
                flexShrink: 0,
                textAlign: 'center',
                fontSize: '2.2cqh',
                color: 'var(--menu-secondary)',
                padding: '1cqh 0',
                borderTop: '1px solid var(--menu-border)',
            }}>
                <K>+</K>/<K>-</K> tabs{' \u00A0 '}
                <K>NNN</K> menu
            </div>
        </div>
    )
}

// --- Mode renderers ---

function StopwatchMode({ state, elapsed }: { state: StopwatchAppState; elapsed: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ fontSize: '7cqh', color: 'var(--menu-primary)', textAlign: 'center', fontWeight: 700, padding: '2cqh 0', fontFamily: 'monospace' }}>
                {formatElapsed(elapsed)}
            </div>
            <div style={{ fontSize: '2.5cqh', color: state.running ? '#4ade80' : 'var(--menu-secondary)', textAlign: 'center', marginBottom: '1.5cqh' }}>
                {state.running ? 'RUNNING' : elapsed > 0 ? 'STOPPED' : 'READY'}
            </div>
            {state.laps.length > 0 && (
                <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', borderTop: '1px solid var(--menu-border)', paddingTop: '1cqh' }}>
                    {state.laps.map((lapMs, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2.5cqh', color: 'var(--menu-secondary)', padding: '0.3cqh 0' }}>
                            <span style={{ color: 'var(--menu-accent)' }}>L{i + 1}</span>
                            <span>{formatElapsed(lapMs)}</span>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ fontSize: '2.2cqh', color: 'var(--menu-secondary)', textAlign: 'center', marginTop: '1cqh' }}>
                <K>ENTR</K> {state.running ? 'stop' : 'start'}{' \u00A0 '}<K>CLR</K> {state.running ? 'lap' : 'reset'}
            </div>
        </div>
    )
}

function CountdownMode({ state, remaining, blinkVisible }: { state: CountdownAppState; remaining: number; blinkVisible: boolean }) {
    if (state.phase === 'setup') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ fontSize: '2.5cqh', color: 'var(--menu-secondary)', textAlign: 'center', marginBottom: '1cqh' }}>SET TIME (HHMMSS)</div>
                <div style={{ fontSize: '7cqh', color: 'var(--menu-primary)', textAlign: 'center', fontWeight: 700, padding: '2cqh 0', fontFamily: 'monospace' }}>
                    {formatDigitsAsTime(state.inputDigits)}
                </div>
                <div style={{ fontSize: '2.2cqh', color: 'var(--menu-secondary)', textAlign: 'center', marginTop: 'auto' }}>
                    <K>0-9</K> time{' \u00A0 '}<K>ENTR</K> start{' \u00A0 '}<K>CLR</K> del
                </div>
            </div>
        )
    }

    const isDone = state.phase === 'done'
    const isPaused = state.phase === 'paused'

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ fontSize: '2.5cqh', color: isDone ? '#f87171' : isPaused ? 'var(--menu-accent)' : 'var(--menu-secondary)', textAlign: 'center', marginBottom: '1cqh' }}>
                {isDone ? 'TIME UP!' : isPaused ? 'PAUSED' : 'COUNTING DOWN'}
            </div>
            <div style={{ fontSize: '7cqh', color: isDone ? (blinkVisible ? '#f87171' : 'transparent') : 'var(--menu-primary)', textAlign: 'center', fontWeight: 700, padding: '2cqh 0', fontFamily: 'monospace', transition: 'color 0.15s' }}>
                {formatMs(remaining)}
            </div>
            <div style={{ fontSize: '2.2cqh', color: 'var(--menu-secondary)', textAlign: 'center', marginTop: 'auto' }}>
                {isDone ? <span>any key to reset</span> : <><K>ENTR</K> {isPaused ? 'resume' : 'pause'}{' \u00A0 '}<K>CLR</K> stop</>}
            </div>
        </div>
    )
}

function AlarmMode({ state, currentTime, blinkVisible }: { state: AlarmAppState; currentTime: string; blinkVisible: boolean }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ fontSize: '2.5cqh', color: 'var(--menu-secondary)', textAlign: 'center' }}>NOW</div>
            <div style={{ fontSize: '6cqh', color: 'var(--menu-primary)', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace' }}>{currentTime}</div>
            <div style={{ borderTop: '1px solid var(--menu-border)', marginTop: '1.5cqh', paddingTop: '1.5cqh' }}>
                <div style={{ fontSize: '2.5cqh', color: state.triggered ? '#f87171' : state.armed ? '#4ade80' : 'var(--menu-secondary)', textAlign: 'center' }}>
                    {state.triggered ? 'ALARM!' : state.armed ? 'ARMED' : 'SET ALARM (HHMM)'}
                </div>
                <div style={{
                    fontSize: '5cqh',
                    color: state.triggered ? (blinkVisible ? '#f87171' : 'transparent') : state.armed ? 'var(--menu-accent)' : 'var(--menu-primary)',
                    textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', padding: '1cqh 0', transition: 'color 0.15s',
                }}>
                    {state.armed || state.triggered ? state.alarmTime : formatInputDigits4(state.inputDigits)}
                </div>
            </div>
            <div style={{ fontSize: '2.2cqh', color: 'var(--menu-secondary)', textAlign: 'center', marginTop: 'auto' }}>
                {state.triggered ? <span>any key to dismiss</span>
                    : state.armed ? <><K>CLR</K> disarm</>
                        : <><K>0-9</K> time{' \u00A0 '}<K>ENTR</K> arm{' \u00A0 '}<K>CLR</K> del</>}
            </div>
        </div>
    )
}

function PomodoroMode({ state, remaining, blinkVisible }: { state: PomodoroAppState; remaining: number; blinkVisible: boolean }) {
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

function K({ children }: { children: React.ReactNode }) {
    return <span style={{ color: 'var(--menu-primary)', fontWeight: 600 }}>{children}</span>
}
