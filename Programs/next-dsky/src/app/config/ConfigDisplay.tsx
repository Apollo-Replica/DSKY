"use client"

import { assignNouns } from "../../utils/nounAssignment"
import type { ConfigState } from "../../types/config"

interface ConfigDisplayProps {
    config: ConfigState | null
    onAction: (action: string) => void
    onTextChange?: (text: string) => void
    onToggleEntity?: (index: number) => void
    onWifiConnect?: () => void
}

const STEP_TITLES: Record<string, string> = {
    network: 'Select Network Interface',
    serial: 'Select Serial Port',
    source: 'Select AGC Source',
    bridge: 'Select Bridge Target',
    manualUrl: 'Enter WebSocket URL',
    yaagc: 'Select yaAGC Version',
    haSetup: 'Home Assistant Setup',
    haUrl: 'Home Assistant URL',
    haToken: 'Access Token',
    haDiscover: 'Discovering Devices',
    haEntities: 'Select Devices',
    confirm: 'Confirm Configuration'
}

export default function ConfigDisplay({ config, onAction, onTextChange, onToggleEntity, onWifiConnect }: ConfigDisplayProps) {
    if (!config) {
        return (
            <div className="text-green-500 font-mono text-xl">
                Loading configuration...
            </div>
        )
    }

    const { step, options, selectedIndex, scanning, serialPort, inputSource, bridgeUrl, yaagcVersion, textInput } = config
    const wifiBusy = config.wifiConnectRunning === true

    const isTextInputStep = step === 'manualUrl' || step === 'haUrl' || step === 'haToken'
    // Only hide standard nav for steps that truly can't use it
    const hideNavigation = step === 'manualUrl' || step === 'haDiscover'

    const getTextInputConfig = () => {
        if (step === 'manualUrl') return { label: 'WebSocket URL (ws:// or wss://):', placeholder: 'wss://example.com/ws', type: 'text', errorMsg: 'URL must start with ws:// or wss://' }
        if (step === 'haUrl') return { label: 'Home Assistant URL (http:// or https://):', placeholder: 'http://homeassistant.local:8123', type: 'text', errorMsg: 'URL must start with http:// or https://' }
        if (step === 'haToken') return { label: 'Long-Lived Access Token:', placeholder: 'Paste your token here', type: 'text', errorMsg: '' }
        return { label: '', placeholder: '', type: 'text', errorMsg: '' }
    }

    const isTextInputValid = (): boolean => {
        const val = (textInput || '').trim()
        if (!val) return false
        if (step === 'manualUrl') {
            try { const p = new URL(val); return p.protocol === 'ws:' || p.protocol === 'wss:' } catch { return false }
        }
        if (step === 'haUrl') {
            try { const p = new URL(val); return p.protocol === 'http:' || p.protocol === 'https:' } catch { return false }
        }
        if (step === 'haToken') return val.length > 0
        return true
    }

    return (
        <div className="relative w-full max-w-md p-6 bg-gray-900 rounded-lg shadow-xl">
            {/* WiFi config option - above everything, selectable via DSKY keys */}
            {config.wifiConnectAvailable && onWifiConnect && !isTextInputStep && step !== 'haSetup' && step !== 'haDiscover' && (
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

            {/* haSetup: informational step with standard navigation */}
            {step === 'haSetup' && (
                <div className="mb-6">
                    <div className="p-4 bg-gray-800 rounded font-mono text-sm mb-4">
                        <div className="text-gray-300 mb-3">
                            You will need your Home Assistant URL and a long-lived access token.
                            Generate one at <span className="text-green-400">Settings &gt; Devices &gt; Helpers &gt; Long-Lived Access Tokens</span> in your HA dashboard.
                        </div>
                        <div className="text-gray-300 mb-3">
                            A keyboard is required for setup. Open this URL from your phone or computer:
                        </div>
                        <div className="text-green-400 text-lg text-center py-2 bg-gray-900 rounded mb-3 select-all">
                            {config.localUrl || 'http://localhost:3000/config'}
                        </div>
                        <div className="text-gray-500 text-xs text-center">
                            Both screens will stay in sync.
                        </div>
                    </div>
                </div>
            )}

            {/* haDiscover: loading/error state */}
            {step === 'haDiscover' && (
                <div className="mb-6 text-center font-mono">
                    {config.haDiscoverError ? (
                        <div>
                            <div className="text-red-400 text-lg mb-2">Discovery Failed</div>
                            <div className="text-gray-400 text-sm mb-4">{config.haDiscoverError}</div>
                            <button
                                onClick={() => onAction('back')}
                                className="py-3 px-6 bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono rounded transition-colors"
                            >
                                ← Back
                            </button>
                        </div>
                    ) : (
                        <div className="text-yellow-400 animate-pulse text-lg">
                            Connecting to Home Assistant...
                        </div>
                    )}
                </div>
            )}

            {/* Text input steps (manualUrl, haUrl, haToken) */}
            {isTextInputStep && (
                <div className="mb-6">
                    <div className="mb-4">
                        <label className="block text-gray-400 text-sm mb-2 font-mono">
                            {getTextInputConfig().label}
                        </label>
                        <input
                            type={getTextInputConfig().type}
                            value={textInput || ''}
                            onChange={(e) => onTextChange?.(e.target.value)}
                            placeholder={getTextInputConfig().placeholder}
                            autoFocus
                            disabled={wifiBusy}
                            className={`w-full p-3 bg-gray-800 text-green-400 font-mono rounded border-2 ${
                                textInput && !isTextInputValid()
                                    ? 'border-red-500'
                                    : 'border-gray-700 focus:border-green-500'
                            } outline-none`}
                        />
                        {textInput && !isTextInputValid() && getTextInputConfig().errorMsg && (
                            <p className="text-red-400 text-xs mt-2 font-mono">
                                {getTextInputConfig().errorMsg}
                            </p>
                        )}
                    </div>
                    {/* manualUrl keeps its own buttons (no standard nav) */}
                    {step === 'manualUrl' && (
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
                                disabled={wifiBusy || !isTextInputValid()}
                                className={`flex-1 py-3 px-4 font-mono rounded transition-colors ${
                                    isTextInputValid()
                                        ? 'bg-green-600 hover:bg-green-500 text-black'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                Confirm →
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* haEntities uses the standard options list below */}

            {/* Standard options list (for steps without special rendering) */}
            {!isTextInputStep && step !== 'haDiscover' && (
                <div className="space-y-2 mb-6">
                    {options.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                if (step === 'haEntities' && onToggleEntity) {
                                    onToggleEntity(index)
                                } else {
                                    for (let i = 0; i < Math.abs(index - selectedIndex); i++) {
                                        onAction(index > selectedIndex ? 'next' : 'prev')
                                    }
                                    setTimeout(() => onAction('select'), 100)
                                }
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
                        {config.haUrl && <div>HA: {config.haUrl}</div>}
                        {config.haSelectedEntityIds && (
                            <div>Devices: {config.haSelectedEntityIds.length} selected</div>
                        )}
                    </div>
                    {inputSource === 'homeassistant' && config.haSelectedEntityIds && config.haEntities && (() => {
                        const assignments = assignNouns(config.haSelectedEntityIds!, config.haEntities!)
                        return (
                            <div className="mt-3 pt-3 border-t border-gray-700">
                                {assignments.length > 0 && (
                                    <div className="mb-2">
                                        <div className="text-gray-400 mb-1">Device assignments:</div>
                                        <div className="text-gray-300 text-xs space-y-0.5">
                                            {assignments.map(a => (
                                                <div key={a.noun}>
                                                    <span className="text-yellow-400">N{a.noun}</span> {a.friendlyName}
                                                    {a.toggleable && <span className="text-gray-500"> — V40 N{a.noun} ENTR</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="text-gray-400 mb-1">Commands:</div>
                                <div className="text-gray-300 text-xs space-y-0.5">
                                    <div>V16 N36 ENTR = Clock</div>
                                    <div>V35 ENTR = Lamp test</div>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            )}

            {/* Navigation hints - hide during special steps */}
            {!hideNavigation && (
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

            {/* Navigation buttons - hide during special steps */}
            {!hideNavigation && (
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
