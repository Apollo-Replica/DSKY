import type { StopwatchAppState } from "../../../types/serverState"
import { formatElapsed, K } from "./formatters"

export default function StopwatchMode({ state, elapsed }: { state: StopwatchAppState; elapsed: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ fontSize: '7cqh', color: 'var(--menu-primary)', textAlign: 'center', fontWeight: 700, padding: '2cqh 0', fontFamily: 'monospace' }}>
                {formatElapsed(elapsed)}
            </div>
            <div style={{ fontSize: '2.5cqh', color: state.running ? '#4ade80' : 'var(--menu-secondary)', textAlign: 'center', marginBottom: '1.5cqh' }}>
                {state.running ? 'RUNNING' : elapsed > 0 ? 'STOPPED' : 'READY'}
            </div>
            {state.laps.length > 0 && (
                <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', borderTop: '1px solid var(--menu-border)', paddingTop: '1cqh' }}>
                    {state.laps.map((lapMs, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2.5cqh', color: 'var(--menu-secondary)', padding: '0.3cqh 0' }}>
                            <span style={{ color: 'var(--menu-accent)' }}>L{i + 1}</span>
                            <span>{formatElapsed(lapMs)}</span>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ fontSize: '2.2cqh', color: 'var(--menu-secondary)', textAlign: 'center', marginTop: '1cqh' }}>
                <K>ENTR</K> {state.running ? 'stop' : 'start'}{' \u00A0 '}<K>CLR</K> {state.running ? 'lap' : 'reset'}
            </div>
        </div>
    )
}
