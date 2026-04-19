"use client"

import { useLayoutEffect, useRef, useState } from "react"
import type { Game2048State, Game2048Tile } from "../../../types/serverState"

const SIZE = 4
const CELL_PCT = 100 / SIZE
const SLIDE_MS = 120

interface Game2048Props {
    state: Game2048State
}

/** Monochrome visual weight by power of 2: higher tiles are brighter. */
function tileStyleFor(value: number): { background: string; color: string; border: string; fontSize: string } {
    const p = Math.min(1, Math.log2(value) / 11) // log2(2048)=11 → 1.0
    const bgAlpha = 0.12 + p * 0.6
    const fontSize = value < 100 ? '5.5cqh' : value < 1000 ? '4.6cqh' : '3.8cqh'
    return {
        background: `rgba(94, 240, 138, ${bgAlpha.toFixed(3)})`,
        color: value >= 128 ? '#000' : 'var(--menu-primary, #5ef08a)',
        border: '1px solid var(--menu-primary, #5ef08a)',
        fontSize,
    }
}

export default function Game2048({ state }: Game2048Props) {
    const primary = 'var(--menu-primary, #5ef08a)'
    const secondary = 'var(--menu-secondary, #2a7a44)'

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
            <style>{`
                @keyframes game2048-pop {
                    0%   { transform: scale(0.5); }
                    60%  { transform: scale(1.12); }
                    100% { transform: scale(1); }
                }
                @keyframes game2048-merge {
                    0%   { transform: scale(1); }
                    45%  { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }
            `}</style>

            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '2.8cqh',
                marginBottom: '1.2cqh',
            }}>
                <span>SCORE <b>{state.score}</b></span>
                <span>BEST TILE <b>{state.bestTile || '-'}</b></span>
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
                <BoardView state={state} primary={primary} secondary={secondary} />
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
                <span><K>RSET</K> back</span>
            </div>
        </div>
    )
}

interface BoardViewProps {
    state: Game2048State
    primary: string
    secondary: string
}

function BoardView({ state, primary, secondary }: BoardViewProps) {
    // Track the last rendered position for each tile id. The first render uses
    // `prevX/prevY` so the browser has a starting point, then we swap to (x, y)
    // and CSS transitions animate the slide.
    const renderedPosRef = useRef<Map<number, { x: number; y: number }>>(new Map())
    const [, forceRender] = useState(0)

    // After paint, record the latest positions and trigger a re-render so tiles
    // move from their `prev` position to their current one.
    useLayoutEffect(() => {
        let changed = false
        const next = new Map<number, { x: number; y: number }>()
        for (const t of state.tiles) {
            next.set(t.id, { x: t.x, y: t.y })
            const prior = renderedPosRef.current.get(t.id)
            if (!prior || prior.x !== t.x || prior.y !== t.y) changed = true
        }
        if (changed) {
            // Commit the target positions on the next frame so the current paint
            // (at prev positions) is visible first.
            requestAnimationFrame(() => {
                renderedPosRef.current = next
                forceRender(v => v + 1)
            })
        } else {
            renderedPosRef.current = next
        }
    }, [state.tiles])

    return (
        <div style={{
            aspectRatio: '1 / 1',
            height: '100%',
            maxWidth: '100%',
            border: `1px solid ${secondary}`,
            position: 'relative',
            boxSizing: 'border-box',
        }}>
            {/* Background cells — a plain grid with no gap; tiles get their own inset. */}
            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
                gridTemplateRows: `repeat(${SIZE}, 1fr)`,
            }}>
                {Array.from({ length: SIZE * SIZE }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            background: 'transparent',
                            border: `1px solid var(--menu-border, #1a3a1a)`,
                            boxSizing: 'border-box',
                        }}
                    />
                ))}
            </div>

            {/* Tiles — absolutely positioned over the background, sliding via left/top. */}
            <div style={{ position: 'absolute', inset: 0 }}>
                {state.tiles.map(tile => (
                    <TileView
                        key={tile.id}
                        tile={tile}
                        renderedPos={renderedPosRef.current.get(tile.id)}
                    />
                ))}
            </div>

            {/* Overlays */}
            {state.phase === 'ready' && (
                <Overlay>
                    <div style={{ fontSize: '4.8cqh', fontWeight: 700, color: primary }}>2048</div>
                    <div style={{ fontSize: '2.6cqh', color: primary, marginTop: '1.2cqh' }}>ENTR to start</div>
                </Overlay>
            )}
            {state.phase === 'won' && (
                <Overlay>
                    <div style={{ fontSize: '4.4cqh', fontWeight: 700, color: 'var(--menu-accent, #facc15)' }}>2048!</div>
                    <div style={{ fontSize: '2.6cqh', color: primary, marginTop: '1cqh' }}>SCORE: {state.score}</div>
                    <div style={{ fontSize: '2.4cqh', color: secondary, marginTop: '1cqh' }}>ENTR keep playing</div>
                    <div style={{ fontSize: '2.2cqh', color: secondary, marginTop: '0.4cqh' }}>RSET back</div>
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
    )
}

interface TileViewProps {
    tile: Game2048Tile
    // Position last committed by the parent. If present and differs from (x,y),
    // we render at `renderedPos` first so the browser interpolates to (x,y).
    renderedPos: { x: number; y: number } | undefined
}

function TileView({ tile, renderedPos }: TileViewProps) {
    const style = tileStyleFor(tile.value)

    // On first mount of a tile id we want it to start at prevX/prevY (which is
    // its own position for a fresh spawn). On subsequent renders renderedPos is
    // maintained by the parent — either the old position (animating in) or the
    // current one (animation committed).
    let x = tile.x
    let y = tile.y
    const firstTime = renderedPos === undefined
    if (firstTime) {
        x = tile.prevX
        y = tile.prevY
    } else if (renderedPos.x !== tile.x || renderedPos.y !== tile.y) {
        // Parent hasn't committed the new position yet: render at the old one.
        x = renderedPos.x
        y = renderedPos.y
    }

    const animation = tile.spawned
        ? 'game2048-pop 160ms ease-out 1'
        : tile.merged
            ? 'game2048-merge 160ms ease-out 1'
            : undefined

    // Tiles are 1/SIZE of the board on each axis; a small inset gives the gap.
    return (
        <div
            style={{
                position: 'absolute',
                left: `${x * CELL_PCT}%`,
                top: `${y * CELL_PCT}%`,
                width: `${CELL_PCT}%`,
                height: `${CELL_PCT}%`,
                transition: `left ${SLIDE_MS}ms ease-out, top ${SLIDE_MS}ms ease-out`,
                padding: '0.4cqh',
                boxSizing: 'border-box',
            }}
        >
            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                boxSizing: 'border-box',
                ...style,
                animation,
            }}>
                {tile.value}
            </div>
        </div>
    )
}

function Overlay({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
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
