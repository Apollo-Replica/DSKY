import type { CountdownAppState } from '../../../types/serverState'

export const INITIAL_COUNTDOWN: CountdownAppState = {
    phase: 'setup', inputDigits: '', endAt: 0, totalMs: 0, remaining: 0,
}

function digitsToMs(digits: string): number {
    const padded = digits.padStart(6, '0')
    const h = parseInt(padded.slice(0, 2))
    const m = parseInt(padded.slice(2, 4))
    const s = parseInt(padded.slice(4, 6))
    return (h * 3600 + m * 60 + s) * 1000
}

let countdownTimer: ReturnType<typeof setTimeout> | null = null

export function cleanupCountdown() {
    if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null }
}

export function handleCountdownKey(
    cd: CountdownAppState,
    key: string,
    onDone: (cd: CountdownAppState) => void,
): CountdownAppState {
    if (cd.phase === 'setup') {
        if (/^[0-9]$/.test(key)) {
            return { ...cd, inputDigits: (cd.inputDigits + key).slice(-6) }
        } else if (key === 'c') {
            return { ...cd, inputDigits: cd.inputDigits.slice(0, -1) }
        } else if (key === 'r') {
            return { ...INITIAL_COUNTDOWN }
        } else if (key === 'e' && cd.inputDigits.length > 0) {
            const totalMs = digitsToMs(cd.inputDigits)
            if (totalMs <= 0) return cd
            const endAt = Date.now() + totalMs
            const next: CountdownAppState = { ...cd, phase: 'running', remaining: totalMs, totalMs, endAt }
            scheduleCountdownEnd(totalMs, onDone)
            return next
        }
    } else if (cd.phase === 'running') {
        if (key === 'e') {
            cleanupCountdown()
            const remaining = Math.max(0, cd.endAt - Date.now())
            return { ...cd, phase: 'paused', remaining, endAt: 0 }
        } else if (key === 'c') {
            cleanupCountdown()
            return { ...INITIAL_COUNTDOWN }
        }
    } else if (cd.phase === 'paused') {
        if (key === 'e') {
            const endAt = Date.now() + cd.remaining
            scheduleCountdownEnd(cd.remaining, onDone)
            return { ...cd, phase: 'running', endAt }
        } else if (key === 'c') {
            return { ...INITIAL_COUNTDOWN }
        }
    } else if (cd.phase === 'done') {
        return { ...INITIAL_COUNTDOWN }
    }
    return cd
}

function scheduleCountdownEnd(ms: number, onDone: (cd: CountdownAppState) => void) {
    cleanupCountdown()
    countdownTimer = setTimeout(() => {
        onDone({ ...INITIAL_COUNTDOWN, phase: 'done', remaining: 0, endAt: 0, totalMs: 0, inputDigits: '' })
    }, ms)
}
