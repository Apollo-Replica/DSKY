/**
 * Games hub — dispatches key input to the active sub-game and runs the tick loop.
 * Pattern mirrors clockApp.ts (multi-tab internal dispatch).
 */

import type { GamesAppState, GameId } from '../../types/serverState'
import { INITIAL_FLAPPY, handleFlappyKey, tickFlappy, resetFlappy } from './games/flappy'

const GAME_LIST: { id: GameId; label: string }[] = [
    { id: 'flappy', label: 'FLAPPY ROCKET' },
]

const TICK_MS = 33  // ~30 Hz server authority; client interpolates at RAF

let state: GamesAppState
let tickInterval: ReturnType<typeof setInterval> | null = null
let lastTickMs = 0
let onStateChange: ((s: GamesAppState) => void) | null = null

export function initGames(onChange: (s: GamesAppState) => void): GamesAppState {
    cleanup()
    onStateChange = onChange
    state = {
        activeGame: null,
        selectorIndex: 0,
        flappy: { ...INITIAL_FLAPPY, tickMs: Date.now() },
    }
    return state
}

export function cleanup() {
    stopTicker()
    onStateChange = null
}

export function getGamesState(): GamesAppState {
    return state
}

function broadcast() {
    onStateChange?.(state)
}

function startTicker() {
    if (tickInterval) return
    // Use performance.now() — monotonic clock, immune to NTP/system time
    // changes. Date.now() produced negative dt after NTP adjustments, warping
    // the ship out of bounds and triggering fake game overs.
    lastTickMs = performance.now()
    tickInterval = setInterval(() => {
        if (!state || state.activeGame !== 'flappy') { stopTicker(); return }
        const now = performance.now()
        const raw = (now - lastTickMs) / 1000
        // Clamp to prevent tunneling if the event loop stalled.
        const dt = raw > 0.05 ? 0.05 : raw < 0 ? 0 : raw
        lastTickMs = now
        const next = tickFlappy(state.flappy, dt)
        state = { ...state, flappy: next }
        if (next.phase === 'gameover') stopTicker()
        broadcast()
    }, TICK_MS)
}

function stopTicker() {
    if (tickInterval) {
        clearInterval(tickInterval)
        tickInterval = null
    }
}

export function handleGamesKey(key: string): GamesAppState {
    if (!state) return state

    // Selector screen
    if (state.activeGame === null) {
        if (key === '-') {
            state = { ...state, selectorIndex: (state.selectorIndex + 1) % GAME_LIST.length }
            broadcast()
            return state
        }
        if (key === '+') {
            state = { ...state, selectorIndex: (state.selectorIndex - 1 + GAME_LIST.length) % GAME_LIST.length }
            broadcast()
            return state
        }
        if (key === 'e') {
            const selected = GAME_LIST[state.selectorIndex]
            if (selected.id === 'flappy') {
                state = { ...state, activeGame: 'flappy', flappy: resetFlappy(state.flappy.best) }
            }
            broadcast()
            return state
        }
        return state
    }

    // Active game
    if (state.activeGame === 'flappy') {
        // RSET from within a game returns to the selector.
        if (key === 'r') {
            stopTicker()
            state = { ...state, activeGame: null, flappy: resetFlappy(state.flappy.best) }
            broadcast()
            return state
        }

        const nextFlappy = handleFlappyKey(state.flappy, key)
        state = { ...state, flappy: nextFlappy }
        if (nextFlappy.phase === 'playing') startTicker()
        else stopTicker()
        broadcast()
        return state
    }

    return state
}

export function getGameList() {
    return GAME_LIST
}
