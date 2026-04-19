/**
 * Minesweeper — server-side game logic. Pure state functions, no tick required.
 *
 * Key bindings (handled here):
 *   4/6/8/2 : cursor left/right/up/down
 *   ENTR    : reveal the current cell (or stay if already revealed/flagged)
 *   +       : toggle flag on current cell
 *
 * First reveal is guaranteed safe: if the player's first click lands on a mine,
 * that mine is relocated before the reveal.
 */

import type { MinesweeperState, MinesweeperCell } from '../../../types/serverState'

export const MINESWEEPER_CONFIG = {
    COLS: 9,
    ROWS: 9,
    MINES: 10,
} as const

function emptyCell(): MinesweeperCell {
    return { mine: false, adjacent: 0, state: 'hidden' }
}

function emptyBoard(): MinesweeperCell[][] {
    return Array.from({ length: MINESWEEPER_CONFIG.ROWS }, () =>
        Array.from({ length: MINESWEEPER_CONFIG.COLS }, () => emptyCell())
    )
}

function cloneBoard(board: MinesweeperCell[][]): MinesweeperCell[][] {
    return board.map(row => row.map(cell => ({ ...cell })))
}

/** Assign `count` mines into the board, avoiding the protected cell (x0, y0). */
function placeMines(board: MinesweeperCell[][], count: number, protect: { x: number; y: number }): MinesweeperCell[][] {
    const next = cloneBoard(board)
    const candidates: { x: number; y: number }[] = []
    for (let y = 0; y < next.length; y++) {
        for (let x = 0; x < next[y].length; x++) {
            if (x === protect.x && y === protect.y) continue
            candidates.push({ x, y })
        }
    }
    // Fisher-Yates partial shuffle for the first `count` picks
    for (let i = 0; i < count && i < candidates.length; i++) {
        const j = i + Math.floor(Math.random() * (candidates.length - i))
        const tmp = candidates[i]
        candidates[i] = candidates[j]
        candidates[j] = tmp
        const { x, y } = candidates[i]
        next[y][x].mine = true
    }
    return computeAdjacency(next)
}

function computeAdjacency(board: MinesweeperCell[][]): MinesweeperCell[][] {
    const rows = board.length
    const cols = board[0].length
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (board[y][x].mine) {
                board[y][x].adjacent = 0
                continue
            }
            let n = 0
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue
                    const nx = x + dx
                    const ny = y + dy
                    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue
                    if (board[ny][nx].mine) n++
                }
            }
            board[y][x].adjacent = n
        }
    }
    return board
}

/** BFS flood-reveal from (x,y). Mutates `board` in place. Returns cells revealed. */
function floodReveal(board: MinesweeperCell[][], x: number, y: number): number {
    const rows = board.length
    const cols = board[0].length
    let revealed = 0
    const queue: [number, number][] = [[x, y]]
    while (queue.length > 0) {
        const [cx, cy] = queue.shift()!
        if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) continue
        const cell = board[cy][cx]
        if (cell.state !== 'hidden') continue
        if (cell.mine) continue
        cell.state = 'revealed'
        revealed++
        if (cell.adjacent === 0) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue
                    queue.push([cx + dx, cy + dy])
                }
            }
        }
    }
    return revealed
}

function revealAllMines(board: MinesweeperCell[][]): MinesweeperCell[][] {
    const next = cloneBoard(board)
    for (const row of next) for (const c of row) if (c.mine) c.state = 'revealed'
    return next
}

function winCondition(board: MinesweeperCell[][], revealedCount: number, mines: number): boolean {
    const total = board.length * board[0].length
    return revealedCount === total - mines
}

export const INITIAL_MINESWEEPER: MinesweeperState = {
    phase: 'ready',
    board: emptyBoard(),
    cursor: { x: Math.floor(MINESWEEPER_CONFIG.COLS / 2), y: Math.floor(MINESWEEPER_CONFIG.ROWS / 2) },
    cols: MINESWEEPER_CONFIG.COLS,
    rows: MINESWEEPER_CONFIG.ROWS,
    mines: MINESWEEPER_CONFIG.MINES,
    flagsRemaining: MINESWEEPER_CONFIG.MINES,
    revealedCount: 0,
    firstMoveDone: false,
    bestTimeSec: null,
    startedAtMs: 0,
}

export function resetMinesweeper(preserveBest: number | null): MinesweeperState {
    return {
        phase: 'playing',
        board: emptyBoard(),
        cursor: { x: Math.floor(MINESWEEPER_CONFIG.COLS / 2), y: Math.floor(MINESWEEPER_CONFIG.ROWS / 2) },
        cols: MINESWEEPER_CONFIG.COLS,
        rows: MINESWEEPER_CONFIG.ROWS,
        mines: MINESWEEPER_CONFIG.MINES,
        flagsRemaining: MINESWEEPER_CONFIG.MINES,
        revealedCount: 0,
        firstMoveDone: false,
        bestTimeSec: preserveBest,
        startedAtMs: 0,
    }
}

function moveCursor(state: MinesweeperState, dx: number, dy: number): MinesweeperState {
    const x = Math.max(0, Math.min(state.cols - 1, state.cursor.x + dx))
    const y = Math.max(0, Math.min(state.rows - 1, state.cursor.y + dy))
    if (x === state.cursor.x && y === state.cursor.y) return state
    return { ...state, cursor: { x, y } }
}

function toggleFlag(state: MinesweeperState): MinesweeperState {
    const { x, y } = state.cursor
    const cell = state.board[y][x]
    if (cell.state === 'revealed') return state
    const next = cloneBoard(state.board)
    const target = next[y][x]
    if (target.state === 'flagged') {
        target.state = 'hidden'
        return { ...state, board: next, flagsRemaining: state.flagsRemaining + 1 }
    }
    // Cap flags at mine count. Classic Minesweeper lets you over-flag, but
    // here the flag counter doubles as "mines left to find", so locking it at
    // zero keeps the HUD honest.
    if (state.flagsRemaining <= 0) return state
    target.state = 'flagged'
    return { ...state, board: next, flagsRemaining: state.flagsRemaining - 1 }
}

function revealAtCursor(state: MinesweeperState): MinesweeperState {
    const { x, y } = state.cursor
    if (state.board[y][x].state !== 'hidden') return state

    // On the first reveal, seed mines (avoiding the current cell) and start
    // the clock. `placeMines` returns a fresh board, so no extra clone needed.
    // On subsequent reveals, we clone the existing board to stay pure.
    const firstMoveDone = true
    const startedAtMs = state.firstMoveDone ? state.startedAtMs : Date.now()
    const mutable = state.firstMoveDone
        ? cloneBoard(state.board)
        : placeMines(state.board, state.mines, { x, y })

    if (mutable[y][x].mine) {
        return {
            ...state,
            board: revealAllMines(mutable),
            firstMoveDone,
            startedAtMs,
            phase: 'gameover',
        }
    }

    const revealed = floodReveal(mutable, x, y)
    const total = state.revealedCount + revealed

    if (winCondition(mutable, total, state.mines)) {
        const elapsed = (Date.now() - startedAtMs) / 1000
        const bestTimeSec = state.bestTimeSec === null ? elapsed : Math.min(state.bestTimeSec, elapsed)
        // Auto-flag any remaining mines for visual completeness on the final board.
        for (const row of mutable) {
            for (const c of row) if (c.mine && c.state === 'hidden') c.state = 'flagged'
        }
        return {
            ...state,
            board: mutable,
            firstMoveDone,
            startedAtMs,
            revealedCount: total,
            flagsRemaining: 0,
            phase: 'won',
            bestTimeSec,
        }
    }

    return {
        ...state,
        board: mutable,
        firstMoveDone,
        startedAtMs,
        revealedCount: total,
    }
}

export function handleMinesweeperKey(state: MinesweeperState, key: string): MinesweeperState {
    if (state.phase === 'gameover' || state.phase === 'won') return state

    if (key === '4') return moveCursor(state, -1, 0)
    if (key === '6') return moveCursor(state, 1, 0)
    if (key === '8') return moveCursor(state, 0, -1)
    if (key === '2') return moveCursor(state, 0, 1)
    if (key === 'e') return revealAtCursor(state)
    if (key === '+') return toggleFlag(state)

    return state
}
