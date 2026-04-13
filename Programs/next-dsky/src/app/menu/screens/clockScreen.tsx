"use client"

import { useState, useEffect, useCallback, type RefObject } from "react"
import { panelStyle } from "../panelStyles"
import { useStopwatch } from "../hooks/useStopwatch"
import { useCountdown } from "../hooks/useCountdown"
import { usePomodoro } from "../hooks/usePomodoro"
import StopwatchMode from "./clockModes/stopwatchMode"
import CountdownMode from "./clockModes/countdownMode"
import AlarmMode from "./clockModes/alarmMode"
import PomodoroMode from "./clockModes/pomodoroMode"

interface ClockScreenProps {
    appKeyHandlerRef: RefObject<((key: string) => void) | null>
}

const TABS = ['STOP', 'COUNT', 'ALARM', 'POMO'] as const
type TabId = typeof TABS[number]

export default function ClockScreen({ appKeyHandlerRef }: ClockScreenProps) {
    const [activeTab, setActiveTab] = useState<number>(0)

    const stopwatch = useStopwatch()
    const countdown = useCountdown()
    const pomodoro = usePomodoro()

    // Alarm has its own internal key handler (self-contained with state)
    const [alarmKeyHandler, setAlarmKeyHandler] = useState<((key: string) => void) | null>(null)
    const registerAlarmKeyHandler = useCallback((handler: (key: string) => void) => {
        setAlarmKeyHandler(() => handler)
    }, [])

    // Dispatch keys based on active tab
    const handleKey = useCallback((key: string) => {
        // VERB (v) / NOUN (n) → change tabs
        // +/- to switch tabs
        if (key === '-') {
            setActiveTab(prev => (prev + 1) % TABS.length)
            return
        }
        if (key === '+') {
            setActiveTab(prev => (prev - 1 + TABS.length) % TABS.length)
            return
        }

        // Delegate to active mode
        const tabId = TABS[activeTab]
        switch (tabId) {
            case 'STOP':
                stopwatch.handleKey(key)
                break
            case 'COUNT':
                countdown.handleKey(key)
                break
            case 'ALARM':
                alarmKeyHandler?.(key)
                break
            case 'POMO':
                pomodoro.handleKey(key)
                break
        }
    }, [activeTab, stopwatch.handleKey, countdown.handleKey, alarmKeyHandler, pomodoro.handleKey])

    // Register key handler
    useEffect(() => {
        appKeyHandlerRef.current = handleKey
        return () => {
            appKeyHandlerRef.current = null
        }
    }, [appKeyHandlerRef, handleKey])

    const renderContent = () => {
        switch (TABS[activeTab]) {
            case 'STOP':
                return <StopwatchMode state={stopwatch.state} />
            case 'COUNT':
                return <CountdownMode state={countdown.state} />
            case 'ALARM':
                return <AlarmMode onRegisterKeyHandler={registerAlarmKeyHandler} />
            case 'POMO':
                return <PomodoroMode state={pomodoro.state} blinkVisible={pomodoro.blinkVisible} />
        }
    }

    return (
        <div style={{
            ...panelStyle,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: 0,
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
                            color: i === activeTab ? 'var(--menu-primary)' : 'var(--menu-secondary)',
                            background: i === activeTab ? 'rgba(74, 222, 128, 0.1)' : 'transparent',
                            borderBottom: i === activeTab ? '2px solid var(--menu-primary)' : '2px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
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
                <K>NNN</K> back
            </div>
        </div>
    )
}

function K({ children }: { children: React.ReactNode }) {
    return <span style={{ color: 'var(--menu-primary)', fontWeight: 600 }}>{children}</span>
}
