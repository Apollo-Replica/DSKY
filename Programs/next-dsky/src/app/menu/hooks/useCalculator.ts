"use client"

import { useState, useCallback } from "react"

export interface CalculatorState {
    display: string         // Current number being entered/displayed
    expression: string      // Full expression for display (e.g. "123 + 45")
    operator: string | null // Current pending operator: +, ×, -, ÷
    operand1: number | null // First operand
    waitingForOperand2: boolean
    lastResult: number | null
    error: boolean
}

const INITIAL_STATE: CalculatorState = {
    display: '0',
    expression: '',
    operator: null,
    operand1: null,
    waitingForOperand2: false,
    lastResult: null,
    error: false,
}

function compute(a: number, op: string, b: number): number | null {
    switch (op) {
        case '+': return a + b
        case '×': return a * b
        case '-': return a - b
        case '÷': return b === 0 ? null : a / b
        default: return null
    }
}

function formatResult(n: number): string {
    if (!isFinite(n)) return 'ERR'
    if (Number.isInteger(n)) return n.toString().slice(0, 12)
    // Limit decimal places, strip trailing zeros
    const s = parseFloat(n.toPrecision(10)).toString()
    return s.length > 12 ? n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '') : s
}

export function useCalculator() {
    const [state, setState] = useState<CalculatorState>(INITIAL_STATE)

    const handleKey = useCallback((key: string) => {
        setState(prev => {
            if (prev.error) {
                // After error, any key resets except digits which start fresh
                if (/^[0-9]$/.test(key)) {
                    return { ...INITIAL_STATE, display: key, expression: '' }
                }
                return INITIAL_STATE
            }

            // Digit input
            if (/^[0-9]$/.test(key)) {
                if (prev.waitingForOperand2) {
                    return {
                        ...prev,
                        display: key,
                        waitingForOperand2: false,
                    }
                }
                const newDisplay = prev.display === '0' ? key : prev.display + key
                // Limit display length
                if (newDisplay.length > 12) return prev
                return { ...prev, display: newDisplay }
            }

            // + key: toggle + → × → +
            if (key === '+') {
                const currentValue = parseFloat(prev.display)

                if (prev.operator === '+') {
                    // Toggle to ×
                    const expr = prev.expression.slice(0, -1) + '×'
                    return { ...prev, operator: '×', expression: expr }
                }
                if (prev.operator === '×') {
                    // Toggle back to +
                    const expr = prev.expression.slice(0, -1) + '+'
                    return { ...prev, operator: '+', expression: expr }
                }

                // No operator or different operator — set + and evaluate pending
                if (prev.operator && prev.operand1 !== null && !prev.waitingForOperand2) {
                    const result = compute(prev.operand1, prev.operator, currentValue)
                    if (result === null) return { ...prev, display: 'ERR', error: true, expression: '' }
                    return {
                        ...prev,
                        display: formatResult(result),
                        expression: formatResult(result) + ' +',
                        operator: '+',
                        operand1: result,
                        waitingForOperand2: true,
                    }
                }

                return {
                    ...prev,
                    expression: prev.display + ' +',
                    operator: '+',
                    operand1: currentValue,
                    waitingForOperand2: true,
                }
            }

            // - key: toggle - → ÷ → -
            if (key === '-') {
                const currentValue = parseFloat(prev.display)

                if (prev.operator === '-') {
                    const expr = prev.expression.slice(0, -1) + '÷'
                    return { ...prev, operator: '÷', expression: expr }
                }
                if (prev.operator === '÷') {
                    const expr = prev.expression.slice(0, -1) + '-'
                    return { ...prev, operator: '-', expression: expr }
                }

                if (prev.operator && prev.operand1 !== null && !prev.waitingForOperand2) {
                    const result = compute(prev.operand1, prev.operator, currentValue)
                    if (result === null) return { ...prev, display: 'ERR', error: true, expression: '' }
                    return {
                        ...prev,
                        display: formatResult(result),
                        expression: formatResult(result) + ' -',
                        operator: '-',
                        operand1: result,
                        waitingForOperand2: true,
                    }
                }

                return {
                    ...prev,
                    expression: prev.display + ' -',
                    operator: '-',
                    operand1: currentValue,
                    waitingForOperand2: true,
                }
            }

            // ENTR (e) = equals
            if (key === 'e') {
                if (prev.operator && prev.operand1 !== null) {
                    const currentValue = parseFloat(prev.display)
                    const result = compute(prev.operand1, prev.operator, currentValue)
                    if (result === null) return { ...prev, display: 'ERR', error: true, expression: '' }
                    return {
                        ...INITIAL_STATE,
                        display: formatResult(result),
                        expression: prev.expression + ' ' + prev.display + ' =',
                        lastResult: result,
                    }
                }
                return prev
            }

            // CLR (c) = backspace (delete last digit)
            if (key === 'c') {
                if (prev.waitingForOperand2) return prev
                if (prev.display.length <= 1 || (prev.display.length === 2 && prev.display[0] === '-')) {
                    return { ...prev, display: '0' }
                }
                return { ...prev, display: prev.display.slice(0, -1) }
            }

            // RSET (r) = clear all
            if (key === 'r') {
                return INITIAL_STATE
            }

            return prev
        })
    }, [])

    return { state, handleKey }
}
