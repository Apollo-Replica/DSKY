/**
 * Games hub — dispatches key input to the active sub-game and runs the tick loop.
 * Pattern mirrors clockApp.ts (multi-tab internal dispatch).
 */

import type { GamesAppState, GameId } from '../../types/serverState'
import { INITIAL_FLAPPY, handleFlappyKey, tickFlappy, resetFlappy } from './games/flappy'
import { INITIAL_TETRIS, handleTetrisKey, tickTetris, resetTetris } from './games/tetris'
import { INITIAL_SNAKE, handleSnakeKey, tickSnake, resetSnake } from './games/snake'
import { INITIAL_2048, handle2048Key, reset2048 } from './games/game2048'
import { INITIAL_MINESWEEPER, handleMinesweeperKey, resetMinesweeper } from './games/minesweeper'

const GAME_LIST: { id: GameId; label: string }[] = [
    { id: 'flappy', label: 'FLAPPY ROCKET' },
    { id: 'tetris', label: 'TETRIS' },
    { id: 'snake', label: 'SNAKE' },
    { id: 'game2048', label: '2048' },
    { id: 'minesweeper', label: 'MINESWEEPER' },
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
        tetris: { ...INITIAL_TETRIS, tickMs: Date.now() },
        snake: { ...INITIAL_SNAKE, tickMs: Date.now() },
        game2048: { ...INITIAL_2048 },
        minesweeper: { ...INITIAL_MINESWEEPER },
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
        if (!state) { stopTicker(); return }
        const now = performance.now()
        const raw = (now - lastTickMs) / 1000
        // Clamp to prevent tunneling if the event loop stalled.
        const dt = raw > 0.05 ? 0.05 : raw < 0 ? 0 : raw
        lastTickMs = now
        if (state.activeGame === 'flappy') {
            const next = tickFlappy(state.flappy, dt)
            state = { ...state, flappy: next }
            if (next.phase === 'gameover') stopTicker()
        } else if (state.activeGame === 'tetris') {
            const next = tickTetris(state.tetris, dt)
            state = { ...state, tetris: next }
            if (next.phase === 'gameover') stopTicker()
        } else if (state.activeGame === 'snake') {
            const next = tickSnake(state.snake, dt)
            state = { ...state, snake: next }
            if (next.phase === 'gameover') stopTicker()
        } else {
            // 2048 and minesweeper are purely input-driven — no tick.
            stopTicker()
            return
        }
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
            } else if (selected.id === 'tetris') {
                state = { ...state, activeGame: 'tetris', tetris: resetTetris(state.tetris.best) }
            } else if (selected.id === 'snake') {
                state = { ...state, activeGame: 'snake', snake: resetSnake(state.snake.best) }
            } else if (selected.id === 'game2048') {
                state = { ...state, activeGame: 'game2048', game2048: reset2048(state.game2048.best) }
            } else if (selected.id === 'minesweeper') {
                state = { ...state, activeGame: 'minesweeper', minesweeper: resetMinesweeper(state.minesweeper.bestTimeSec) }
            }
            broadcast()
            return state
        }
        return state
    }

    // RSET from within any game returns to the selector and resets that game's
    // state (preserving the best score).
    if (key === 'r') {
        stopTicker()
        state = resetActiveGameToSelector(state)
        broadcast()
        return state
    }

    // Per-game input handling. Tick-driven games (flappy/tetris/snake) start
    // or stop the ticker based on the new phase; input-driven games don't
    // need a ticker.
    if (state.activeGame === 'flappy') {
        const next = handleFlappyKey(state.flappy, key)
        state = { ...state, flappy: next }
        if (next.phase === 'playing') startTicker()
        else stopTicker()
    } else if (state.activeGame === 'tetris') {
        const next = handleTetrisKey(state.tetris, key)
        state = { ...state, tetris: next }
        // 'clearing' needs the ticker running so the blink timer advances.
        if (next.phase === 'playing' || next.phase === 'clearing') startTicker()
        else stopTicker()
    } else if (state.activeGame === 'snake') {
        const next = handleSnakeKey(state.snake, key)
        state = { ...state, snake: next }
        if (next.phase === 'playing') startTicker()
        else stopTicker()
    } else if (state.activeGame === 'game2048') {
        state = { ...state, game2048: handle2048Key(state.game2048, key) }
    } else if (state.activeGame === 'minesweeper') {
        state = { ...state, minesweeper: handleMinesweeperKey(state.minesweeper, key) }
    }

    broadcast()
    return state
}

function resetActiveGameToSelector(s: GamesAppState): GamesAppState {
    const base = { ...s, activeGame: null as GameId | null }
    switch (s.activeGame) {
        case 'flappy':      return { ...base, flappy: resetFlappy(s.flappy.best) }
        case 'tetris':      return { ...base, tetris: resetTetris(s.tetris.best) }
        case 'snake':       return { ...base, snake: resetSnake(s.snake.best) }
        case 'game2048':    return { ...base, game2048: { ...INITIAL_2048, best: s.game2048.best } }
        case 'minesweeper': return { ...base, minesweeper: { ...INITIAL_MINESWEEPER, bestTimeSec: s.minesweeper.bestTimeSec } }
        default:            return base
    }
}

export function getGameList() {
    return GAME_LIST
}
