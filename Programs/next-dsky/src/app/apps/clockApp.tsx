"use client"

import { useState, useEffect, useRef } from "react"
import type { ServerState } from "../../types/serverState"
import { getCurrentTimeStr, K } from "./clock/formatters"
import StopwatchMode from "./clock/stopwatchMode"
import CountdownMode from "./clock/countdownMode"
import AlarmMode from "./clock/alarmMode"
import PomodoroMode from "./clock/pomodoroMode"

interface ClockAppProps {
    serverState: ServerState
}

const TABS = ['STOP', 'COUNT', 'ALARM', 'POMO'] as const

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
