import type { StopwatchAppState } from '../../../types/serverState'

export const INITIAL_STOPWATCH: StopwatchAppState = {
    running: false, startedAt: 0, accumulated: 0, laps: [],
}

export function handleStopwatchKey(sw: StopwatchAppState, key: string): StopwatchAppState {
    if (key === 'e') {
        if (sw.running) {
            const accumulated = sw.accumulated + (Date.now() - sw.startedAt)
            return { ...sw, running: false, startedAt: 0, accumulated }
        } else {
            return { ...sw, running: true, startedAt: Date.now() }
        }
    } else if (key === 'c') {
        if (sw.running) {
            const elapsed = sw.accumulated + (Date.now() - sw.startedAt)
            return { ...sw, laps: [...sw.laps, elapsed] }
        } else {
            return { ...INITIAL_STOPWATCH }
        }
    }
    return sw
}
