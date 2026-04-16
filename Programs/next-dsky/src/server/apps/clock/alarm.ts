import type { AlarmAppState } from '../../../types/serverState'

export const INITIAL_ALARM: AlarmAppState = {
    armed: false, triggered: false, alarmTime: null, inputDigits: '',
}

export function handleAlarmKey(a: AlarmAppState, key: string): AlarmAppState {
    if (a.triggered) {
        return { ...INITIAL_ALARM }
    }

    if (a.armed) {
        if (key === 'c' || key === 'r') {
            return { ...INITIAL_ALARM }
        }
        return a
    }

    // Setting alarm
    if (/^[0-9]$/.test(key)) {
        return { ...a, inputDigits: (a.inputDigits + key).slice(-4) }
    } else if (key === 'c') {
        return { ...a, inputDigits: a.inputDigits.slice(0, -1) }
    } else if (key === 'r') {
        return { ...a, inputDigits: '' }
    } else if (key === 'e' && a.inputDigits.length > 0) {
        const padded = a.inputDigits.padStart(4, '0')
        const h = parseInt(padded.slice(0, 2))
        const m = parseInt(padded.slice(2, 4))
        if (h > 23 || m > 59) return a
        const alarmTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        return { ...a, armed: true, alarmTime }
    }
    return a
}
