/**
 * Server-side clock app.
 * Manages stopwatch, countdown, alarm, and pomodoro modes.
 * Uses timestamps (not intervals) — clients interpolate for smooth display.
 */

import type { ClockAppState, StopwatchAppState, CountdownAppState, AlarmAppState, PomodoroAppState } from '../../types/serverState'

const TABS = ['STOP', 'COUNT', 'ALARM', 'POMO'] as const

// --- Initial states ---

const INITIAL_STOPWATCH: StopwatchAppState = {
    running: false, startedAt: 0, accumulated: 0, laps: [],
}

const INITIAL_COUNTDOWN: CountdownAppState = {
    phase: 'setup', inputDigits: '', endAt: 0, totalMs: 0, remaining: 0,
}

const INITIAL_ALARM: AlarmAppState = {
    armed: false, triggered: false, alarmTime: null, inputDigits: '',
}

const INITIAL_POMODORO: PomodoroAppState = {
    phase: 'idle', paused: false, endAt: 0, remaining: 25 * 60_000,
    workDuration: 25 * 60_000, breakDuration: 5 * 60_000,
    totalSessions: 3, completedSessions: 0,
    setupField: null, setupDigits: '',
}

let state: ClockAppState

// Timers for server-side phase transitions
let countdownTimer: ReturnType<typeof setTimeout> | null = null
let pomodoroTimer: ReturnType<typeof setTimeout> | null = null
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
    if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null }
    if (pomodoroTimer) { clearTimeout(pomodoroTimer); pomodoroTimer = null }
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
    // Tab switching with +/-
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

    // Delegate to active mode
    switch (TABS[state.activeTab]) {
        case 'STOP':  handleStopwatchKey(key); break
        case 'COUNT': handleCountdownKey(key); break
        case 'ALARM': handleAlarmKey(key); break
        case 'POMO':  handlePomodoroKey(key); break
    }

    broadcast()
    return state
}

// --- Stopwatch ---

function handleStopwatchKey(key: string) {
    const sw = state.stopwatch

    if (key === 'e') {
        if (sw.running) {
            // Stop
            const accumulated = sw.accumulated + (Date.now() - sw.startedAt)
            state = { ...state, stopwatch: { ...sw, running: false, startedAt: 0, accumulated } }
        } else {
            // Start
            state = { ...state, stopwatch: { ...sw, running: true, startedAt: Date.now() } }
        }
    } else if (key === 'c') {
        if (sw.running) {
            // Lap
            const elapsed = sw.accumulated + (Date.now() - sw.startedAt)
            state = { ...state, stopwatch: { ...sw, laps: [...sw.laps, elapsed] } }
        } else {
            // Reset
            state = { ...state, stopwatch: { ...INITIAL_STOPWATCH } }
        }
    }
}

// --- Countdown ---

function digitsToMs(digits: string): number {
    const padded = digits.padStart(6, '0')
    const h = parseInt(padded.slice(0, 2))
    const m = parseInt(padded.slice(2, 4))
    const s = parseInt(padded.slice(4, 6))
    return (h * 3600 + m * 60 + s) * 1000
}

function scheduleCountdownEnd(ms: number) {
    if (countdownTimer) clearTimeout(countdownTimer)
    countdownTimer = setTimeout(() => {
        state = { ...state, countdown: { ...state.countdown, phase: 'done', remaining: 0, endAt: 0 } }
        broadcast()
    }, ms)
}

function handleCountdownKey(key: string) {
    const cd = state.countdown

    if (cd.phase === 'setup') {
        if (/^[0-9]$/.test(key)) {
            state = { ...state, countdown: { ...cd, inputDigits: (cd.inputDigits + key).slice(-6) } }
        } else if (key === 'c') {
            state = { ...state, countdown: { ...cd, inputDigits: cd.inputDigits.slice(0, -1) } }
        } else if (key === 'r') {
            state = { ...state, countdown: { ...INITIAL_COUNTDOWN } }
        } else if (key === 'e' && cd.inputDigits.length > 0) {
            const totalMs = digitsToMs(cd.inputDigits)
            if (totalMs <= 0) return
            const endAt = Date.now() + totalMs
            state = { ...state, countdown: { ...cd, phase: 'running', remaining: totalMs, totalMs, endAt } }
            scheduleCountdownEnd(totalMs)
        }
    } else if (cd.phase === 'running') {
        if (key === 'e') {
            // Pause
            if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null }
            const remaining = Math.max(0, cd.endAt - Date.now())
            state = { ...state, countdown: { ...cd, phase: 'paused', remaining, endAt: 0 } }
        } else if (key === 'c') {
            if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null }
            state = { ...state, countdown: { ...INITIAL_COUNTDOWN } }
        }
    } else if (cd.phase === 'paused') {
        if (key === 'e') {
            // Resume
            const endAt = Date.now() + cd.remaining
            state = { ...state, countdown: { ...cd, phase: 'running', endAt } }
            scheduleCountdownEnd(cd.remaining)
        } else if (key === 'c') {
            state = { ...state, countdown: { ...INITIAL_COUNTDOWN } }
        }
    } else if (cd.phase === 'done') {
        state = { ...state, countdown: { ...INITIAL_COUNTDOWN } }
    }
}

// --- Alarm ---

function handleAlarmKey(key: string) {
    const a = state.alarm

    if (a.triggered) {
        // Any key dismisses
        state = { ...state, alarm: { ...INITIAL_ALARM } }
        return
    }

    if (a.armed) {
        if (key === 'c' || key === 'r') {
            state = { ...state, alarm: { ...INITIAL_ALARM } }
        }
        return
    }

    // Setting alarm
    if (/^[0-9]$/.test(key)) {
        state = { ...state, alarm: { ...a, inputDigits: (a.inputDigits + key).slice(-4) } }
    } else if (key === 'c') {
        state = { ...state, alarm: { ...a, inputDigits: a.inputDigits.slice(0, -1) } }
    } else if (key === 'r') {
        state = { ...state, alarm: { ...a, inputDigits: '' } }
    } else if (key === 'e' && a.inputDigits.length > 0) {
        const padded = a.inputDigits.padStart(4, '0')
        const h = parseInt(padded.slice(0, 2))
        const m = parseInt(padded.slice(2, 4))
        if (h > 23 || m > 59) return
        const alarmTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        state = { ...state, alarm: { ...a, armed: true, alarmTime } }
    }
}

// --- Pomodoro ---

function applyPomodoroSetupValue(pomo: PomodoroAppState): PomodoroAppState {
    if (!pomo.setupField || pomo.setupDigits.length === 0) return pomo
    const value = parseInt(pomo.setupDigits)
    if (isNaN(value) || value <= 0) return pomo

    switch (pomo.setupField) {
        case 'work': {
            const ms = Math.min(Math.max(value, 1), 99) * 60_000
            return { ...pomo, workDuration: ms, remaining: ms }
        }
        case 'break': {
            const ms = Math.min(Math.max(value, 1), 99) * 60_000
            return { ...pomo, breakDuration: ms }
        }
        case 'sessions': {
            const n = Math.min(Math.max(value, 1), 99)
            return { ...pomo, totalSessions: n }
        }
        default: return pomo
    }
}

function schedulePomodoroEnd(ms: number) {
    if (pomodoroTimer) clearTimeout(pomodoroTimer)
    pomodoroTimer = setTimeout(() => {
        const pomo = state.pomodoro
        if (pomo.phase === 'work') {
            const newCompleted = pomo.completedSessions + 1
            if (newCompleted >= pomo.totalSessions) {
                state = { ...state, pomodoro: { ...pomo, phase: 'done', remaining: 0, completedSessions: newCompleted, paused: false, endAt: 0 } }
            } else {
                // Start break
                const endAt = Date.now() + pomo.breakDuration
                state = { ...state, pomodoro: { ...pomo, phase: 'break', remaining: pomo.breakDuration, completedSessions: newCompleted, endAt } }
                schedulePomodoroEnd(pomo.breakDuration)
            }
        } else if (pomo.phase === 'break') {
            // Start next work session
            const endAt = Date.now() + pomo.workDuration
            state = { ...state, pomodoro: { ...pomo, phase: 'work', remaining: pomo.workDuration, endAt } }
            schedulePomodoroEnd(pomo.workDuration)
        }
        broadcast()
    }, ms)
}

function handlePomodoroKey(key: string) {
    const pomo = state.pomodoro

    if (pomo.phase === 'idle') {
        if (key === 'p') {
            if (pomo.setupField === null) {
                state = { ...state, pomodoro: { ...pomo, setupField: 'work', setupDigits: '' } }
                return
            }
            const applied = applyPomodoroSetupValue(pomo)
            if (pomo.setupField === 'work') {
                state = { ...state, pomodoro: { ...applied, setupField: 'break', setupDigits: '' } }
            } else if (pomo.setupField === 'break') {
                state = { ...state, pomodoro: { ...applied, setupField: 'sessions', setupDigits: '' } }
            } else if (pomo.setupField === 'sessions') {
                const final = applyPomodoroSetupValue(pomo)
                state = { ...state, pomodoro: { ...final, setupField: null, setupDigits: '', remaining: final.workDuration } }
            }
            return
        }

        if (pomo.setupField !== null) {
            if (/^[0-9]$/.test(key)) {
                state = { ...state, pomodoro: { ...pomo, setupDigits: (pomo.setupDigits + key).slice(-2) } }
            } else if (key === 'c') {
                state = { ...state, pomodoro: { ...pomo, setupDigits: pomo.setupDigits.slice(0, -1) } }
            } else if (key === 'r') {
                state = { ...state, pomodoro: { ...pomo, setupField: null, setupDigits: '' } }
            }
            return
        }

        if (key === 'e') {
            const ms = pomo.workDuration
            const endAt = Date.now() + ms
            state = { ...state, pomodoro: { ...pomo, phase: 'work', remaining: ms, paused: false, completedSessions: 0, endAt } }
            schedulePomodoroEnd(ms)
        } else if (key === 'r') {
            state = { ...state, pomodoro: { ...INITIAL_POMODORO } }
        }
    } else if (pomo.phase === 'work' || pomo.phase === 'break') {
        if (key === 'e') {
            if (pomo.paused) {
                // Resume
                const endAt = Date.now() + pomo.remaining
                state = { ...state, pomodoro: { ...pomo, paused: false, endAt } }
                schedulePomodoroEnd(pomo.remaining)
            } else {
                // Pause
                if (pomodoroTimer) { clearTimeout(pomodoroTimer); pomodoroTimer = null }
                const remaining = Math.max(0, pomo.endAt - Date.now())
                state = { ...state, pomodoro: { ...pomo, paused: true, remaining, endAt: 0 } }
            }
        } else if (key === 'c' || key === 'r') {
            if (pomodoroTimer) { clearTimeout(pomodoroTimer); pomodoroTimer = null }
            state = { ...state, pomodoro: { ...INITIAL_POMODORO } }
        }
    } else if (pomo.phase === 'done') {
        if (pomodoroTimer) { clearTimeout(pomodoroTimer); pomodoroTimer = null }
        state = { ...state, pomodoro: { ...INITIAL_POMODORO } }
    }
}
