export function formatElapsed(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    const hundredths = Math.floor((ms % 1000) / 10)
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}

export function formatMs(ms: number): string {
    const totalSec = Math.ceil(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatPomodoroMs(ms: number): string {
    const totalSec = Math.ceil(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatDigitsAsTime(digits: string): string {
    const padded = digits.padStart(6, '0')
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`
}

export function getCurrentTimeStr(): string {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
}

export function formatInputDigits4(digits: string): string {
    const padded = digits.padStart(4, '0')
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`
}

export function K({ children }: { children: React.ReactNode }) {
    return <span style={{ color: 'var(--menu-primary)', fontWeight: 600 }}>{children}</span>
}
