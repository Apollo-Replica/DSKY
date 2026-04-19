"use client"

import type { ServerState } from "../../types/serverState"
import FlappyGame from "./games/flappyGame"
import TetrisGame from "./games/tetrisGame"

const GAME_LIST = [
    { id: 'flappy', label: 'FLAPPY ROCKET', icon: '\u25B6' },
    { id: 'tetris', label: 'TETRIS', icon: '\u25A6' },
]

interface GamesAppProps {
    serverState: ServerState
}

export default function GamesApp({ serverState }: GamesAppProps) {
    const games = serverState.app.games
    if (!games) return null

    if (games.activeGame === 'flappy') {
        return <FlappyGame state={games.flappy} />
    }
    if (games.activeGame === 'tetris') {
        return <TetrisGame state={games.tetris} />
    }

    // Selector screen
    const primary = 'var(--menu-primary, #5ef08a)'
    const secondary = 'var(--menu-secondary, #2a7a44)'

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            padding: '3cqh 4cqw',
            boxSizing: 'border-box',
            fontFamily: 'Gorton, "Arial Narrow", sans-serif',
            color: primary,
        }}>
            <div style={{
                fontSize: '4.5cqh',
                fontWeight: 700,
                textAlign: 'center',
                marginBottom: '2.5cqh',
                letterSpacing: '0.2em',
            }}>
                GAMES
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5cqh', justifyContent: 'center' }}>
                {GAME_LIST.map((g, i) => {
                    const selected = i === games.selectorIndex
                    return (
                        <div
                            key={g.id}
                            style={{
                                border: `1px solid ${selected ? primary : secondary}`,
                                background: selected ? 'rgba(94,240,138,0.12)' : 'transparent',
                                padding: '2.5cqh 3cqw',
                                fontSize: '4cqh',
                                fontWeight: selected ? 700 : 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2cqw',
                                color: selected ? primary : secondary,
                            }}
                        >
                            <span style={{ fontSize: '3.5cqh' }}>{g.icon}</span>
                            <span>{g.label}</span>
                        </div>
                    )
                })}
            </div>
            <div style={{
                fontSize: '2.3cqh',
                color: secondary,
                textAlign: 'center',
                marginTop: '2cqh',
            }}>
                +/- nav · ENTR select · NOUN NOUN NOUN to exit
            </div>
        </div>
    )
}
