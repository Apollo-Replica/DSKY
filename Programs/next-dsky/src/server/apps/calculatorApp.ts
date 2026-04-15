/**
 * Server-side calculator app.
 * Pure state machine — receives keys, produces state updates.
 */

import type { CalculatorAppState } from '../../types/serverState'

interface CalculatorFullState {
    display: string
    expression: string
    operator: string | null
    operand1: number | null
    waitingForOperand2: boolean
    lastResult: number | null
    error: boolean
}

const INITIAL: CalculatorFullState = {
    display: '0',
    expression: '',
    operator: null,
    operand1: null,
    waitingForOperand2: false,
    lastResult: null,
    error: false,
}

let state: CalculatorFullState = { ...INITIAL }

function compute(a: number, op: string, b: number): number | null {
    switch (op) {
        case '+': return a + b
        case '\u00D7': return a * b
        case '-': return a - b
        case '\u00F7': return b === 0 ? null : a / b
        default: return null
    }
}

function formatResult(n: number): string {
    if (!isFinite(n)) return 'ERR'
    if (Number.isInteger(n)) return n.toString().slice(0, 12)
    const s = parseFloat(n.toPrecision(10)).toString()
    return s.length > 12 ? n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '') : s
}

export function initCalculator(): CalculatorAppState {
    state = { ...INITIAL }
    return getBroadcastState()
}

export function getBroadcastState(): CalculatorAppState {
    return {
        display: state.display,
        expression: state.expression,
        error: state.error,
    }
}

export function handleCalculatorKey(key: string): CalculatorAppState {
    const prev = state

    if (prev.error) {
        if (/^[0-9]$/.test(key)) {
            state = { ...INITIAL, display: key, expression: '' }
        } else {
            state = { ...INITIAL }
        }
        return getBroadcastState()
    }

    // Digit input
    if (/^[0-9]$/.test(key)) {
        if (prev.waitingForOperand2) {
            state = { ...prev, display: key, waitingForOperand2: false }
        } else {
            const newDisplay = prev.display === '0' ? key : prev.display + key
            if (newDisplay.length > 12) return getBroadcastState()
            state = { ...prev, display: newDisplay }
        }
        return getBroadcastState()
    }

    // + key: toggle + → × → +
    if (key === '+') {
        const currentValue = parseFloat(prev.display)

        if (prev.operator === '+') {
            const expr = prev.expression.slice(0, -1) + '\u00D7'
            state = { ...prev, operator: '\u00D7', expression: expr }
            return getBroadcastState()
        }
        if (prev.operator === '\u00D7') {
            const expr = prev.expression.slice(0, -1) + '+'
            state = { ...prev, operator: '+', expression: expr }
            return getBroadcastState()
        }

        if (prev.operator && prev.operand1 !== null && !prev.waitingForOperand2) {
            const result = compute(prev.operand1, prev.operator, currentValue)
            if (result === null) {
                state = { ...prev, display: 'ERR', error: true, expression: '' }
                return getBroadcastState()
            }
            state = {
                ...prev,
                display: formatResult(result),
                expression: formatResult(result) + ' +',
                operator: '+',
                operand1: result,
                waitingForOperand2: true,
            }
            return getBroadcastState()
        }

        state = {
            ...prev,
            expression: prev.display + ' +',
            operator: '+',
            operand1: currentValue,
            waitingForOperand2: true,
        }
        return getBroadcastState()
    }

    // - key: toggle - → ÷ → -
    if (key === '-') {
        const currentValue = parseFloat(prev.display)

        if (prev.operator === '-') {
            const expr = prev.expression.slice(0, -1) + '\u00F7'
            state = { ...prev, operator: '\u00F7', expression: expr }
            return getBroadcastState()
        }
        if (prev.operator === '\u00F7') {
            const expr = prev.expression.slice(0, -1) + '-'
            state = { ...prev, operator: '-', expression: expr }
            return getBroadcastState()
        }

        if (prev.operator && prev.operand1 !== null && !prev.waitingForOperand2) {
            const result = compute(prev.operand1, prev.operator, currentValue)
            if (result === null) {
                state = { ...prev, display: 'ERR', error: true, expression: '' }
                return getBroadcastState()
            }
            state = {
                ...prev,
                display: formatResult(result),
                expression: formatResult(result) + ' -',
                operator: '-',
                operand1: result,
                waitingForOperand2: true,
            }
            return getBroadcastState()
        }

        state = {
            ...prev,
            expression: prev.display + ' -',
            operator: '-',
            operand1: currentValue,
            waitingForOperand2: true,
        }
        return getBroadcastState()
    }

    // ENTR (e) = equals
    if (key === 'e') {
        if (prev.operator && prev.operand1 !== null) {
            const currentValue = parseFloat(prev.display)
            const result = compute(prev.operand1, prev.operator, currentValue)
            if (result === null) {
                state = { ...prev, display: 'ERR', error: true, expression: '' }
                return getBroadcastState()
            }
            state = {
                ...INITIAL,
                display: formatResult(result),
                expression: prev.expression + ' ' + prev.display + ' =',
                lastResult: result,
            }
        }
        return getBroadcastState()
    }

    // CLR (c) = backspace
    if (key === 'c') {
        if (prev.waitingForOperand2) return getBroadcastState()
        if (prev.display.length <= 1 || (prev.display.length === 2 && prev.display[0] === '-')) {
            state = { ...prev, display: '0' }
        } else {
            state = { ...prev, display: prev.display.slice(0, -1) }
        }
        return getBroadcastState()
    }

    // RSET (r) = clear all
    if (key === 'r') {
        state = { ...INITIAL }
        return getBroadcastState()
    }

    return getBroadcastState()
}
