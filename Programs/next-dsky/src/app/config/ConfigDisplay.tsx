"use client"

interface ConfigState {
    ready: boolean
    step: 'network' | 'serial' | 'source' | 'bridge' | 'manualUrl' | 'yaagc' | 'confirm'
    stepNumber?: number
    serialPort: string | null
    inputSource: string | null
    bridgeUrl?: string
    yaagcVersion?: string
    networkInterface?: string | null
    availablePorts: Array<{ path: string, name: string }>
    discoveredApis: Array<{ ip: string, port: number, url: string, name?: string, version?: string, mode?: string }>
    scanning: boolean
    selectedIndex: number
    options: string[]
    textInput?: string
    wifiConnectAvailable?: boolean
    wifiConnectRunning?: boolean
}

interface ConfigDisplayProps {
    config: ConfigState | null
    onAction: (action: string) => void
    onTextChange?: (text: string) => void
    onWifiConnect?: () => void
}

const STEP_TITLES: Record<string, string> = {
    network: 'Select Network Interface',
    serial: 'Select Serial Port',
    source: 'Select AGC Source',
    bridge: 'Select Bridge Target',
    manualUrl: 'Enter WebSocket URL',
    yaagc: 'Select yaAGC Version',
    confirm: 'Confirm Configuration'
}

export default function ConfigDisplay({ config, onAction, onTextChange, onWifiConnect }: ConfigDisplayProps) {
    if (!config) {
        return (
            <div className="text-green-500 font-mono text-xl">
                Loading configuration...
            </div>
        )
    }

    const { step, options, selectedIndex, scanning, serialPort, inputSource, bridgeUrl, yaagcVersion, textInput } = config
    const wifiBusy = config.wifiConnectRunning === true

    const isValidUrl = (url: string): boolean => {
        try {
            const parsed = new URL(url)
            return parsed.protocol === 'ws:' || parsed.protocol === 'wss:'
        } catch {
            return false
        }
    }

    return (
        <div className="relative w-full max-w-md p-6 bg-gray-900 rounded-lg shadow-xl">
            {/* WiFi config option - above everything, selectable via DSKY keys */}
            {config.wifiConnectAvailable && onWifiConnect && step !== 'manualUrl' && (
                <div className="mb-4">
                    <button
                        onClick={() => onWifiConnect()}
                        disabled={wifiBusy}
                        className={`w-full p-3 text-left font-mono rounded transition-colors border ${
                            selectedIndex === -1
                                ? 'bg-blue-600 text-white border-blue-400'
                                : 'bg-blue-900/50 text-blue-300 hover:bg-blue-800 border-blue-700/50'
                        } ${wifiBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Configure WiFi
                    </button>
                </div>
            )}

            {wifiBusy && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 rounded-lg">
                    <div className="text-center font-mono">
                        <div className="text-blue-300 text-lg">WiFi setup running…</div>
                        <div className="text-gray-300 text-sm mt-2">
                            Scan this code or connect to <span className="text-white">DSKY Replica</span> to finish configuration.
                        </div>
                        <div className="mt-4 flex justify-center">
                            <img
                                src="/wifi-qr.png"
                                alt="WiFi QR for DSKY Replica"
                                className="bg-white p-2 rounded"
                                style={{ width: 180, height: 180 }}
                            />
                        </div>
                        <div className="text-gray-300 text-xs mt-3">Waiting for wifi-connect to finish…</div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="text-center mb-6">
                <div className="text-green-400 text-sm font-mono mb-1">
                    STEP {String(config.stepNumber ?? 1).padStart(2, '0')}
                </div>
                <h1 className="text-green-500 text-2xl font-mono font-bold">
                    {STEP_TITLES[step]}
                </h1>
            </div>

            {/* Scanning indicator */}
            {scanning && (
                <div className="text-center mb-4">
                    <div className="text-yellow-400 font-mono animate-pulse">
                        Discovering DSKY services...
                    </div>
                </div>
            )}

            {/* Manual URL input */}
            {step === 'manualUrl' ? (
                <div className="mb-6">
                    <div className="mb-4">
                        <label className="block text-gray-400 text-sm mb-2 font-mono">
                            WebSocket URL (ws:// or wss://):
                        </label>
                        <input
                            type="text"
                            value={textInput || ''}
                            onChange={(e) => onTextChange?.(e.target.value)}
                            placeholder="wss://example.com/ws"
                            autoFocus
                            disabled={wifiBusy}
                            className={`w-full p-3 bg-gray-800 text-green-400 font-mono rounded border-2 ${
                                textInput && !isValidUrl(textInput)
                                    ? 'border-red-500'
                                    : 'border-gray-700 focus:border-green-500'
                            } outline-none`}
                        />
                        {textInput && !isValidUrl(textInput) && (
                            <p className="text-red-400 text-xs mt-2 font-mono">
                                URL must start with ws:// or wss://
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onAction('back')}
                            disabled={wifiBusy}
                            className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono rounded transition-colors"
                        >
                            ← Cancel
                        </button>
                        <button
                            onClick={() => onAction('select')}
                            disabled={wifiBusy || !textInput || !isValidUrl(textInput)}
                            className={`flex-1 py-3 px-4 font-mono rounded transition-colors ${
                                textInput && isValidUrl(textInput)
                                    ? 'bg-green-600 hover:bg-green-500 text-black'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            Confirm →
                        </button>
                    </div>
                </div>
            ) : (
                /* Options list */
                <div className="space-y-2 mb-6">
                    {options.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                // First select this option, then confirm
                                for (let i = 0; i < Math.abs(index - selectedIndex); i++) {
                                    onAction(index > selectedIndex ? 'next' : 'prev')
                                }
                                setTimeout(() => onAction('select'), 100)
                            }}
                            disabled={wifiBusy}
                            className={`w-full p-3 text-left font-mono rounded transition-colors ${
                                index === selectedIndex
                                    ? 'bg-green-600 text-black'
                                    : 'bg-gray-800 text-green-400 hover:bg-gray-700'
                            } ${wifiBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <span className="mr-2 text-gray-500">{index}.</span>
                            {option}
                        </button>
                    ))}
                </div>
            )}

            {/* Current selection summary (for confirm step) */}
            {step === 'confirm' && (
                <div className="mb-6 p-4 bg-gray-800 rounded font-mono text-sm">
                    <div className="text-gray-400 mb-2">Configuration Summary:</div>
                    <div className="text-green-400">
                        <div>Serial: {serialPort || 'None'}</div>
                        <div>Source: {inputSource || 'Not selected'}</div>
                        {bridgeUrl && <div>Bridge: {bridgeUrl}</div>}
                        {yaagcVersion && <div>yaAGC: {yaagcVersion}</div>}
                    </div>
                </div>
            )}

            {/* Navigation hints - hide during manual URL input */}
            {step !== 'manualUrl' && (
                <div className="border-t border-gray-700 pt-4">
                    <div className="text-gray-500 font-mono text-xs text-center space-y-1">
                        <div>
                            <span className="text-green-400">+</span> / <span className="text-green-400">V</span> / <span className="text-green-400">↑</span> = Prev
                            {' | '}
                            <span className="text-green-400">-</span> / <span className="text-green-400">N</span> / <span className="text-green-400">↓</span> = Next
                        </div>
                        <div>
                            <span className="text-green-400">E</span> / <span className="text-green-400">Enter</span> = Select
                            {' | '}
                            <span className="text-green-400">C</span> / <span className="text-green-400">Esc</span> = Back
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation buttons - hide during manual URL input */}
            {step !== 'manualUrl' && (
                <div className="flex justify-between mt-4">
                    <button
                        onClick={() => onAction('back')}
                        className="px-4 py-2 bg-gray-700 text-gray-300 font-mono rounded hover:bg-gray-600 transition-colors"
                        disabled={wifiBusy || (config.stepNumber ?? 1) <= 1}
                    >
                        ← Back
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onAction('prev')}
                            className="px-4 py-2 bg-gray-700 text-green-400 font-mono rounded hover:bg-gray-600 transition-colors"
                            disabled={wifiBusy}
                        >
                            ↑
                        </button>
                        <button
                            onClick={() => onAction('next')}
                            className="px-4 py-2 bg-gray-700 text-green-400 font-mono rounded hover:bg-gray-600 transition-colors"
                            disabled={wifiBusy}
                        >
                            ↓
                        </button>
                    </div>
                    <button
                        onClick={() => onAction('select')}
                        className="px-4 py-2 bg-green-600 text-black font-mono rounded hover:bg-green-500 transition-colors"
                        disabled={wifiBusy}
                    >
                        Select →
                    </button>
                </div>
            )}
        </div>
    )
}
