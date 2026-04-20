"use client"

import type { ServerState } from "../../types/serverState"

interface CalculatorAppProps {
    serverState: ServerState
}

export default function CalculatorApp({ serverState }: CalculatorAppProps) {
    const calc = serverState.app.calculator
    if (!calc) return null

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: '2.5cqh 3cqw',
            boxSizing: 'border-box',
            fontFamily: 'var(--font-share-tech-mono), ui-monospace, Consolas, monospace',
            color: 'var(--menu-primary)',
        }}>
            {/* Expression line */}
            <div style={{
                fontSize: '2.8cqh',
                color: 'var(--menu-secondary)',
                textAlign: 'right',
                minHeight: '3.5cqh',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                direction: 'rtl',
            }}>
                {calc.expression || '\u00A0'}
            </div>

            {/* Display / result */}
            <div style={{
                fontSize: '6cqh',
                color: calc.error ? '#f87171' : 'var(--menu-primary)',
                textAlign: 'right',
                fontWeight: 700,
                padding: '1cqh 0',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                flexShrink: 0,
            }}>
                {calc.display}
            </div>

            {/* Separator */}
            <div style={{
                borderTop: '1px solid var(--menu-border)',
                margin: '1cqh 0',
            }} />

            {/* Key hints */}
            <div style={{
                fontSize: '2.2cqh',
                color: 'var(--menu-secondary)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.8cqh 2cqw',
            }}>
                <span><K>0-9</K> digits</span>
                <span><K>ENTR</K> {'='}</span>
                <span><K>+</K> add/mul</span>
                <span><K>CLR</K> del</span>
                <span><K>-</K> sub/div</span>
                <span><K>RSET</K> clear</span>
                <span><K>NNN</K> menu</span>
            </div>
        </div>
    )
}

function K({ children }: { children: React.ReactNode }) {
    return (
        <span style={{ color: 'var(--menu-primary)', fontWeight: 600 }}>
            {children}
        </span>
    )
}
