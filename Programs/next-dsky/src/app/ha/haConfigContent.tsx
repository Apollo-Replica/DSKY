"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import type { ServerState, DiscoveredEntity } from '../../types/serverState'

export default function HaConfigContent() {
    const [serverState, setServerState] = useState<ServerState | null>(null)
    const [wsConnected, setWsConnected] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)
    const mountedRef = useRef(true)

    // Form state
    const [url, setUrl] = useState('http://')
    const [token, setToken] = useState('')
    const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([])

    const sendMessage = useCallback((type: string, data?: Record<string, unknown>) => {
        const ws = wsRef.current
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, ...data }))
        }
    }, [])

    // WebSocket connection
    useEffect(() => {
        mountedRef.current = true
        let reconnectTimeout: NodeJS.Timeout | null = null

        const connect = () => {
            if (!mountedRef.current) return
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const wsURL = `${protocol}//${window.location.host}/ws`
            const ws = new WebSocket(wsURL)
            wsRef.current = ws

            ws.onopen = () => {
                if (mountedRef.current) setWsConnected(true)
            }
            ws.onclose = () => {
                if (mountedRef.current) {
                    setWsConnected(false)
                    reconnectTimeout = setTimeout(connect, 1000)
                }
            }
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data)
                if (data.serverState && mountedRef.current) {
                    setServerState(data.serverState)
                }
            }
        }

        connect()

        return () => {
            mountedRef.current = false
            if (reconnectTimeout) clearTimeout(reconnectTimeout)
            wsRef.current?.close()
            wsRef.current = null
        }
    }, [])

    // Sync entity selection from server
    useEffect(() => {
        if (serverState?.ha?.selectedIds) {
            setLocalSelectedIds(serverState.ha.selectedIds)
        } else if (serverState?.ha?.entities) {
            setLocalSelectedIds(serverState.ha.entities.map(e => e.entity_id))
        }
    }, [serverState?.ha?.selectedIds, serverState?.ha?.entities])

    const ha = serverState?.ha
    const entities = ha?.entities ?? []
    const isConfigured = ha?.configured === true
    const isDiscovering = !ha?.error && !ha?.entities && url !== 'http://' && token.length > 0
    const hasEntities = entities.length > 0

    const handleDiscover = () => {
        sendMessage('action:discover-ha', { url, token })
    }

    const handleConfigure = () => {
        sendMessage('action:ha-configure', {
            url,
            token,
            entityIds: localSelectedIds,
            entities,
        })
    }

    const handleReconfigure = () => {
        sendMessage('action:ha-reconfigure')
        setUrl('http://')
        setToken('')
        setLocalSelectedIds([])
    }

    const toggleEntity = (entityId: string) => {
        setLocalSelectedIds(prev =>
            prev.includes(entityId)
                ? prev.filter(id => id !== entityId)
                : [...prev, entityId]
        )
    }

    const allSelected = entities.length > 0 && entities.every(e => localSelectedIds.includes(e.entity_id))
    const toggleSelectAll = () => {
        if (allSelected) setLocalSelectedIds([])
        else setLocalSelectedIds(entities.map(e => e.entity_id))
    }

    if (!wsConnected) {
        return (
            <Page>
                <Card>
                    <Title>Connecting to DSKY...</Title>
                    <Hint>Make sure the DSKY server is running.</Hint>
                </Card>
            </Page>
        )
    }

    // --- Configured state ---
    if (isConfigured) {
        return (
            <Page>
                <Card>
                    <Title>Home Assistant</Title>
                    <StatusBadge active>CONFIGURED</StatusBadge>
                    {ha?.url && <Hint>{ha.url}</Hint>}
                    {ha?.selectedIds && <Hint>{ha.selectedIds.length} entities active</Hint>}
                    <Spacer />
                    <Button onClick={handleReconfigure} variant="danger">
                        Reconfigure
                    </Button>
                    <Hint style={{ marginTop: 12 }}>
                        This will stop the current Home Assistant integration and allow you to set up a new connection.
                    </Hint>
                </Card>
            </Page>
        )
    }

    // --- Setup wizard ---
    return (
        <Page>
            <Card>
                <Title>Home Assistant Setup</Title>

                {/* Step 1: URL */}
                <Label>Home Assistant URL</Label>
                <Input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="http://homeassistant.local:8123"
                />

                {/* Step 2: Token */}
                <Label>Long-Lived Access Token</Label>
                <Input
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="Paste your token here"
                    type="password"
                />

                {/* Discover button */}
                {!hasEntities && (
                    <>
                        <Spacer />
                        <Button
                            onClick={handleDiscover}
                            disabled={!url.startsWith('http') || token.trim().length === 0}
                        >
                            Discover Entities
                        </Button>
                    </>
                )}

                {/* Error */}
                {ha?.error && (
                    <ErrorText>{ha.error}</ErrorText>
                )}

                {/* Discovering... */}
                {isDiscovering && !ha?.error && (
                    <Hint style={{ textAlign: 'center', marginTop: 16, color: '#4ade80' }}>
                        Discovering entities...
                    </Hint>
                )}

                {/* Entity list */}
                {hasEntities && (
                    <>
                        <Spacer />
                        <Label>Entities ({localSelectedIds.length}/{entities.length} selected)</Label>

                        <CheckboxRow onClick={toggleSelectAll}>
                            <Checkbox checked={allSelected} readOnly />
                            <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
                        </CheckboxRow>

                        <EntityList>
                            {entities.map(entity => (
                                <CheckboxRow key={entity.entity_id} onClick={() => toggleEntity(entity.entity_id)}>
                                    <Checkbox checked={localSelectedIds.includes(entity.entity_id)} readOnly />
                                    <span>{entity.friendly_name}</span>
                                    <Domain>{entity.domain}</Domain>
                                </CheckboxRow>
                            ))}
                        </EntityList>

                        <Spacer />
                        <Button
                            onClick={handleConfigure}
                            disabled={localSelectedIds.length === 0}
                        >
                            Confirm &amp; Start
                        </Button>
                    </>
                )}
            </Card>
        </Page>
    )
}

// --- Styled helpers (inline styles, no CSS modules needed) ---

function Page({ children }: { children: React.ReactNode }) {
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

function Card({ children }: { children: React.ReactNode }) {
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

function Title({ children }: { children: React.ReactNode }) {
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

function Label({ children }: { children: React.ReactNode }) {
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

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
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

function Button({ children, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'danger' }) {
    const isDanger = variant === 'danger'
    return (
        <button
            {...props}
            style={{
                width: '100%',
                padding: '12px 16px',
                background: isDanger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(74, 222, 128, 0.15)',
                border: `1px solid ${isDanger ? '#ef4444' : '#4ade80'}`,
                borderRadius: 6,
                color: isDanger ? '#ef4444' : '#4ade80',
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

function StatusBadge({ children, active }: { children: React.ReactNode; active?: boolean }) {
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

function Hint({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
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

function ErrorText({ children }: { children: React.ReactNode }) {
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

function Spacer() {
    return <div style={{ height: 16 }} />
}

function EntityList({ children }: { children: React.ReactNode }) {
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

function CheckboxRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
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

function Checkbox(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            type="checkbox"
            {...props}
            style={{ accentColor: '#4ade80', cursor: 'pointer', flexShrink: 0 }}
        />
    )
}

function Domain({ children }: { children: React.ReactNode }) {
    return (
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#525252' }}>
            {children}
        </span>
    )
}
