"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface AlarmModeProps {
    onRegisterKeyHandler: (handler: (key: string) => void) => void
}

interface AlarmState {
    currentTime: string
    inputDigits: string    // HHMM being entered
    alarmTime: string | null  // "HH:MM" when set
    armed: boolean
    triggered: boolean
    flash: boolean
}

function getCurrentTimeStr(): string {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
}

function formatInputDigits(digits: string): string {
    const padded = digits.padStart(4, '0')
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`
}

function getCurrentHHMM(): string {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function AlarmMode({ onRegisterKeyHandler }: AlarmModeProps) {
    const [state, setState] = useState<AlarmState>({
        currentTime: getCurrentTimeStr(),
        inputDigits: '',
        alarmTime: null,
        armed: false,
        triggered: false,
        flash: false,
    })

    const flashRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const triggeredRef = useRef(false)

    const clearFlash = useCallback(() => {
        if (flashRef.current) { clearInterval(flashRef.current); flashRef.current = null }
    }, [])

    const startFlash = useCallback(() => {
        clearFlash()
        flashRef.current = setInterval(() => {
            setState(p => ({ ...p, flash: !p.flash }))
        }, 500)
    }, [clearFlash])

    // Update current time every second and check alarm
    useEffect(() => {
        const interval = setInterval(() => {
            const now = getCurrentTimeStr()
            const currentHHMM = getCurrentHHMM()

            setState(prev => {
                if (prev.armed && prev.alarmTime && !prev.triggered && currentHHMM === prev.alarmTime) {
                    triggeredRef.current = true
                    return { ...prev, currentTime: now, triggered: true }
                }
                return { ...prev, currentTime: now }
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    // Start/stop flash based on triggered state
    useEffect(() => {
        if (state.triggered && !flashRef.current) {
            startFlash()
        } else if (!state.triggered) {
            clearFlash()
        }
    }, [state.triggered, startFlash, clearFlash])

    const handleKey = useCallback((key: string) => {
        if (triggeredRef.current) {
            // Any key dismisses alarm
            triggeredRef.current = false
            clearFlash()
            setState(prev => ({
                ...prev,
                triggered: false,
                armed: false,
                flash: false,
                alarmTime: null,
                inputDigits: '',
            }))
            return
        }

        setState(prev => {
            if (prev.armed) {
                if (key === 'c' || key === 'r') {
                    return { ...prev, armed: false, alarmTime: null, inputDigits: '' }
                }
                return prev
            }

            // Setting alarm
            if (/^[0-9]$/.test(key)) {
                const newDigits = (prev.inputDigits + key).slice(-4)
                return { ...prev, inputDigits: newDigits }
            }
            if (key === 'c') {
                return { ...prev, inputDigits: prev.inputDigits.slice(0, -1) }
            }
            if (key === 'r') {
                return { ...prev, inputDigits: '' }
            }
            if (key === 'e' && prev.inputDigits.length > 0) {
                const padded = prev.inputDigits.padStart(4, '0')
                const h = parseInt(padded.slice(0, 2))
                const m = parseInt(padded.slice(2, 4))
                if (h > 23 || m > 59) return prev
                const alarmTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                return { ...prev, armed: true, alarmTime }
            }
            return prev
        })
    }, [clearFlash])

    // Register key handler
    useEffect(() => {
        onRegisterKeyHandler(handleKey)
    }, [onRegisterKeyHandler, handleKey])

    // Cleanup all timers on unmount
    useEffect(() => {
        return () => clearFlash()
    }, [clearFlash])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Current time */}
            <div style={{
                fontSize: '2.5cqh',
                color: 'var(--menu-secondary)',
                textAlign: 'center',
            }}>
                NOW
            </div>
            <div style={{
                fontSize: '6cqh',
                color: 'var(--menu-primary)',
                textAlign: 'center',
                fontWeight: 700,
                fontFamily: 'monospace',
            }}>
                {state.currentTime}
            </div>

            {/* Alarm display */}
            <div style={{
                borderTop: '1px solid var(--menu-border)',
                marginTop: '1.5cqh',
                paddingTop: '1.5cqh',
            }}>
                <div style={{
                    fontSize: '2.5cqh',
                    color: state.triggered ? '#f87171' : state.armed ? '#4ade80' : 'var(--menu-secondary)',
                    textAlign: 'center',
                }}>
                    {state.triggered ? 'ALARM!' : state.armed ? 'ARMED' : 'SET ALARM (HHMM)'}
                </div>
                <div style={{
                    fontSize: '5cqh',
                    color: state.triggered
                        ? (state.flash ? '#f87171' : 'transparent')
                        : state.armed ? 'var(--menu-accent)' : 'var(--menu-primary)',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    padding: '1cqh 0',
                    transition: 'color 0.15s',
                }}>
                    {state.armed || state.triggered
                        ? state.alarmTime
                        : formatInputDigits(state.inputDigits)}
                </div>
            </div>

            {/* Hints */}
            <div style={{
                fontSize: '2.2cqh',
                color: 'var(--menu-secondary)',
                textAlign: 'center',
                marginTop: 'auto',
            }}>
                {state.triggered ? (
                    <span>any key to dismiss</span>
                ) : state.armed ? (
                    <><K>CLR</K> disarm</>
                ) : (
                    <>
                        <K>0-9</K> time{' \u00A0 '}
                        <K>ENTR</K> arm{' \u00A0 '}
                        <K>CLR</K> del
                    </>
                )}
            </div>
        </div>
    )
}

function K({ children }: { children: React.ReactNode }) {
    return <span style={{ color: 'var(--menu-primary)', fontWeight: 600 }}>{children}</span>
}
