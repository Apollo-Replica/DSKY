"use client"

import type { ServerState } from "../types/serverState"
import CalculatorApp from "./apps/calculatorApp"
import ClockApp from "./apps/clockApp"
import GamesApp from "./apps/gamesApp"

export interface AppComponentProps {
    serverState: ServerState
}

/**
 * Apps not in this map render with the default ELDisplay (DskyDisplayWrapper).
 * Custom apps get their own full-screen component in the display area.
 */
export const CUSTOM_APP_RENDERERS: Record<string, React.ComponentType<AppComponentProps>> = {
    calculator: CalculatorApp,
    clock: ClockApp,
    games: GamesApp,
}
