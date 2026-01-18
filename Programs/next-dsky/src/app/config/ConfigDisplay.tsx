"use client"

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
}

interface ConfigDisplayProps {
    config: ConfigState | null
    onAction: (action: string) => void
}

const STEP_TITLES: Record<string, string> = {
    serial: 'Select Serial Port',
    source: 'Select AGC Source',
    bridge: 'Select Bridge Target',
    yaagc: 'Select yaAGC Version',
    confirm: 'Confirm Configuration'
}

const STEP_NUMBERS: Record<string, string> = {
    serial: '01',
    source: '02',
    bridge: '03',
    yaagc: '03',
    confirm: '04'
}

export default function ConfigDisplay({ config, onAction }: ConfigDisplayProps) {
    if (!config) {
        return (
            <div className="text-green-500 font-mono text-xl">
                Loading configuration...
            </div>
        )
    }

    const { step, options, selectedIndex, scanning, serialPort, inputSource, bridgeUrl, yaagcVersion } = config

    return (
        <div className="w-full max-w-md p-6 bg-gray-900 rounded-lg shadow-xl">
            {/* Header */}
            <div className="text-center mb-6">
                <div className="text-green-400 text-sm font-mono mb-1">
                    STEP {STEP_NUMBERS[step]}
                </div>
                <h1 className="text-green-500 text-2xl font-mono font-bold">
                    {STEP_TITLES[step]}
                </h1>
            </div>

            {/* Scanning indicator */}
            {scanning && (
                <div className="text-center mb-4">
                    <div className="text-yellow-400 font-mono animate-pulse">
                        Scanning network...
                    </div>
                </div>
            )}

            {/* Options list */}
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
                        className={`w-full p-3 text-left font-mono rounded transition-colors ${
                            index === selectedIndex
                                ? 'bg-green-600 text-black'
                                : 'bg-gray-800 text-green-400 hover:bg-gray-700'
                        }`}
                    >
                        <span className="mr-2 text-gray-500">{index}.</span>
                        {option}
                    </button>
                ))}
            </div>

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

            {/* Navigation hints */}
            <div className="border-t border-gray-700 pt-4">
                <div className="text-gray-500 font-mono text-xs text-center space-y-1">
                    <div>
                        <span className="text-green-400">+</span> / <span className="text-green-400">V</span> / <span className="text-green-400">↓</span> = Next
                        {' | '}
                        <span className="text-green-400">-</span> / <span className="text-green-400">N</span> / <span className="text-green-400">↑</span> = Prev
                    </div>
                    <div>
                        <span className="text-green-400">E</span> / <span className="text-green-400">Enter</span> = Select
                        {' | '}
                        <span className="text-green-400">C</span> / <span className="text-green-400">Esc</span> = Back
                    </div>
                </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between mt-4">
                <button
                    onClick={() => onAction('back')}
                    className="px-4 py-2 bg-gray-700 text-gray-300 font-mono rounded hover:bg-gray-600 transition-colors"
                    disabled={step === 'serial'}
                >
                    ← Back
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={() => onAction('prev')}
                        className="px-4 py-2 bg-gray-700 text-green-400 font-mono rounded hover:bg-gray-600 transition-colors"
                    >
                        ↑
                    </button>
                    <button
                        onClick={() => onAction('next')}
                        className="px-4 py-2 bg-gray-700 text-green-400 font-mono rounded hover:bg-gray-600 transition-colors"
                    >
                        ↓
                    </button>
                </div>
                <button
                    onClick={() => onAction('select')}
                    className="px-4 py-2 bg-green-600 text-black font-mono rounded hover:bg-green-500 transition-colors"
                >
                    Select →
                </button>
            </div>
        </div>
    )
}
