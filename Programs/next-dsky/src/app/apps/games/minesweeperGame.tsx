"use client"

import { useEffect, useState } from "react"
import type { MinesweeperState, MinesweeperCell } from "../../../types/serverState"

interface MinesweeperGameProps {
    state: MinesweeperState
}

function formatTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function MinesweeperGame({ state }: MinesweeperGameProps) {
    const primary = 'var(--menu-primary, #5ef08a)'
    const secondary = 'var(--menu-secondary, #2a7a44)'
    const border = 'var(--menu-border, #1a3a1a)'
    const accent = 'var(--menu-accent, #facc15)'

    // Local clock tick for elapsed display while playing.
    const [now, setNow] = useState<number>(Date.now())
    useEffect(() => {
        if (state.phase !== 'playing' || !state.firstMoveDone) return
        const id = setInterval(() => setNow(Date.now()), 250)
        return () => clearInterval(id)
    }, [state.phase, state.firstMoveDone])

    const elapsed = state.firstMoveDone && state.startedAtMs > 0
        ? (state.phase === 'won' || state.phase === 'gameover'
            ? (state.bestTimeSec ?? 0)
            : (now - state.startedAtMs) / 1000)
        : 0

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
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '2.8cqh',
                marginBottom: '1.2cqh',
            }}>
                <span>MINES <b>{state.flagsRemaining}</b></span>
                <span>TIME <b>{formatTime(elapsed)}</b></span>
                <span style={{ color: secondary }}>
                    BEST {state.bestTimeSec !== null ? formatTime(state.bestTimeSec) : '--:--'}
                </span>
            </div>

            {/* Board */}
            <div style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 0,
            }}>
                <div style={{
                    aspectRatio: `${state.cols} / ${state.rows}`,
                    height: '100%',
                    maxWidth: '100%',
                    border: `1px solid ${secondary}`,
                    position: 'relative',
                }}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${state.cols}, 1fr)`,
                        gridTemplateRows: `repeat(${state.rows}, 1fr)`,
                    }}>
                        {state.board.flatMap((row, y) =>
                            row.map((cell, x) => {
                                const isCursor = state.cursor.x === x && state.cursor.y === y
                                return (
                                    <CellView
                                        key={`${y}-${x}`}
                                        cell={cell}
                                        isCursor={isCursor}
                                        phase={state.phase}
                                        primary={primary}
                                        secondary={secondary}
                                        border={border}
                                        accent={accent}
                                    />
                                )
                            })
                        )}
                    </div>

                    {state.phase === 'won' && (
                        <Overlay>
                            <div style={{ fontSize: '4.5cqh', fontWeight: 700, color: accent }}>CLEARED</div>
                            <div style={{ fontSize: '2.8cqh', color: primary, marginTop: '1cqh' }}>TIME: {formatTime(elapsed)}</div>
                            <div style={{ fontSize: '2.4cqh', color: secondary, marginTop: '0.4cqh' }}>
                                BEST: {state.bestTimeSec !== null ? formatTime(state.bestTimeSec) : '--:--'}
                            </div>
                            <div style={{ fontSize: '2.2cqh', color: secondary, marginTop: '1.2cqh' }}>RSET back</div>
                        </Overlay>
                    )}
                    {state.phase === 'gameover' && (
                        <Overlay>
                            <div style={{ fontSize: '4.5cqh', fontWeight: 700, color: '#f87171' }}>BOOM</div>
                            <div style={{ fontSize: '2.6cqh', color: primary, marginTop: '1cqh' }}>RSET back</div>
                        </Overlay>
                    )}
                </div>
            </div>

            {/* Key hints */}
            <div style={{
                marginTop: '1.2cqh',
                fontSize: '2.3cqh',
                color: secondary,
                display: 'flex',
                justifyContent: 'center',
                gap: '2.5cqw',
                flexWrap: 'wrap',
            }}>
                <span><K>4</K> ◀ <K>6</K> ▶ <K>8</K> ▲ <K>2</K> ▼</span>
                <span><K>ENTR</K> reveal</span>
                <span><K>+</K> flag</span>
                <span><K>RSET</K> back</span>
            </div>
        </div>
    )
}

interface CellViewProps {
    cell: MinesweeperCell
    isCursor: boolean
    phase: MinesweeperState['phase']
    primary: string
    secondary: string
    border: string
    accent: string
}

function CellView({ cell, isCursor, phase, primary, secondary, border, accent }: CellViewProps) {
    let background = 'transparent'
    let content: string = ''
    let color = primary

    if (cell.state === 'revealed') {
        if (cell.mine) {
            background = '#f87171'
            content = '*'
            color = '#000'
        } else if (cell.adjacent > 0) {
            content = String(cell.adjacent)
            color = ADJACENT_COLORS[cell.adjacent - 1] ?? primary
        }
        // else: empty revealed cell stays transparent
    } else if (cell.state === 'flagged') {
        content = 'F'
        color = accent
    } else {
        // hidden
        background = 'rgba(94, 240, 138, 0.08)'
    }

    const outline = isCursor && phase === 'playing'
        ? `2px solid ${accent}`
        : `1px solid ${border}`

    return (
        <div
            style={{
                background,
                border: outline,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color,
                fontWeight: 700,
                fontSize: '3.2cqh',
                position: 'relative',
                zIndex: isCursor ? 2 : 1,
            }}
        >
            {content}
        </div>
    )
}

// Adjacent-count colors — kept inside the green palette so it still feels DSKY.
const ADJACENT_COLORS: string[] = [
    'var(--menu-primary, #5ef08a)',     // 1
    'var(--menu-highlight, #86efac)',   // 2
    'var(--menu-accent, #facc15)',      // 3
    '#f59e0b',                          // 4
    '#f87171',                          // 5
    '#f87171',                          // 6
    '#ef4444',                          // 7
    '#dc2626',                          // 8
]

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
            zIndex: 10,
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
