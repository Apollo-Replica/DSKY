"use client"

import { useState, useRef, useCallback, useEffect } from "react"

export interface StopwatchState {
    running: boolean
    elapsed: number       // milliseconds
    laps: number[]        // lap times in ms
}

const INITIAL: StopwatchState = {
    running: false,
    elapsed: 0,
    laps: [],
}

export function useStopwatch() {
    const [state, setState] = useState<StopwatchState>(INITIAL)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const startTimeRef = useRef<number>(0)
    const accumulatedRef = useRef<number>(0)
    const runningRef = useRef(false)

    const tick = useCallback(() => {
        setState(prev => ({
            ...prev,
            elapsed: accumulatedRef.current + (Date.now() - startTimeRef.current),
        }))
    }, [])

    const clearTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }, [])

    const handleKey = useCallback((key: string) => {
        if (key === 'e') {
            // ENTR: start/stop toggle
            if (runningRef.current) {
                // Stop
                clearTimer()
                accumulatedRef.current += Date.now() - startTimeRef.current
                runningRef.current = false
                setState(prev => ({
                    ...prev,
                    running: false,
                    elapsed: accumulatedRef.current,
                }))
            } else {
                // Start
                startTimeRef.current = Date.now()
                intervalRef.current = setInterval(tick, 32)
                runningRef.current = true
                setState(prev => ({ ...prev, running: true }))
            }
        } else if (key === 'c') {
            if (runningRef.current) {
                // Lap
                setState(prev => ({
                    ...prev,
                    laps: [...prev.laps, prev.elapsed],
                }))
            } else {
                // Reset
                clearTimer()
                accumulatedRef.current = 0
                runningRef.current = false
                setState(INITIAL)
            }
        }
    }, [tick, clearTimer])

    // Cleanup on unmount
    useEffect(() => {
        return () => clearTimer()
    }, [clearTimer])

    return { state, handleKey }
}
