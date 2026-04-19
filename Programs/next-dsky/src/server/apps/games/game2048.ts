/**
 * 2048 — server-side game logic with per-tile identity so the client can animate
 * tiles sliding from their previous position to the new one. Merged tiles keep
 * the id of the "leading" tile and gain a `merged` flag for the pop animation;
 * the absorbed tile is dropped entirely — which means the client only animates
 * the leader's slide, not the absorbed tile's slide toward the merge point. For
 * a 120ms transition this is visually indistinguishable from a full merge in
 * practice.
 */

import type { Game2048State, Game2048Tile } from '../../../types/serverState'

export const GAME2048_CONFIG = {
    SIZE: 4,
    WIN_TILE: 2048,
    SPAWN_FOUR_CHANCE: 0.1,
} as const

type Direction = 'left' | 'right' | 'up' | 'down'

function emptyCells(tiles: Game2048Tile[]): { x: number; y: number }[] {
    const occupied = new Set(tiles.map(t => `${t.x},${t.y}`))
    const out: { x: number; y: number }[] = []
    for (let y = 0; y < GAME2048_CONFIG.SIZE; y++) {
        for (let x = 0; x < GAME2048_CONFIG.SIZE; x++) {
            if (!occupied.has(`${x},${y}`)) out.push({ x, y })
        }
    }
    return out
}

function spawnTile(tiles: Game2048Tile[], nextId: number): { tiles: Game2048Tile[]; nextId: number } {
    const free = emptyCells(tiles)
    if (free.length === 0) return { tiles, nextId }
    const cell = free[Math.floor(Math.random() * free.length)]
    const value = Math.random() < GAME2048_CONFIG.SPAWN_FOUR_CHANCE ? 4 : 2
    const newTile: Game2048Tile = {
        id: nextId,
        value,
        x: cell.x,
        y: cell.y,
        prevX: cell.x,
        prevY: cell.y,
        merged: false,
        spawned: true,
    }
    return { tiles: [...tiles, newTile], nextId: nextId + 1 }
}

/**
 * Collapse one lane of tiles (already ordered from the "front" toward the "back").
 * Consecutive equal values merge into one tile that keeps the id of the front tile.
 * Returns the new lane (shorter if merges happened) and total score gained.
 */
function collapseLane(lane: Game2048Tile[]): { lane: Game2048Tile[]; gained: number } {
    const out: Game2048Tile[] = []
    let gained = 0
    let i = 0
    while (i < lane.length) {
        const current = lane[i]
        const next = i + 1 < lane.length ? lane[i + 1] : null
        if (next && next.value === current.value) {
            const merged: Game2048Tile = {
                ...current,
                value: current.value * 2,
                merged: true,
                spawned: false,
            }
            out.push(merged)
            gained += merged.value
            i += 2
        } else {
            out.push({ ...current, merged: false, spawned: false })
            i += 1
        }
    }
    return { lane: out, gained }
}

/**
 * Apply a move. Returns the new tile list (with updated x/y and prevX/prevY),
 * the merged/absorbed ids (for the animation), and the score gained.
 *
 * `moved` is true iff at least one tile changed position or value.
 */
function applyMove(tiles: Game2048Tile[], dir: Direction): { tiles: Game2048Tile[]; moved: boolean; gained: number } {
    const N = GAME2048_CONFIG.SIZE
    // Reset spawned/merged flags from the previous turn and snapshot prev pos.
    const base: Game2048Tile[] = tiles.map(t => ({
        ...t,
        prevX: t.x,
        prevY: t.y,
        merged: false,
        spawned: false,
    }))

    let totalGained = 0
    let moved = false
    const result: Game2048Tile[] = []

    // Process each "line" according to direction. Each line is either a row or
    // a column; the "front" is the edge tiles slide toward.
    for (let line = 0; line < N; line++) {
        // Collect tiles in this line in the order they face the front.
        let inLane: Game2048Tile[]
        if (dir === 'left') {
            inLane = base.filter(t => t.y === line).sort((a, b) => a.x - b.x)
        } else if (dir === 'right') {
            inLane = base.filter(t => t.y === line).sort((a, b) => b.x - a.x)
        } else if (dir === 'up') {
            inLane = base.filter(t => t.x === line).sort((a, b) => a.y - b.y)
        } else {
            inLane = base.filter(t => t.x === line).sort((a, b) => b.y - a.y)
        }

        const { lane: outLane, gained } = collapseLane(inLane)
        totalGained += gained

        // Assign new positions, front-first.
        for (let i = 0; i < outLane.length; i++) {
            const t = outLane[i]
            let newX = t.x
            let newY = t.y
            if (dir === 'left')       { newX = i;            newY = line }
            else if (dir === 'right') { newX = N - 1 - i;    newY = line }
            else if (dir === 'up')    { newX = line;         newY = i }
            else                      { newX = line;         newY = N - 1 - i }

            if (newX !== t.prevX || newY !== t.prevY || t.merged) moved = true
            result.push({ ...t, x: newX, y: newY })
        }
    }

    return { tiles: result, moved, gained: totalGained }
}

function maxTileValue(tiles: Game2048Tile[]): number {
    let max = 0
    for (const t of tiles) if (t.value > max) max = t.value
    return max
}

function anyMoveAvailable(tiles: Game2048Tile[]): boolean {
    if (tiles.length < GAME2048_CONFIG.SIZE * GAME2048_CONFIG.SIZE) return true
    // Build a 4×4 value grid for adjacency checks.
    const grid: number[][] = Array.from({ length: GAME2048_CONFIG.SIZE }, () =>
        new Array(GAME2048_CONFIG.SIZE).fill(0)
    )
    for (const t of tiles) grid[t.y][t.x] = t.value
    for (let y = 0; y < GAME2048_CONFIG.SIZE; y++) {
        for (let x = 0; x < GAME2048_CONFIG.SIZE; x++) {
            const v = grid[y][x]
            if (x + 1 < GAME2048_CONFIG.SIZE && grid[y][x + 1] === v) return true
            if (y + 1 < GAME2048_CONFIG.SIZE && grid[y + 1][x] === v) return true
        }
    }
    return false
}

export const INITIAL_2048: Game2048State = {
    phase: 'ready',
    tiles: [],
    score: 0,
    best: 0,
    bestTile: 0,
    wonAcknowledged: false,
    nextId: 1,
}

export function reset2048(preserveBest: number): Game2048State {
    let tiles: Game2048Tile[] = []
    let nextId = 1
    ;({ tiles, nextId } = spawnTile(tiles, nextId))
    ;({ tiles, nextId } = spawnTile(tiles, nextId))
    return {
        phase: 'playing',
        tiles,
        score: 0,
        best: preserveBest,
        bestTile: maxTileValue(tiles),
        wonAcknowledged: false,
        nextId,
    }
}

function move(state: Game2048State, dir: Direction): Game2048State {
    const { tiles: moved, moved: changed, gained } = applyMove(state.tiles, dir)
    if (!changed) {
        // Even with no movement, surface the lack of available moves so the
        // gameover overlay shows up when the board is a locked full grid.
        if (!anyMoveAvailable(state.tiles)) {
            return { ...state, phase: 'gameover' }
        }
        return state
    }

    // Spawn one new tile after the move.
    const { tiles: withSpawn, nextId } = spawnTile(moved, state.nextId)
    const score = state.score + gained
    const best = Math.max(state.best, score)
    const bestTile = Math.max(state.bestTile, maxTileValue(withSpawn))

    let phase: Game2048State['phase'] = 'playing'
    if (!state.wonAcknowledged && bestTile >= GAME2048_CONFIG.WIN_TILE) {
        phase = 'won'
    } else if (!anyMoveAvailable(withSpawn)) {
        phase = 'gameover'
    }

    return {
        ...state,
        tiles: withSpawn,
        score,
        best,
        bestTile,
        phase,
        nextId,
    }
}

export function handle2048Key(state: Game2048State, key: string): Game2048State {
    if (state.phase === 'gameover') return state

    // Acknowledge win and keep playing.
    if (state.phase === 'won' && key === 'e') {
        return { ...state, phase: 'playing', wonAcknowledged: true }
    }

    if (state.phase !== 'playing') return state

    if (key === '8') return move(state, 'up')
    if (key === '2') return move(state, 'down')
    if (key === '4') return move(state, 'left')
    if (key === '6') return move(state, 'right')

    return state
}
