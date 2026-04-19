"use client"

import type { SnakeState } from "../../../types/serverState"

const COLS = 14
const ROWS = 24

interface SnakeGameProps {
    state: SnakeState
}

export default function SnakeGame({ state }: SnakeGameProps) {
    const primary = 'var(--menu-primary, #5ef08a)'
    const secondary = 'var(--menu-secondary, #2a7a44)'
    const border = 'var(--menu-border, #1a3a1a)'
    const accent = 'var(--menu-accent, #facc15)'

    const snakeSet = new Map<string, number>()
    state.snake.forEach((s, i) => snakeSet.set(`${s.x},${s.y}`, i))

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
                <span>SCORE <b>{state.score}</b></span>
                <span>LEN <b>{state.snake.length}</b></span>
                <span style={{ color: secondary }}>BEST {state.best}</span>
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
                    aspectRatio: `${COLS} / ${ROWS}`,
                    height: '100%',
                    maxWidth: '100%',
                    border: `1px solid ${secondary}`,
                    position: 'relative',
                }}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
                    }}>
                        {Array.from({ length: ROWS }).flatMap((_, y) =>
                            Array.from({ length: COLS }).map((__, x) => {
                                const idx = snakeSet.get(`${x},${y}`)
                                const isHead = idx === 0
                                const isSnake = idx !== undefined
                                const isFood = state.food.x === x && state.food.y === y
                                let background = 'transparent'
                                if (isHead) background = accent
                                else if (isSnake) background = primary
                                else if (isFood) background = '#f87171'
                                return (
                                    <div
                                        key={`${y}-${x}`}
                                        style={{
                                            background,
                                            border: `1px solid ${border}`,
                                            boxSizing: 'border-box',
                                        }}
                                    />
                                )
                            })
                        )}
                    </div>

                    {state.phase === 'ready' && (
                        <Overlay>
                            <div style={{ fontSize: '4.5cqh', fontWeight: 700, color: primary }}>SNAKE</div>
                            <div style={{ fontSize: '2.8cqh', color: primary, marginTop: '1.2cqh' }}>ENTR to start</div>
                        </Overlay>
                    )}
                    {state.phase === 'paused' && (
                        <Overlay>
                            <div style={{ fontSize: '4.5cqh', fontWeight: 700, color: primary }}>PAUSED</div>
                            <div style={{ fontSize: '2.4cqh', color: secondary, marginTop: '1cqh' }}>ENTR resume</div>
                        </Overlay>
                    )}
                    {state.phase === 'gameover' && (
                        <Overlay>
                            <div style={{ fontSize: '4.2cqh', fontWeight: 700, color: '#f87171' }}>GAME OVER</div>
                            <div style={{ fontSize: '2.8cqh', color: primary, marginTop: '1cqh' }}>SCORE: {state.score}</div>
                            <div style={{ fontSize: '2.4cqh', color: secondary, marginTop: '0.4cqh' }}>BEST: {state.best}</div>
                            <div style={{ fontSize: '2.2cqh', color: secondary, marginTop: '1.2cqh' }}>RSET back</div>
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
            zIndex: 10,
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
