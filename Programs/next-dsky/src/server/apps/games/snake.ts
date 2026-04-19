/**
 * Snake — server-side game logic. Pure state functions.
 * Tick loop is driven by the games hub.
 */

import type { SnakeState, SnakeSegment, SnakeDirection } from '../../../types/serverState'

export const SNAKE_CONFIG = {
    // Board is taller than wide to match the DSKY screen aspect (~0.57).
    COLS: 14,
    ROWS: 24,
    INITIAL_LENGTH: 4,
    BASE_STEP_INTERVAL: 0.16,       // seconds between snake steps at start
    MIN_STEP_INTERVAL: 0.06,
    SPEEDUP_PER_FOOD: 0.004,        // subtract from interval per food eaten
    FOOD_SCORE: 10,
} as const

const OPPOSITE: Record<SnakeDirection, SnakeDirection> = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left',
}

function stepOffset(dir: SnakeDirection): { dx: number; dy: number } {
    switch (dir) {
        case 'up': return { dx: 0, dy: -1 }
        case 'down': return { dx: 0, dy: 1 }
        case 'left': return { dx: -1, dy: 0 }
        case 'right': return { dx: 1, dy: 0 }
    }
}

function initialSnake(): SnakeSegment[] {
    const midY = Math.floor(SNAKE_CONFIG.ROWS / 2)
    const startX = Math.floor(SNAKE_CONFIG.COLS / 4)
    const segments: SnakeSegment[] = []
    for (let i = 0; i < SNAKE_CONFIG.INITIAL_LENGTH; i++) {
        segments.push({ x: startX - i, y: midY })
    }
    return segments
}

function placeFood(snake: SnakeSegment[]): SnakeSegment {
    const taken = new Set(snake.map(s => `${s.x},${s.y}`))
    const free: SnakeSegment[] = []
    for (let y = 0; y < SNAKE_CONFIG.ROWS; y++) {
        for (let x = 0; x < SNAKE_CONFIG.COLS; x++) {
            if (!taken.has(`${x},${y}`)) free.push({ x, y })
        }
    }
    if (free.length === 0) return { x: 0, y: 0 } // board full (win condition)
    return free[Math.floor(Math.random() * free.length)]
}

export const INITIAL_SNAKE: SnakeState = {
    phase: 'ready',
    snake: initialSnake(),
    direction: 'right',
    pendingDirection: 'right',
    food: { x: Math.floor(SNAKE_CONFIG.COLS * 3 / 4), y: Math.floor(SNAKE_CONFIG.ROWS / 2) },
    stepTimer: 0,
    stepInterval: SNAKE_CONFIG.BASE_STEP_INTERVAL,
    score: 0,
    best: 0,
    tickMs: 0,
}

export function resetSnake(preserveBest: number): SnakeState {
    const snake = initialSnake()
    return {
        phase: 'ready',
        snake,
        direction: 'right',
        pendingDirection: 'right',
        food: placeFood(snake),
        stepTimer: 0,
        stepInterval: SNAKE_CONFIG.BASE_STEP_INTERVAL,
        score: 0,
        best: preserveBest,
        tickMs: Date.now(),
    }
}

function gameOver(state: SnakeState): SnakeState {
    return {
        ...state,
        phase: 'gameover',
        best: Math.max(state.best, state.score),
        tickMs: Date.now(),
    }
}

function stepSnake(state: SnakeState): SnakeState {
    const dir = state.pendingDirection
    const { dx, dy } = stepOffset(dir)
    const head = state.snake[0]
    const newHead: SnakeSegment = { x: head.x + dx, y: head.y + dy }

    // Wall collision
    if (newHead.x < 0 || newHead.x >= SNAKE_CONFIG.COLS ||
        newHead.y < 0 || newHead.y >= SNAKE_CONFIG.ROWS) {
        return gameOver(state)
    }

    const ateFood = newHead.x === state.food.x && newHead.y === state.food.y
    // When not eating, the tail moves forward — exclude it from self-collision.
    const body = ateFood ? state.snake : state.snake.slice(0, -1)
    for (const s of body) {
        if (s.x === newHead.x && s.y === newHead.y) return gameOver(state)
    }

    const newSnake = ateFood ? [newHead, ...state.snake] : [newHead, ...state.snake.slice(0, -1)]
    const score = ateFood ? state.score + SNAKE_CONFIG.FOOD_SCORE : state.score
    const stepInterval = ateFood
        ? Math.max(SNAKE_CONFIG.MIN_STEP_INTERVAL, state.stepInterval - SNAKE_CONFIG.SPEEDUP_PER_FOOD)
        : state.stepInterval
    const food = ateFood ? placeFood(newSnake) : state.food

    return {
        ...state,
        snake: newSnake,
        direction: dir,
        food,
        score,
        best: Math.max(state.best, score),
        stepInterval,
        stepTimer: 0,
        tickMs: Date.now(),
    }
}

export function tickSnake(state: SnakeState, dtSec: number): SnakeState {
    if (state.phase !== 'playing') return state
    const timer = state.stepTimer + dtSec
    if (timer < state.stepInterval) return { ...state, stepTimer: timer }
    return stepSnake(state)
}

/**
 * Queue a direction change, rejecting 180° reversals.
 *
 * The check must be against `pendingDirection`, not `direction`: without it, a
 * quick two-tap like "up → left" on a right-moving snake would first queue "up"
 * (legal vs right), then accept "left" (also legal vs right) and apply it next
 * tick — but "up → left" is only legal if "up" was actually applied first.
 * Bounding against pending prevents collapsing two queued inputs into a 180°.
 */
function queueDirection(state: SnakeState, dir: SnakeDirection): SnakeState {
    if (OPPOSITE[dir] === state.pendingDirection) return state
    if (dir === state.pendingDirection) return state
    return { ...state, pendingDirection: dir }
}

export function handleSnakeKey(state: SnakeState, key: string): SnakeState {
    if (state.phase === 'gameover') return state

    if (key === 'e') {
        if (state.phase === 'ready') return { ...state, phase: 'playing', tickMs: Date.now() }
        if (state.phase === 'playing') return { ...state, phase: 'paused' }
        if (state.phase === 'paused') return { ...state, phase: 'playing', tickMs: Date.now() }
        return state
    }

    if (state.phase !== 'playing') return state

    if (key === '8') return queueDirection(state, 'up')
    if (key === '2') return queueDirection(state, 'down')
    if (key === '4') return queueDirection(state, 'left')
    if (key === '6') return queueDirection(state, 'right')

    return state
}
