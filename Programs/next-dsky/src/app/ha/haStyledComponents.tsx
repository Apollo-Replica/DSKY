import React from 'react'

export function Page({ children }: { children: React.ReactNode }) {
    return (
        <main style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            backgroundColor: '#0a0a0a',
            padding: '40px 16px',
            fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
            color: '#e5e5e5',
        }}>
            {children}
        </main>
    )
}

export function Card({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            width: '100%',
            maxWidth: 480,
            background: '#141414',
            border: '1px solid #262626',
            borderRadius: 12,
            padding: '32px 24px',
        }}>
            {children}
        </div>
    )
}

export function Title({ children }: { children: React.ReactNode }) {
    return (
        <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#4ade80',
            margin: '0 0 24px 0',
            textAlign: 'center',
            fontFamily: 'monospace',
            letterSpacing: 1,
        }}>
            {children}
        </h1>
    )
}

export function Label({ children }: { children: React.ReactNode }) {
    return (
        <label style={{
            display: 'block',
            fontSize: 13,
            color: '#a3a3a3',
            marginBottom: 6,
            marginTop: 16,
        }}>
            {children}
        </label>
    )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: 6,
                color: '#e5e5e5',
                fontSize: 14,
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box',
                ...props.style,
            }}
        />
    )
}

export function Button({ children, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'danger' | 'secondary' }) {
    const colors = variant === 'danger'
        ? { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#ef4444' }
        : variant === 'secondary'
            ? { bg: 'rgba(255, 255, 255, 0.05)', border: '#444', text: '#999' }
            : { bg: 'rgba(74, 222, 128, 0.15)', border: '#4ade80', text: '#4ade80' }

    return (
        <button
            {...props}
            style={{
                width: '100%',
                padding: '12px 16px',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                color: colors.text,
                fontSize: 14,
                fontWeight: 600,
                cursor: props.disabled ? 'not-allowed' : 'pointer',
                opacity: props.disabled ? 0.4 : 1,
                fontFamily: 'monospace',
                ...props.style,
            }}
        >
            {children}
        </button>
    )
}

export function StatusBadge({ children, active }: { children: React.ReactNode; active?: boolean }) {
    return (
        <div style={{
            textAlign: 'center',
            padding: '6px 12px',
            background: active ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${active ? '#4ade80' : '#333'}`,
            borderRadius: 6,
            color: active ? '#4ade80' : '#888',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'monospace',
            letterSpacing: 1,
        }}>
            {children}
        </div>
    )
}

export function Hint({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            fontSize: 12,
            color: '#737373',
            marginTop: 8,
            textAlign: 'center',
            ...style,
        }}>
            {children}
        </div>
    )
}

export function ErrorText({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 6,
            color: '#ef4444',
            fontSize: 13,
            textAlign: 'center',
        }}>
            {children}
        </div>
    )
}

export function Spacer() {
    return <div style={{ height: 16 }} />
}

export function EntityList({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            maxHeight: 300,
            overflowY: 'auto',
            border: '1px solid #262626',
            borderRadius: 6,
            marginTop: 8,
        }}>
            {children}
        </div>
    )
}

export function CheckboxRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
        <div
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #1a1a1a',
                fontSize: 13,
            }}
        >
            {children}
        </div>
    )
}

export function Checkbox(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            type="checkbox"
            {...props}
            style={{ accentColor: '#4ade80', cursor: 'pointer', flexShrink: 0 }}
        />
    )
}

export function Domain({ children }: { children: React.ReactNode }) {
    return (
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#525252' }}>
            {children}
        </span>
    )
}
