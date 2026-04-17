"use client"

import { useEffect, useRef, useState } from "react"
import type { FlappyState } from "../../../types/serverState"

// Must mirror server FLAPPY_CONFIG for correct client-side interpolation.
const CONFIG = {
    GRAVITY: 2.2,
    MAX_VY: 1.4,
    MIN_VY: -1.0,
    SCROLL_SPEED: 0.32,
    SHIP_SIZE: 0.06,
    SHIP_X: 0.22,
    OBSTACLE_WIDTH: 0.1,
}

function clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v
}

interface InterpolatedState {
    shipY: number
    shipVy: number
    obstacles: { x: number; gapY: number; gapSize: number }[]
}

function interpolate(state: FlappyState, dtSec: number): InterpolatedState {
    if (state.phase !== 'playing' || dtSec <= 0) {
        return {
            shipY: state.shipY,
            shipVy: state.shipVy,
            obstacles: state.obstacles.map(o => ({ x: o.x, gapY: o.gapY, gapSize: o.gapSize })),
        }
    }
    const vy = clamp(state.shipVy + CONFIG.GRAVITY * dtSec, CONFIG.MIN_VY, CONFIG.MAX_VY)
    const y = clamp(state.shipY + vy * dtSec, 0, 1)
    return {
        shipY: y,
        shipVy: vy,
        obstacles: state.obstacles.map(o => ({
            x: o.x - CONFIG.SCROLL_SPEED * dtSec,
            gapY: o.gapY,
            gapSize: o.gapSize,
        })),
    }
}

interface FlappyGameProps {
    state: FlappyState
}

export default function FlappyGame({ state }: FlappyGameProps) {
    const [, setFrame] = useState(0)
    const rafRef = useRef<number>(0)

    // Track when each new server state arrived locally. Interpolating against
    // server tickMs risks clock skew; use local receive time instead.
    const stateReceivedAtRef = useRef<number>(performance.now())
    const prevTickMsRef = useRef<number>(state.tickMs)
    if (state.tickMs !== prevTickMsRef.current) {
        prevTickMsRef.current = state.tickMs
        stateReceivedAtRef.current = performance.now()
    }

    useEffect(() => {
        if (state.phase !== 'playing') return
        const loop = () => {
            setFrame(performance.now())
            rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(rafRef.current)
    }, [state.phase])

    const dt = state.phase === 'playing'
        ? Math.min(0.1, (performance.now() - stateReceivedAtRef.current) / 1000)
        : 0
    const interp = interpolate(state, dt)

    const shipX = CONFIG.SHIP_X * 100
    const shipY = interp.shipY * 100
    const shipSize = CONFIG.SHIP_SIZE * 100
    const obstacleW = CONFIG.OBSTACLE_WIDTH * 100

    // Triangle pointing right (nose)
    const tipX = shipX + shipSize / 2
    const tailX = shipX - shipSize / 2
    const topY = shipY - shipSize / 2
    const botY = shipY + shipSize / 2
    const tilt = clamp(interp.shipVy * 15, -20, 30) // degrees, nose down when falling
    const shipPath = `M ${tipX} ${shipY} L ${tailX} ${topY} L ${tailX + shipSize * 0.35} ${shipY} L ${tailX} ${botY} Z`

    const primary = 'var(--menu-primary, #5ef08a)'
    const secondary = 'var(--menu-secondary, #2a7a44)'
    const bg = '#000'

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: bg,
            fontFamily: 'Gorton, "Arial Narrow", sans-serif',
            color: primary,
            overflow: 'hidden',
        }}>
            <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            >
                {/* Stars (decorative) */}
                {[[12, 18], [72, 8], [42, 28], [88, 42], [22, 62], [60, 78], [8, 88], [92, 82]].map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={0.3} fill={secondary} opacity={0.6} />
                ))}

                {/* Obstacles (asteroid pillars with a gap) */}
                {interp.obstacles.map((o, i) => {
                    const ox = o.x * 100
                    const gapTop = o.gapY * 100
                    const gapBot = (o.gapY + o.gapSize) * 100
                    return (
                        <g key={i}>
                            <rect x={ox} y={0} width={obstacleW} height={gapTop} fill={primary} opacity={0.85} />
                            <rect x={ox} y={gapBot} width={obstacleW} height={100 - gapBot} fill={primary} opacity={0.85} />
                            <rect x={ox} y={0} width={obstacleW} height={gapTop} fill="none" stroke={bg} strokeWidth={0.3} />
                            <rect x={ox} y={gapBot} width={obstacleW} height={100 - gapBot} fill="none" stroke={bg} strokeWidth={0.3} />
                        </g>
                    )
                })}

                {/* Ship */}
                <g transform={`rotate(${tilt} ${shipX} ${shipY})`}>
                    <path d={shipPath} fill={primary} />
                    {state.phase === 'playing' && interp.shipVy < -0.3 && (
                        <path
                            d={`M ${tailX} ${shipY - shipSize * 0.2} L ${tailX - shipSize * 0.6} ${shipY} L ${tailX} ${shipY + shipSize * 0.2} Z`}
                            fill={secondary}
                            opacity={Math.min(1, -interp.shipVy / 0.75)}
                        />
                    )}
                </g>
            </svg>

            {/* Score */}
            <div style={{
                position: 'absolute',
                top: '2cqh',
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: '6cqh',
                fontWeight: 700,
                color: primary,
                textShadow: '0 0 4px rgba(94,240,138,0.5)',
                pointerEvents: 'none',
            }}>
                {state.score}
            </div>

            {/* Ready overlay */}
            {state.phase === 'ready' && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.55)',
                    textAlign: 'center',
                    padding: '4cqh',
                }}>
                    <div style={{ fontSize: '5cqh', fontWeight: 700, marginBottom: '2cqh', color: primary }}>
                        FLAPPY ROCKET
                    </div>
                    <div style={{ fontSize: '3cqh', color: primary, marginBottom: '2cqh' }}>
                        PRO to flap
                    </div>
                    <div style={{ fontSize: '2.6cqh', color: secondary }}>
                        RSET back · NOUN NOUN NOUN exit
                    </div>
                    {state.best > 0 && (
                        <div style={{ fontSize: '2.4cqh', color: secondary, marginTop: '2cqh' }}>
                            BEST: {state.best}
                        </div>
                    )}
                </div>
            )}

            {/* Game over overlay */}
            {state.phase === 'gameover' && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.65)',
                    textAlign: 'center',
                    padding: '4cqh',
                }}>
                    <div style={{ fontSize: '5cqh', fontWeight: 700, marginBottom: '1.5cqh', color: '#f87171' }}>
                        GAME OVER
                    </div>
                    <div style={{ fontSize: '3.4cqh', color: primary, marginBottom: '0.8cqh' }}>
                        SCORE: {state.score}
                    </div>
                    <div style={{ fontSize: '2.8cqh', color: secondary, marginBottom: '2.5cqh' }}>
                        BEST: {state.best}
                    </div>
                    <div style={{ fontSize: '2.6cqh', color: secondary }}>
                        PRO retry · RSET back · NOUN NOUN NOUN exit
                    </div>
                </div>
            )}
        </div>
    )
}
