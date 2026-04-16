import type { AlarmAppState } from "../../../types/serverState"
import { formatInputDigits4, K } from "./formatters"

export default function AlarmMode({ state, currentTime, blinkVisible }: { state: AlarmAppState; currentTime: string; blinkVisible: boolean }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ fontSize: '2.5cqh', color: 'var(--menu-secondary)', textAlign: 'center' }}>NOW</div>
            <div style={{ fontSize: '6cqh', color: 'var(--menu-primary)', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace' }}>{currentTime}</div>
            <div style={{ borderTop: '1px solid var(--menu-border)', marginTop: '1.5cqh', paddingTop: '1.5cqh' }}>
                <div style={{ fontSize: '2.5cqh', color: state.triggered ? '#f87171' : state.armed ? '#4ade80' : 'var(--menu-secondary)', textAlign: 'center' }}>
                    {state.triggered ? 'ALARM!' : state.armed ? 'ARMED' : 'SET ALARM (HHMM)'}
                </div>
                <div style={{
                    fontSize: '5cqh',
                    color: state.triggered ? (blinkVisible ? '#f87171' : 'transparent') : state.armed ? 'var(--menu-accent)' : 'var(--menu-primary)',
                    textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', padding: '1cqh 0', transition: 'color 0.15s',
                }}>
                    {state.armed || state.triggered ? state.alarmTime : formatInputDigits4(state.inputDigits)}
                </div>
            </div>
            <div style={{ fontSize: '2.2cqh', color: 'var(--menu-secondary)', textAlign: 'center', marginTop: 'auto' }}>
                {state.triggered ? <span>any key to dismiss</span>
                    : state.armed ? <><K>CLR</K> disarm</>
                        : <><K>0-9</K> time{' \u00A0 '}<K>ENTR</K> arm{' \u00A0 '}<K>CLR</K> del</>}
            </div>
        </div>
    )
}
