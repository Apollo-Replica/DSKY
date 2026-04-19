/**
 * Server state broadcast to all connected clients.
 * Contains current integration status, available hardware, discovery results,
 * menu navigation state, and app-specific runtime state.
 */

// --- Menu ---

export type MenuScreen =
    | 'main'
    | 'simulate'
    | 'commands'
    | 'settings'
    | 'about'
    | 'apps'
    | 'yaAgcSelect'
    | 'bridgeSelect'
    | 'bridgeManual'
    | 'serialSelect'
    | 'networkInterface'
    | 'haMenu'
    | 'haSetup'
    | 'wifi'

export interface MenuState {
    isOpen: boolean
    activeScreen: MenuScreen
    selectedIndex: number
    screenHistory: MenuScreen[]
}

// --- Discovery & Hardware ---

export interface DiscoveredAPI {
    ip: string
    port: number
    url: string
    name?: string
    version?: string
    app?: string
}

export interface DiscoveredEntity {
    entity_id: string
    friendly_name: string
    domain: string
    device_class?: string
}

export interface NetworkInterfaceOption {
    name: string
    ip: string
}

// --- App State ---

export interface AppState {
    id: string | null
    yaagcVersion?: string
    bridgeUrl?: string
    haUrl?: string
    calculator?: CalculatorAppState
    clock?: ClockAppState
    games?: GamesAppState
}

export interface CalculatorAppState {
    display: string
    expression: string
    error: boolean
}

export interface StopwatchAppState {
    running: boolean
    startedAt: number       // Date.now() when started (0 if not running)
    accumulated: number     // ms accumulated before current run
    laps: number[]          // lap times in ms
}

export interface CountdownAppState {
    phase: 'setup' | 'running' | 'paused' | 'done'
    inputDigits: string     // digits entered during setup (HHMMSS)
    endAt: number           // Date.now() when countdown ends (when running)
    totalMs: number         // total countdown time in ms
    remaining: number       // ms remaining (snapshot when paused/done)
}

export interface AlarmAppState {
    armed: boolean
    triggered: boolean
    alarmTime: string | null    // "HH:MM" when set
    inputDigits: string         // HHMM being entered
}

export interface PomodoroAppState {
    phase: 'idle' | 'work' | 'break' | 'done'
    paused: boolean
    endAt: number               // Date.now() when current phase ends
    remaining: number           // ms remaining (snapshot when paused)
    workDuration: number        // ms (default 25 min)
    breakDuration: number       // ms (default 5 min)
    totalSessions: number
    completedSessions: number
    setupField: 'work' | 'break' | 'sessions' | null
    setupDigits: string
}

export interface ClockAppState {
    activeTab: number           // 0=STOP, 1=COUNT, 2=ALARM, 3=POMO
    stopwatch: StopwatchAppState
    countdown: CountdownAppState
    alarm: AlarmAppState
    pomodoro: PomodoroAppState
}

// --- Games ---

export type GameId = 'flappy' | 'tetris'

export interface FlappyObstacle {
    x: number       // 0..1 normalized
    gapY: number    // 0..1 top of gap
    gapSize: number // 0..1
    passed: boolean
}

export interface FlappyState {
    phase: 'ready' | 'playing' | 'gameover'
    shipY: number           // 0..1 vertical position
    shipVy: number          // world units / sec
    boosting: boolean       // PRO held
    obstacles: FlappyObstacle[]
    spawnTimer: number      // seconds since last spawn
    score: number
    best: number
    tickMs: number          // server timestamp of last tick (for client interpolation)
}

export type TetrisPieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
export type TetrisCell = 0 | TetrisPieceType

export interface TetrisPiece {
    type: TetrisPieceType
    rotation: 0 | 1 | 2 | 3
    x: number   // column of top-left of shape bounding box
    y: number   // row (0 = top)
}

export interface TetrisState {
    phase: 'ready' | 'playing' | 'paused' | 'clearing' | 'gameover'
    board: TetrisCell[][]           // 20 rows × 10 cols (row 0 = top)
    piece: TetrisPiece | null
    nextType: TetrisPieceType
    dropTimer: number               // seconds accumulated toward next gravity step
    dropInterval: number            // seconds per gravity step (decreases with level)
    clearingRows: number[]          // row indices currently blinking before removal
    clearTimer: number              // seconds remaining of the clearing blink
    score: number
    lines: number
    level: number
    best: number
    tickMs: number
}

export interface GamesAppState {
    activeGame: GameId | null
    selectorIndex: number
    flappy: FlappyState
    tetris: TetrisState
}

// --- Server State ---

export interface ServerState {
    menu: MenuState

    app: AppState

    serial: {
        port: string | null
        available: Array<{ path: string; name: string }>
    }

    network: {
        interface: string | null
        available: NetworkInterfaceOption[]
        locked: boolean
    }

    bridge: {
        discovered: DiscoveredAPI[]
        scanning: boolean
    }

    ha: {
        enabled: boolean
        configured: boolean
        url?: string
        token?: string
        entities?: DiscoveredEntity[]
        selectedIds?: string[]
        error?: string
    }

    wifi: {
        available: boolean
        running: boolean
    }

    shutdown: boolean
    reboot: boolean

    /** Base URL for this server (e.g., http://192.168.1.50:3000) */
    baseUrl: string | null
}
