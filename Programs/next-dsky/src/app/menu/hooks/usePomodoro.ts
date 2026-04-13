"use client"

import { useState, useRef, useCallback, useEffect } from "react"

export type PomodoroPhase = 'idle' | 'work' | 'break' | 'done'
export type SetupField = 'work' | 'break' | 'sessions' | null

export interface PomodoroState {
    phase: PomodoroPhase
    remaining: number           // ms remaining in current phase
    workDuration: number        // ms (default 25 min)
    breakDuration: number       // ms (default 5 min)
    totalSessions: number       // target sessions (default 3)
    completedSessions: number   // completed work sessions
    paused: boolean
    setupField: SetupField      // which field is being edited (blinks)
    setupDigits: string         // digits being entered during setup
}

const INITIAL: PomodoroState = {
    phase: 'idle',
    remaining: 25 * 60_000,
    workDuration: 25 * 60_000,
    breakDuration: 5 * 60_000,
    totalSessions: 3,
    completedSessions: 0,
    paused: false,
    setupField: null,
    setupDigits: '',
}

export function formatPomodoroMs(ms: number): string {
    const totalSec = Math.ceil(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function applySetupValue(prev: PomodoroState): PomodoroState {
    if (!prev.setupField || prev.setupDigits.length === 0) return prev

    const value = parseInt(prev.setupDigits)
    if (isNaN(value) || value <= 0) return prev

    switch (prev.setupField) {
        case 'work': {
            const ms = Math.min(Math.max(value, 1), 99) * 60_000
            return { ...prev, workDuration: ms, remaining: ms }
        }
        case 'break': {
            const ms = Math.min(Math.max(value, 1), 99) * 60_000
            return { ...prev, breakDuration: ms }
        }
        case 'sessions': {
            const n = Math.min(Math.max(value, 1), 99)
            return { ...prev, totalSessions: n }
        }
        default:
            return prev
    }
}

export function usePomodoro() {
    const [state, setState] = useState<PomodoroState>(INITIAL)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const endTimeRef = useRef<number>(0)
    const phaseRef = useRef<PomodoroPhase>('idle')
    const pausedRef = useRef(false)

    // Blink timer for setup field
    const blinkRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const [blinkVisible, setBlinkVisible] = useState(true)

    const clearTimer = useCallback(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }, [])

    const startBlink = useCallback(() => {
        if (blinkRef.current) clearInterval(blinkRef.current)
        setBlinkVisible(true)
        blinkRef.current = setInterval(() => {
            setBlinkVisible(prev => !prev)
        }, 400)
    }, [])

    const stopBlink = useCallback(() => {
        if (blinkRef.current) { clearInterval(blinkRef.current); blinkRef.current = null }
        setBlinkVisible(true)
    }, [])

    const tick = useCallback(() => {
        const remaining = endTimeRef.current - Date.now()
        if (remaining <= 0) {
            clearTimer()
            if (phaseRef.current === 'work') {
                // Work done → check if all sessions complete
                setState(prev => {
                    const newCompleted = prev.completedSessions + 1
                    if (newCompleted >= prev.totalSessions) {
                        // All sessions done
                        phaseRef.current = 'done'
                        pausedRef.current = false
                        return {
                            ...prev,
                            phase: 'done',
                            remaining: 0,
                            completedSessions: newCompleted,
                            paused: false,
                        }
                    }
                    // Start break
                    const breakMs = prev.breakDuration
                    endTimeRef.current = Date.now() + breakMs
                    intervalRef.current = setInterval(tick, 200)
                    phaseRef.current = 'break'
                    return {
                        ...prev,
                        phase: 'break',
                        remaining: breakMs,
                        completedSessions: newCompleted,
                    }
                })
            } else {
                // Break done → start next work session
                setState(prev => {
                    const workMs = prev.workDuration
                    endTimeRef.current = Date.now() + workMs
                    intervalRef.current = setInterval(tick, 200)
                    phaseRef.current = 'work'
                    return {
                        ...prev,
                        phase: 'work',
                        remaining: workMs,
                    }
                })
            }
        } else {
            setState(prev => ({ ...prev, remaining }))
        }
    }, [clearTimer])

    const resetToInitial = useCallback(() => {
        clearTimer()
        stopBlink()
        phaseRef.current = 'idle'
        pausedRef.current = false
        setState(INITIAL)
    }, [clearTimer, stopBlink])

    const handleKey = useCallback((key: string) => {
        const phase = phaseRef.current

        if (phase === 'idle') {
            setState(prev => {
                // Setup mode: PRO cycles through fields
                if (key === 'p') {
                    if (prev.setupField === null) {
                        // Enter setup → edit work
                        startBlink()
                        return { ...prev, setupField: 'work', setupDigits: '' }
                    }
                    // Apply current value and move to next field
                    const applied = applySetupValue(prev)
                    if (prev.setupField === 'work') {
                        return { ...applied, setupField: 'break', setupDigits: '' }
                    }
                    if (prev.setupField === 'break') {
                        return { ...applied, setupField: 'sessions', setupDigits: '' }
                    }
                    if (prev.setupField === 'sessions') {
                        // Exit setup
                        stopBlink()
                        const final = applySetupValue(prev)
                        return { ...final, setupField: null, setupDigits: '', remaining: final.workDuration }
                    }
                    return prev
                }

                // In setup mode: digit input
                if (prev.setupField !== null) {
                    if (/^[0-9]$/.test(key)) {
                        const newDigits = (prev.setupDigits + key).slice(-2)
                        return { ...prev, setupDigits: newDigits }
                    }
                    if (key === 'c') {
                        return { ...prev, setupDigits: prev.setupDigits.slice(0, -1) }
                    }
                    if (key === 'r') {
                        stopBlink()
                        return { ...prev, setupField: null, setupDigits: '' }
                    }
                    return prev
                }

                // Not in setup: ENTR starts
                if (key === 'e') {
                    const ms = prev.workDuration
                    endTimeRef.current = Date.now() + ms
                    intervalRef.current = setInterval(tick, 200)
                    phaseRef.current = 'work'
                    pausedRef.current = false
                    return { ...prev, phase: 'work', remaining: ms, paused: false, completedSessions: 0 }
                }
                if (key === 'r') {
                    clearTimer()
                    stopBlink()
                    phaseRef.current = 'idle'
                    pausedRef.current = false
                    return INITIAL
                }
                return prev
            })
        } else if (phase === 'work' || phase === 'break') {
            if (key === 'e') {
                if (pausedRef.current) {
                    setState(prev => {
                        endTimeRef.current = Date.now() + prev.remaining
                        intervalRef.current = setInterval(tick, 200)
                        pausedRef.current = false
                        return { ...prev, paused: false }
                    })
                } else {
                    clearTimer()
                    pausedRef.current = true
                    setState(prev => ({ ...prev, paused: true }))
                }
            } else if (key === 'c' || key === 'r') {
                resetToInitial()
            }
        } else if (phase === 'done') {
            // Any key resets
            resetToInitial()
        }
    }, [tick, clearTimer, startBlink, stopBlink, resetToInitial])

    useEffect(() => {
        return () => {
            clearTimer()
            stopBlink()
        }
    }, [clearTimer, stopBlink])

    return { state, handleKey, blinkVisible }
}
