"use client"

import type { TetrisState, TetrisCell, TetrisPieceType } from "../../../types/serverState"

const COLS = 10
const ROWS = 20

// Shape preview (rotation 0) for the NEXT panel. Mirrors SHAPES[type][0] in tetris.ts.
const PREVIEW_SHAPES: Record<TetrisPieceType, number[][]> = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    T: [[0, 1, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    S: [[0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    Z: [[1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    L: [[0, 0, 1, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
}

// Same shapes server-side; duplicated here instead of importing server code
// into the client bundle.
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

interface TetrisGameProps {
    state: TetrisState
}

/** Merge active piece onto a copy of the board for rendering. */
function renderBoard(state: TetrisState): TetrisCell[][] {
    const rendered: TetrisCell[][] = state.board.map(row => [...row])
    if (state.piece) {
        const shape = SHAPES[state.piece.type][state.piece.rotation]
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (!shape[r][c]) continue
                const bx = state.piece.x + c
                const by = state.piece.y + r
                if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
                    rendered[by][bx] = state.piece.type
                }
            }
        }
    }
    return rendered
}

export default function TetrisGame({ state }: TetrisGameProps) {
    const primary = 'var(--menu-primary, #5ef08a)'
    const secondary = 'var(--menu-secondary, #2a7a44)'
    const border = 'var(--menu-border, #1a3a1a)'

    const board = renderBoard(state)
    const nextShape = PREVIEW_SHAPES[state.nextType]
    const clearingRowSet = new Set(state.clearingRows)

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            padding: '2cqh 3cqw',
            boxSizing: 'border-box',
            fontFamily: 'Gorton, "Arial Narrow", sans-serif',
            color: primary,
        }}>
            {/* Single-shot flash for rows about to be removed. Duration matches
                CLEAR_BLINK_DURATION in tetris.ts so the animation and the server
                state transition out of 'clearing' finish together. */}
            <style>{`
                @keyframes tetris-row-clear {
                    0%   { background: var(--menu-primary, #5ef08a); filter: brightness(1); }
                    45%  { background: #ffffff; filter: brightness(1.8); }
                    100% { background: var(--menu-primary, #5ef08a); filter: brightness(1); }
                }
                .tetris-cell-clear { animation: tetris-row-clear 220ms ease-out 1; }
            `}</style>
            {/* Header: score / level / lines / best */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '2.6cqh',
                marginBottom: '1.2cqh',
                color: primary,
            }}>
                <span>SCORE <b>{state.score}</b></span>
                <span>LVL <b>{state.level}</b></span>
                <span>LINES <b>{state.lines}</b></span>
                <span style={{ color: secondary }}>BEST {state.best}</span>
            </div>

            {/* Main: board + side panel */}
            <div style={{
                flex: 1,
                display: 'flex',
                gap: '2.5cqw',
                minHeight: 0,
                alignItems: 'stretch',
                justifyContent: 'center',
            }}>
                {/* Board */}
                <div style={{
                    aspectRatio: `${COLS} / ${ROWS}`,
                    height: '100%',
                    border: `1px solid ${secondary}`,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                    gridTemplateRows: `repeat(${ROWS}, 1fr)`,
                    gap: '0',
                    background: '#000',
                    position: 'relative',
                }}>
                    {board.flatMap((row, r) =>
                        row.map((cell, c) => {
                            const clearing = clearingRowSet.has(r)
                            return (
                                <div
                                    key={`${r}-${c}`}
                                    className={clearing ? 'tetris-cell-clear' : undefined}
                                    style={{
                                        background: cell ? primary : 'transparent',
                                        border: cell
                                            ? `1px solid rgba(0,0,0,0.35)`
                                            : `1px solid ${border}`,
                                        boxSizing: 'border-box',
                                    }}
                                />
                            )
                        })
                    )}

                    {/* Overlays */}
                    {state.phase === 'ready' && (
                        <Overlay>
                            <div style={{ fontSize: '4.2cqh', fontWeight: 700, color: primary }}>TETRIS</div>
                            <div style={{ fontSize: '2.6cqh', color: primary, marginTop: '1.2cqh' }}>ENTR to start</div>
                        </Overlay>
                    )}
                    {state.phase === 'paused' && (
                        <Overlay>
                            <div style={{ fontSize: '4.2cqh', fontWeight: 700, color: primary }}>PAUSED</div>
                            <div style={{ fontSize: '2.4cqh', color: secondary, marginTop: '1cqh' }}>ENTR resume</div>
                        </Overlay>
                    )}
                    {state.phase === 'gameover' && (
                        <Overlay>
                            <div style={{ fontSize: '4cqh', fontWeight: 700, color: '#f87171' }}>GAME OVER</div>
                            <div style={{ fontSize: '2.6cqh', color: primary, marginTop: '1cqh' }}>SCORE: {state.score}</div>
                            <div style={{ fontSize: '2.3cqh', color: secondary, marginTop: '0.4cqh' }}>BEST: {state.best}</div>
                            <div style={{ fontSize: '2.2cqh', color: secondary, marginTop: '1.2cqh' }}>RSET back</div>
                        </Overlay>
                    )}
                </div>

                {/* Side panel: NEXT */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1cqh',
                    color: secondary,
                    fontSize: '2.4cqh',
                    minWidth: 0,
                }}>
                    <div style={{ color: primary, fontWeight: 700 }}>NEXT</div>
                    <div style={{
                        width: '14cqw',
                        aspectRatio: '1 / 1',
                        border: `1px solid ${secondary}`,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gridTemplateRows: 'repeat(4, 1fr)',
                        padding: '0.4cqh',
                        boxSizing: 'border-box',
                    }}>
                        {nextShape.flatMap((row, r) =>
                            row.map((v, c) => (
                                <div
                                    key={`n-${r}-${c}`}
                                    style={{
                                        background: v ? primary : 'transparent',
                                        border: v ? '1px solid rgba(0,0,0,0.35)' : 'none',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Key hints */}
            <div style={{
                marginTop: '1.2cqh',
                fontSize: '2.2cqh',
                color: secondary,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '0.6cqh 1.5cqw',
            }}>
                <span><K>4</K> ◀ left</span>
                <span><K>6</K> ▶ right</span>
                <span><K>5</K>/<K>8</K> rotate</span>
                <span><K>2</K> soft drop</span>
                <span><K>0</K> hard drop</span>
                <span><K>ENTR</K> pause</span>
                <span><K>RSET</K> back</span>
            </div>
        </div>
    )
}

function Overlay({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '2cqh',
        }}>
            {children}
        </div>
    )
}

function K({ children }: { children: React.ReactNode }) {
    return (
        <span style={{ color: 'var(--menu-primary, #5ef08a)', fontWeight: 600 }}>
            {children}
        </span>
    )
}
