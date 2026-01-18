"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import ConfigDisplay from "./ConfigDisplay"

interface ConfigState {
    ready: boolean
    step: 'serial' | 'source' | 'bridge' | 'yaagc' | 'confirm'
    serialPort: string | null
    inputSource: string | null
    bridgeUrl?: string
    yaagcVersion?: string
    availablePorts: Array<{ path: string, name: string }>
    discoveredApis: Array<{ ip: string, port: number, url: string, name?: string }>
    scanning: boolean
    selectedIndex: number
    options: string[]
    resetDisabled?: boolean
}

export default function ConfigPageContent() {
    const router = useRouter()
    const [configState, setConfigState] = useState<ConfigState | null>(null)
    const [connected, setConnected] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const mountedRef = useRef(true)

    const connect = useCallback(() => {
        // Don't connect if unmounted or already connected/connecting
        if (!mountedRef.current) return
        if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
            return
        }
        
        console.log('[ConfigPage] Connecting WebSocket...')
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsURL = `${protocol}//${window.location.host}/ws`

        const ws = new WebSocket(wsURL)
        wsRef.current = ws

        ws.onopen = () => {
            console.log('[ConfigPage] WebSocket connected')
            if (mountedRef.current) setConnected(true)
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (data.config && mountedRef.current) {
                    setConfigState(data.config)
                }
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e)
            }
        }

        ws.onclose = (event) => {
            console.log('[ConfigPage] WebSocket closed. Code:', event.code)
            if (mountedRef.current) {
                setConnected(false)
                // Reconnect after 1 second
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (mountedRef.current) connect()
                }, 1000)
            }
        }

        ws.onerror = () => {
            console.log('[ConfigPage] WebSocket error')
            if (mountedRef.current) setConnected(false)
        }
    }, [])

    // Set up WebSocket connection
    useEffect(() => {
        mountedRef.current = true
        connect()

        return () => {
            console.log('[ConfigPage] Cleanup - unmounting')
            mountedRef.current = false
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, [connect])

    // Keyboard event handling
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const ws = wsRef.current
            if (!ws || ws.readyState !== WebSocket.OPEN) return
            if (event.repeat) return

            const key = event.key.toLowerCase()

            // Map keyboard to config actions
            switch (key) {
                case 'arrowup':
                case 'w':
                    sendConfigMessage('config:prev')
                    event.preventDefault()
                    break
                case 'arrowdown':
                case 's':
                    sendConfigMessage('config:next')
                    event.preventDefault()
                    break
                case 'enter':
                case ' ':
                    sendConfigMessage('config:select')
                    event.preventDefault()
                    break
                case 'escape':
                case 'backspace':
                    sendConfigMessage('config:back')
                    event.preventDefault()
                    break
                default:
                    // Forward single character keys for DSKY keyboard
                    if (key.length === 1) {
                        ws.send(key)
                    }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const sendConfigMessage = (type: string, data?: any) => {
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, ...data }))
        }
    }

    const handleAction = (action: string) => {
        switch (action) {
            case 'next':
                sendConfigMessage('config:next')
                break
            case 'prev':
                sendConfigMessage('config:prev')
                break
            case 'select':
                sendConfigMessage('config:select')
                break
            case 'back':
                sendConfigMessage('config:back')
                break
            case 'refresh':
                sendConfigMessage('config:refresh-ports')
                break
            case 'scan':
                sendConfigMessage('config:scan-apis')
                break
        }
    }

    const handleReset = () => {
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'config:reset' }))
        }
    }

    const handleBackToDsky = () => {
        router.push('/')
    }

    if (!connected) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-black text-green-500 font-mono">
                <div className="text-xl">Connecting to DSKY API...</div>
            </main>
        )
    }

    // If config is ready (running mode), show current settings instead of config wizard
    if (configState?.ready) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-black text-green-500 font-mono p-8">
                <div className="max-w-md w-full space-y-6">
                    <h1 className="text-2xl font-bold text-center mb-8">Current Configuration</h1>
                    
                    <div className="space-y-4 bg-gray-900 p-6 rounded-lg">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Serial Port:</span>
                            <span>{configState.serialPort || 'None'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Input Source:</span>
                            <span>{configState.inputSource || 'None'}</span>
                        </div>
                        {configState.bridgeUrl && (
                            <div className="flex justify-between">
                                <span className="text-gray-400">Bridge URL:</span>
                                <span className="truncate ml-2">{configState.bridgeUrl}</span>
                            </div>
                        )}
                        {configState.yaagcVersion && (
                            <div className="flex justify-between">
                                <span className="text-gray-400">yaAGC Version:</span>
                                <span>{configState.yaagcVersion}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 mt-8">
                        <button
                            onClick={handleBackToDsky}
                            className="w-full py-3 px-4 bg-green-700 hover:bg-green-600 text-white font-semibold rounded transition-colors"
                        >
                            Back to DSKY
                        </button>
                        {!configState.resetDisabled && (
                            <button
                                onClick={handleReset}
                                className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded transition-colors"
                            >
                                Reconfigure
                            </button>
                        )}
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-black">
            <ConfigDisplay config={configState} onAction={handleAction} />
        </main>
    )
}
