/**
 * Server-side clock app.
 * Orchestrates stopwatch, countdown, alarm, and pomodoro modes.
 * Each mode lives in its own module under clock/.
 */

import type { ClockAppState } from '../../types/serverState'
import { INITIAL_STOPWATCH, handleStopwatchKey } from './clock/stopwatch'
import { INITIAL_COUNTDOWN, handleCountdownKey, cleanupCountdown } from './clock/countdown'
import { INITIAL_ALARM, handleAlarmKey } from './clock/alarm'
import { INITIAL_POMODORO, handlePomodoroKey, cleanupPomodoro } from './clock/pomodoro'

const TABS = ['STOP', 'COUNT', 'ALARM', 'POMO'] as const

let state: ClockAppState
let alarmCheckInterval: ReturnType<typeof setInterval> | null = null
let onStateChange: (() => void) | null = null

// --- Init / Cleanup ---

export function initClock(broadcastFn: () => void): ClockAppState {
    cleanup()
    onStateChange = broadcastFn
    state = {
        activeTab: 0,
        stopwatch: { ...INITIAL_STOPWATCH },
        countdown: { ...INITIAL_COUNTDOWN },
        alarm: { ...INITIAL_ALARM },
        pomodoro: { ...INITIAL_POMODORO },
    }
    startAlarmCheck()
    return state
}

export function cleanup() {
    cleanupCountdown()
    cleanupPomodoro()
    if (alarmCheckInterval) { clearInterval(alarmCheckInterval); alarmCheckInterval = null }
    onStateChange = null
}

export function getClockState(): ClockAppState {
    return state
}

function broadcast() {
    onStateChange?.()
}

// --- Alarm check (runs every second) ---

function getCurrentHHMM(): string {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function startAlarmCheck() {
    if (alarmCheckInterval) clearInterval(alarmCheckInterval)
    alarmCheckInterval = setInterval(() => {
        const a = state.alarm
        if (a.armed && a.alarmTime && !a.triggered && getCurrentHHMM() === a.alarmTime) {
            state = { ...state, alarm: { ...a, triggered: true } }
            broadcast()
        }
    }, 1000)
}

// --- Key handling ---

export function handleClockKey(key: string): ClockAppState {
    if (key === '-') {
        state = { ...state, activeTab: (state.activeTab + 1) % TABS.length }
        broadcast()
        return state
    }
    if (key === '+') {
        state = { ...state, activeTab: (state.activeTab - 1 + TABS.length) % TABS.length }
        broadcast()
        return state
    }

    switch (TABS[state.activeTab]) {
        case 'STOP':
            state = { ...state, stopwatch: handleStopwatchKey(state.stopwatch, key) }
            break
        case 'COUNT':
            state = {
                ...state,
                countdown: handleCountdownKey(state.countdown, key, (cd) => {
                    state = { ...state, countdown: cd }
                    broadcast()
                }),
            }
            break
        case 'ALARM':
            state = { ...state, alarm: handleAlarmKey(state.alarm, key) }
            break
        case 'POMO':
            state = {
                ...state,
                pomodoro: handlePomodoroKey(
                    state.pomodoro,
                    key,
                    () => state.pomodoro,
                    (pomo) => { state = { ...state, pomodoro: pomo }; broadcast() },
                ),
            }
            break
    }

    broadcast()
    return state
}
