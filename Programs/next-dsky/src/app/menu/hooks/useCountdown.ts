"use client"

import { useState, useRef, useCallback, useEffect } from "react"

export type CountdownPhase = 'setup' | 'running' | 'paused' | 'done'

export interface CountdownState {
    phase: CountdownPhase
    inputDigits: string     // digits entered during setup (HHMMSS)
    remaining: number       // ms remaining
    totalMs: number         // total countdown time in ms
    flash: boolean          // visual flash when done
}

const INITIAL: CountdownState = {
    phase: 'setup',
    inputDigits: '',
    remaining: 0,
    totalMs: 0,
    flash: false,
}

function digitsToMs(digits: string): number {
    const padded = digits.padStart(6, '0')
    const h = parseInt(padded.slice(0, 2))
    const m = parseInt(padded.slice(2, 4))
    const s = parseInt(padded.slice(4, 6))
    return (h * 3600 + m * 60 + s) * 1000
}

export function formatDigitsAsTime(digits: string): string {
    const padded = digits.padStart(6, '0')
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`
}

export function formatMs(ms: number): string {
    const totalSec = Math.ceil(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function useCountdown() {
    const [state, setState] = useState<CountdownState>(INITIAL)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const endTimeRef = useRef<number>(0)
    const flashRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const phaseRef = useRef<CountdownPhase>('setup')

    const clearTimers = useCallback(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
        if (flashRef.current) { clearInterval(flashRef.current); flashRef.current = null }
    }, [])

    const tick = useCallback(() => {
        const remaining = endTimeRef.current - Date.now()
        if (remaining <= 0) {
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
            phaseRef.current = 'done'
            flashRef.current = setInterval(() => {
                setState(prev => ({ ...prev, flash: !prev.flash }))
            }, 500)
            setState(prev => ({ ...prev, phase: 'done', remaining: 0 }))
        } else {
            setState(prev => ({ ...prev, remaining }))
        }
    }, [])

    const resetToInitial = useCallback(() => {
        clearTimers()
        phaseRef.current = 'setup'
        setState(INITIAL)
    }, [clearTimers])

    const handleKey = useCallback((key: string) => {
        const phase = phaseRef.current

        if (phase === 'setup') {
            if (/^[0-9]$/.test(key)) {
                setState(prev => {
                    const newDigits = (prev.inputDigits + key).slice(-6)
                    return { ...prev, inputDigits: newDigits }
                })
            } else if (key === 'c') {
                setState(prev => ({ ...prev, inputDigits: prev.inputDigits.slice(0, -1) }))
            } else if (key === 'r') {
                resetToInitial()
            } else if (key === 'e') {
                setState(prev => {
                    if (prev.inputDigits.length === 0) return prev
                    const totalMs = digitsToMs(prev.inputDigits)
                    if (totalMs <= 0) return prev
                    endTimeRef.current = Date.now() + totalMs
                    intervalRef.current = setInterval(tick, 100)
                    phaseRef.current = 'running'
                    return { ...prev, phase: 'running', remaining: totalMs, totalMs }
                })
            }
        } else if (phase === 'running') {
            if (key === 'e') {
                // Pause
                clearTimers()
                phaseRef.current = 'paused'
                setState(prev => ({ ...prev, phase: 'paused' }))
            } else if (key === 'c') {
                resetToInitial()
            }
        } else if (phase === 'paused') {
            if (key === 'e') {
                // Resume
                setState(prev => {
                    endTimeRef.current = Date.now() + prev.remaining
                    intervalRef.current = setInterval(tick, 100)
                    phaseRef.current = 'running'
                    return { ...prev, phase: 'running' }
                })
            } else if (key === 'c') {
                resetToInitial()
            }
        } else if (phase === 'done') {
            resetToInitial()
        }
    }, [tick, clearTimers, resetToInitial])

    useEffect(() => {
        return () => clearTimers()
    }, [clearTimers])

    return { state, handleKey }
}
