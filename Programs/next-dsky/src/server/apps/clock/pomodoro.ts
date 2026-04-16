import type { PomodoroAppState } from '../../../types/serverState'

export const INITIAL_POMODORO: PomodoroAppState = {
    phase: 'idle', paused: false, endAt: 0, remaining: 25 * 60_000,
    workDuration: 25 * 60_000, breakDuration: 5 * 60_000,
    totalSessions: 3, completedSessions: 0,
    setupField: null, setupDigits: '',
}

let pomodoroTimer: ReturnType<typeof setTimeout> | null = null

export function cleanupPomodoro() {
    if (pomodoroTimer) { clearTimeout(pomodoroTimer); pomodoroTimer = null }
}

function applySetupValue(pomo: PomodoroAppState): PomodoroAppState {
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

function schedulePhaseEnd(
    ms: number,
    getPomo: () => PomodoroAppState,
    onUpdate: (pomo: PomodoroAppState) => void,
) {
    cleanupPomodoro()
    pomodoroTimer = setTimeout(() => {
        const pomo = getPomo()
        if (pomo.phase === 'work') {
            const newCompleted = pomo.completedSessions + 1
            if (newCompleted >= pomo.totalSessions) {
                onUpdate({ ...pomo, phase: 'done', remaining: 0, completedSessions: newCompleted, paused: false, endAt: 0 })
            } else {
                const endAt = Date.now() + pomo.breakDuration
                const next = { ...pomo, phase: 'break' as const, remaining: pomo.breakDuration, completedSessions: newCompleted, endAt }
                onUpdate(next)
                schedulePhaseEnd(pomo.breakDuration, getPomo, onUpdate)
            }
        } else if (pomo.phase === 'break') {
            const endAt = Date.now() + pomo.workDuration
            const next = { ...pomo, phase: 'work' as const, remaining: pomo.workDuration, endAt }
            onUpdate(next)
            schedulePhaseEnd(pomo.workDuration, getPomo, onUpdate)
        }
    }, ms)
}

export function handlePomodoroKey(
    pomo: PomodoroAppState,
    key: string,
    getPomo: () => PomodoroAppState,
    onUpdate: (pomo: PomodoroAppState) => void,
): PomodoroAppState {
    if (pomo.phase === 'idle') {
        if (key === 'p') {
            if (pomo.setupField === null) {
                return { ...pomo, setupField: 'work', setupDigits: '' }
            }
            const applied = applySetupValue(pomo)
            if (pomo.setupField === 'work') {
                return { ...applied, setupField: 'break', setupDigits: '' }
            } else if (pomo.setupField === 'break') {
                return { ...applied, setupField: 'sessions', setupDigits: '' }
            } else if (pomo.setupField === 'sessions') {
                const final = applySetupValue(pomo)
                return { ...final, setupField: null, setupDigits: '', remaining: final.workDuration }
            }
            return pomo
        }

        if (pomo.setupField !== null) {
            if (/^[0-9]$/.test(key)) {
                return { ...pomo, setupDigits: (pomo.setupDigits + key).slice(-2) }
            } else if (key === 'c') {
                return { ...pomo, setupDigits: pomo.setupDigits.slice(0, -1) }
            } else if (key === 'r') {
                return { ...pomo, setupField: null, setupDigits: '' }
            }
            return pomo
        }

        if (key === 'e') {
            const ms = pomo.workDuration
            const endAt = Date.now() + ms
            const next: PomodoroAppState = { ...pomo, phase: 'work', remaining: ms, paused: false, completedSessions: 0, endAt }
            schedulePhaseEnd(ms, getPomo, onUpdate)
            return next
        } else if (key === 'r') {
            return { ...INITIAL_POMODORO }
        }
    } else if (pomo.phase === 'work' || pomo.phase === 'break') {
        if (key === 'e') {
            if (pomo.paused) {
                const endAt = Date.now() + pomo.remaining
                schedulePhaseEnd(pomo.remaining, getPomo, onUpdate)
                return { ...pomo, paused: false, endAt }
            } else {
                cleanupPomodoro()
                const remaining = Math.max(0, pomo.endAt - Date.now())
                return { ...pomo, paused: true, remaining, endAt: 0 }
            }
        } else if (key === 'c' || key === 'r') {
            cleanupPomodoro()
            return { ...INITIAL_POMODORO }
        }
    } else if (pomo.phase === 'done') {
        cleanupPomodoro()
        return { ...INITIAL_POMODORO }
    }
    return pomo
}
