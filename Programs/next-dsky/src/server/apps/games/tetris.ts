/**
 * Tetris — server-side game logic. Pure state functions.
 * The games hub owns the tick loop and dispatches input.
 */

import type { TetrisState, TetrisPiece, TetrisPieceType, TetrisCell } from '../../../types/serverState'

export const TETRIS_CONFIG = {
    COLS: 10,
    ROWS: 20,
    BASE_DROP_INTERVAL: 0.8,
    MIN_DROP_INTERVAL: 0.12,
    LINES_PER_LEVEL: 10,
    LINE_SCORE: [0, 100, 300, 500, 800],
    SOFT_DROP_SCORE: 1,
    HARD_DROP_SCORE: 2,
    CLEAR_BLINK_DURATION: 0.22,     // seconds the completed rows flash before being removed
} as const

const PIECE_TYPES: TetrisPieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

// Shapes as 4x4 matrices, one per rotation. 1 = filled, 0 = empty.
// Layouts loosely follow SRS conventions but without wall-kicks (v1 simplicity).
const SHAPES: Record<TetrisPieceType, number[][][]> = {
    I: [
        [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
        [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
        [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
    ],
    O: [
        [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    ],
    T: [
        [[0, 1, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 1, 0, 0], [0, 1, 1, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
        [[0, 0, 0, 0], [1, 1, 1, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
        [[0, 1, 0, 0], [1, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
    ],
    S: [
        [[0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 0], [0, 0, 0, 0]],
        [[0, 0, 0, 0], [0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0]],
        [[1, 0, 0, 0], [1, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
    ],
    Z: [
        [[1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
        [[0, 0, 0, 0], [1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0]],
        [[0, 1, 0, 0], [1, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0]],
    ],
    J: [
        [[1, 0, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 1, 1, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
        [[0, 0, 0, 0], [1, 1, 1, 0], [0, 0, 1, 0], [0, 0, 0, 0]],
        [[0, 1, 0, 0], [0, 1, 0, 0], [1, 1, 0, 0], [0, 0, 0, 0]],
    ],
    L: [
        [[0, 0, 1, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0]],
        [[0, 0, 0, 0], [1, 1, 1, 0], [1, 0, 0, 0], [0, 0, 0, 0]],
        [[1, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
    ],
}

function emptyBoard(): TetrisCell[][] {
    return Array.from({ length: TETRIS_CONFIG.ROWS }, () =>
        Array<TetrisCell>(TETRIS_CONFIG.COLS).fill(0)
    )
}

function randomPieceType(): TetrisPieceType {
    return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)]
}

export function getShape(piece: TetrisPiece): number[][] {
    return SHAPES[piece.type][piece.rotation]
}

export function canPlace(board: TetrisCell[][], piece: TetrisPiece): boolean {
    const shape = getShape(piece)
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (!shape[r][c]) continue
            const bx = piece.x + c
            const by = piece.y + r
            if (bx < 0 || bx >= TETRIS_CONFIG.COLS || by >= TETRIS_CONFIG.ROWS) return false
            if (by < 0) continue // allow spawning with top rows off-screen
            if (board[by][bx] !== 0) return false
        }
    }
    return true
}

function lockPiece(board: TetrisCell[][], piece: TetrisPiece): TetrisCell[][] {
    const next = board.map(row => [...row])
    const shape = getShape(piece)
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (!shape[r][c]) continue
            const bx = piece.x + c
            const by = piece.y + r
            if (by >= 0 && by < TETRIS_CONFIG.ROWS && bx >= 0 && bx < TETRIS_CONFIG.COLS) {
                next[by][bx] = piece.type
            }
        }
    }
    return next
}

function findFullRows(board: TetrisCell[][]): number[] {
    const rows: number[] = []
    for (let r = 0; r < board.length; r++) {
        if (board[r].every(cell => cell !== 0)) rows.push(r)
    }
    return rows
}

function removeRows(board: TetrisCell[][], rowIndices: number[]): TetrisCell[][] {
    const skip = new Set(rowIndices)
    const remaining = board.filter((_, r) => !skip.has(r))
    const empties = Array.from({ length: rowIndices.length }, () =>
        Array<TetrisCell>(TETRIS_CONFIG.COLS).fill(0)
    )
    return [...empties, ...remaining]
}

function spawnPiece(type: TetrisPieceType): TetrisPiece {
    // O spawns one column further right to center visually on a 4-wide bbox.
    const x = type === 'O' ? 3 : 3
    return { type, rotation: 0, x, y: 0 }
}

function computeLevel(totalLines: number): number {
    return 1 + Math.floor(totalLines / TETRIS_CONFIG.LINES_PER_LEVEL)
}

function computeDropInterval(level: number): number {
    const step = 0.08
    const val = TETRIS_CONFIG.BASE_DROP_INTERVAL - (level - 1) * step
    return Math.max(TETRIS_CONFIG.MIN_DROP_INTERVAL, val)
}

export const INITIAL_TETRIS: TetrisState = {
    phase: 'ready',
    board: emptyBoard(),
    piece: null,
    nextType: 'T',
    dropTimer: 0,
    dropInterval: TETRIS_CONFIG.BASE_DROP_INTERVAL,
    clearingRows: [],
    clearTimer: 0,
    score: 0,
    lines: 0,
    level: 1,
    best: 0,
    tickMs: 0,
}

export function resetTetris(preserveBest: number): TetrisState {
    const firstType = randomPieceType()
    const nextType = randomPieceType()
    return {
        phase: 'ready',
        board: emptyBoard(),
        piece: spawnPiece(firstType),
        nextType,
        dropTimer: 0,
        dropInterval: TETRIS_CONFIG.BASE_DROP_INTERVAL,
        clearingRows: [],
        clearTimer: 0,
        score: 0,
        lines: 0,
        level: 1,
        best: preserveBest,
        tickMs: Date.now(),
    }
}

/** Try to move/rotate the active piece. Returns new state (same reference if no change). */
function tryMove(state: TetrisState, dx: number, dy: number, dRot: number): TetrisState {
    if (!state.piece) return state
    const rotation = ((state.piece.rotation + dRot) % 4 + 4) % 4 as TetrisPiece['rotation']
    const candidate: TetrisPiece = {
        ...state.piece,
        x: state.piece.x + dx,
        y: state.piece.y + dy,
        rotation,
    }
    if (canPlace(state.board, candidate)) {
        return { ...state, piece: candidate }
    }
    return state
}

/**
 * Lock current piece and either enter the clearing animation (if any rows filled)
 * or spawn the next piece immediately. Scoring is applied at lock time so the
 * blinking frame already shows the new score.
 */
function lockAndMaybeClear(state: TetrisState, lockBonusPerRow: number, rowsDropped: number): TetrisState {
    if (!state.piece) return state
    const locked = lockPiece(state.board, state.piece)
    const fullRows = findFullRows(locked)
    const clearedCount = fullRows.length
    const lineScore = TETRIS_CONFIG.LINE_SCORE[clearedCount] ?? 0
    const totalLines = state.lines + clearedCount
    const level = computeLevel(totalLines)
    const dropInterval = computeDropInterval(level)
    const gainedScore = lineScore * state.level + lockBonusPerRow * rowsDropped
    const score = state.score + gainedScore
    const best = Math.max(state.best, score)

    // Rows to clear: keep board with full rows visible, enter 'clearing' phase.
    if (clearedCount > 0) {
        return {
            ...state,
            board: locked,
            piece: null,
            phase: 'clearing',
            clearingRows: fullRows,
            clearTimer: TETRIS_CONFIG.CLEAR_BLINK_DURATION,
            score,
            lines: totalLines,
            level,
            dropInterval,
            dropTimer: 0,
            best,
            tickMs: Date.now(),
        }
    }

    // No rows cleared — spawn next piece immediately.
    return spawnNextOrGameOver(
        { ...state, board: locked, piece: null, score, lines: totalLines, level, dropInterval, dropTimer: 0, best },
        state.nextType,
    )
}

/** Choose next piece and either continue playing or transition to gameover. */
function spawnNextOrGameOver(state: TetrisState, spawnType: TetrisPieceType): TetrisState {
    const newPiece = spawnPiece(spawnType)
    const nextType = randomPieceType()
    if (!canPlace(state.board, newPiece)) {
        return {
            ...state,
            piece: null,
            nextType,
            phase: 'gameover',
            clearingRows: [],
            clearTimer: 0,
            tickMs: Date.now(),
        }
    }
    return {
        ...state,
        piece: newPiece,
        nextType,
        phase: 'playing',
        clearingRows: [],
        clearTimer: 0,
        tickMs: Date.now(),
    }
}

/** Gravity + clearing-animation tick. */
export function tickTetris(state: TetrisState, dtSec: number): TetrisState {
    if (state.phase === 'clearing') {
        const remaining = state.clearTimer - dtSec
        if (remaining > 0) {
            return { ...state, clearTimer: remaining }
        }
        // Animation finished: actually remove the rows and spawn the next piece.
        const board = removeRows(state.board, state.clearingRows)
        return spawnNextOrGameOver({ ...state, board }, state.nextType)
    }

    if (state.phase !== 'playing' || !state.piece) return state
    const timer = state.dropTimer + dtSec
    if (timer < state.dropInterval) {
        return { ...state, dropTimer: timer }
    }
    // Advance gravity by one row. If blocked, lock.
    const candidate: TetrisPiece = { ...state.piece, y: state.piece.y + 1 }
    if (canPlace(state.board, candidate)) {
        return { ...state, piece: candidate, dropTimer: timer - state.dropInterval, tickMs: Date.now() }
    }
    return lockAndMaybeClear({ ...state, dropTimer: 0 }, 0, 0)
}

/** Key input. RSET is intercepted by the hub; this handles gameplay keys only. */
export function handleTetrisKey(state: TetrisState, key: string): TetrisState {
    if (state.phase === 'gameover') return state

    if (key === 'e') {
        if (state.phase === 'ready') {
            return { ...state, phase: 'playing', dropTimer: 0, tickMs: Date.now() }
        }
        if (state.phase === 'playing') return { ...state, phase: 'paused' }
        if (state.phase === 'paused') return { ...state, phase: 'playing', tickMs: Date.now() }
        return state
    }

    if (state.phase !== 'playing' || !state.piece) return state

    if (key === '4') return tryMove(state, -1, 0, 0)
    if (key === '6') return tryMove(state, 1, 0, 0)
    if (key === '5') return tryMove(state, 0, 0, 1)
    if (key === '8') return tryMove(state, 0, 0, -1)

    if (key === '2') {
        // Soft drop: single row down; if blocked, lock with small bonus.
        const candidate: TetrisPiece = { ...state.piece, y: state.piece.y + 1 }
        if (canPlace(state.board, candidate)) {
            return { ...state, piece: candidate, dropTimer: 0, score: state.score + TETRIS_CONFIG.SOFT_DROP_SCORE, tickMs: Date.now() }
        }
        return lockAndMaybeClear({ ...state, dropTimer: 0 }, 0, 0)
    }

    if (key === '0') {
        // Hard drop: move piece to lowest legal y, lock with bonus per row dropped.
        let p = state.piece
        let rows = 0
        while (true) {
            const candidate: TetrisPiece = { ...p, y: p.y + 1 }
            if (!canPlace(state.board, candidate)) break
            p = candidate
            rows++
        }
        return lockAndMaybeClear({ ...state, piece: p, dropTimer: 0 }, TETRIS_CONFIG.HARD_DROP_SCORE, rows)
    }

    return state
}
