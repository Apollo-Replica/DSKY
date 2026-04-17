/**
 * Flappy Rocket — server-side physics and game logic.
 * Pure state functions. The hub runs the tick loop and calls these.
 * Units normalized to [0..1] so render is resolution-independent.
 */

import type { FlappyState, FlappyObstacle } from '../../../types/serverState'

// Normalized units [0..1]. Original Flappy Bird: gravity ~900 px/s², flap ~-276 px/s
// on a ~500 px tall playfield -> gravity ≈ 1.8 /s², flap ≈ -0.55 /s. Tuned for feel.
export const FLAPPY_CONFIG = {
    GRAVITY: 2.2,            // units / sec^2
    FLAP_IMPULSE: -0.75,     // instant velocity on PRO tap
    MAX_VY: 1.4,
    MIN_VY: -1.0,
    SCROLL_SPEED: 0.32,      // units / sec
    OBSTACLE_INTERVAL: 1.5,  // seconds between spawns
    GAP_SIZE: 0.34,
    GAP_MIN_Y: 0.10,
    GAP_MAX_TOP: 0.56,
    SHIP_SIZE: 0.06,
    SHIP_X: 0.22,
    OBSTACLE_WIDTH: 0.1,
} as const

// Negative spawnTimer delays the first obstacle so the player has a moment to
// get oriented before the first pipe arrives.
const FIRST_SPAWN_DELAY = 1.5  // seconds

export const INITIAL_FLAPPY: FlappyState = {
    phase: 'ready',
    shipY: 0.45,
    shipVy: 0,
    boosting: false,
    obstacles: [],
    spawnTimer: -FIRST_SPAWN_DELAY,
    score: 0,
    best: 0,
    tickMs: 0,
}

/** Flap = instant velocity set. Return new state (phase unchanged). */
export function flapFlappy(state: FlappyState): FlappyState {
    return { ...state, shipVy: FLAPPY_CONFIG.FLAP_IMPULSE }
}

function clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v
}

function randomGapY(): number {
    const { GAP_MIN_Y, GAP_MAX_TOP } = FLAPPY_CONFIG
    return GAP_MIN_Y + Math.random() * (GAP_MAX_TOP - GAP_MIN_Y)
}

export function resetFlappy(preserveBest: number): FlappyState {
    return { ...INITIAL_FLAPPY, best: preserveBest, tickMs: Date.now() }
}

/**
 * Advance the simulation by dt seconds. Returns the new state.
 * If it returns state with phase === 'gameover', the caller should stop ticking.
 */
export function tickFlappy(state: FlappyState, dtSec: number): FlappyState {
    if (state.phase !== 'playing') return state
    const cfg = FLAPPY_CONFIG

    const vy = clamp(state.shipVy + cfg.GRAVITY * dtSec, cfg.MIN_VY, cfg.MAX_VY)
    const y = state.shipY + vy * dtSec

    let obstacles: FlappyObstacle[] = state.obstacles
        .map(o => ({ ...o, x: o.x - cfg.SCROLL_SPEED * dtSec }))
        .filter(o => o.x + cfg.OBSTACLE_WIDTH > -0.05)

    let spawnTimer = state.spawnTimer + dtSec
    if (spawnTimer >= cfg.OBSTACLE_INTERVAL) {
        spawnTimer -= cfg.OBSTACLE_INTERVAL
        obstacles = [...obstacles, {
            x: 1.05,
            gapY: randomGapY(),
            gapSize: cfg.GAP_SIZE,
            passed: false,
        }]
    }

    let score = state.score
    obstacles = obstacles.map(o => {
        if (!o.passed && o.x + cfg.OBSTACLE_WIDTH < cfg.SHIP_X) {
            score++
            return { ...o, passed: true }
        }
        return o
    })

    // Collision detection — hitbox smaller than sprite for Flappy Bird-style
    // forgiveness (original game uses ~70% of visual sprite).
    const HITBOX_SCALE = 0.65
    const hb = (cfg.SHIP_SIZE * HITBOX_SCALE) / 2
    let phase: FlappyState['phase'] = 'playing'
    if (y < 0 || y > 1) {
        phase = 'gameover'
    } else {
        const shipLeft = cfg.SHIP_X - hb
        const shipRight = cfg.SHIP_X + hb
        const shipTop = y - hb
        const shipBottom = y + hb
        for (const o of obstacles) {
            const oLeft = o.x
            const oRight = o.x + cfg.OBSTACLE_WIDTH
            if (shipRight > oLeft && shipLeft < oRight) {
                if (shipTop < o.gapY || shipBottom > o.gapY + o.gapSize) {
                    phase = 'gameover'
                    break
                }
            }
        }
    }

    const best = phase === 'gameover' ? Math.max(state.best, score) : state.best

    return {
        phase,
        shipY: clamp(y, 0, 1),
        shipVy: phase === 'gameover' ? 0 : vy,
        boosting: phase === 'gameover' ? false : state.boosting,
        obstacles,
        spawnTimer,
        score,
        best,
        tickMs: Date.now(),
    }
}

/**
 * Handle a key event. Flap (p) is an instant velocity impulse per tap.
 * 'o' (PRO release) is ignored — flap is not held.
 * Expected keys: 'p' (PRO), 'e' (ENTR), 'r' (RSET).
 */
export function handleFlappyKey(state: FlappyState, key: string): FlappyState {
    if (key === 'p' || key === 'e') {
        if (state.phase === 'ready') {
            return { ...resetFlappy(state.best), phase: 'playing', shipVy: FLAPPY_CONFIG.FLAP_IMPULSE, tickMs: Date.now() }
        }
        if (state.phase === 'playing') {
            return flapFlappy(state)
        }
        if (state.phase === 'gameover') {
            return resetFlappy(state.best)
        }
    }
    if (key === 'r') {
        return resetFlappy(state.best)
    }
    return state
}
