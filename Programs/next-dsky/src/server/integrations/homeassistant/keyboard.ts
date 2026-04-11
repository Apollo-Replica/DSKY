import { AgcInternalState, VerbHandler } from './types'

export const handleKeyPress = (
    input: string,
    state: AgcInternalState,
    verbs: Record<string, VerbHandler>
): void => {
    if (input === 'o') return // PRO release, ignore

    const { inputMode, verb, noun } = state
    state.keyRelMode = false

    if (input === 'r') {
        // RSET — clear operator error and flashing
        state.operatorErrorActive = false
        state.verbNounFlashing = false
    } else if (input === 'c') {
        // CLR — clear current input field
        if (inputMode) {
            state[inputMode] = ''
        }
    } else if (input === 'v') {
        // VERB — enter verb input mode
        state.inputMode = 'verb'
        state.verb = ''
        state.verbNounFlashing = false
    } else if (input === 'n') {
        // NOUN — enter noun input mode
        state.inputMode = 'noun'
        state.noun = ''
        state.verbNounFlashing = false
    } else if (inputMode === 'verb' && /^[0-9]$/.test(input)) {
        // Digit in verb mode
        if (verb.length < 2) state.verb += input
    } else if (inputMode === 'noun' && /^[0-9]$/.test(input)) {
        // Digit in noun mode
        if (noun.length < 2) state.noun += input
    } else if (input === 'e' || input === 'p') {
        // ENTR or PRO — execute verb
        if (verbs[verb]) {
            verbs[verb](input === 'e', input === 'p')
        } else {
            state.operatorErrorActive = true
        }
    } else if (input === 'k') {
        // KEY REL — restore saved verb/noun
        state.inputMode = ''
        state.keyRelMode = true
        if (state.keyRel) {
            state.verb = state.keyRel[0]
            state.noun = state.keyRel[1]
        }
    } else if (['register1', 'register2', 'register3'].includes(inputMode)) {
        // Register input mode
        const reg = state[inputMode as 'register1' | 'register2' | 'register3']
        if (reg === '' && /^[+-]$/.test(input)) {
            state[inputMode as 'register1' | 'register2' | 'register3'] = input
        } else if (reg.length > 0 && reg.length < 6 && /^[0-9]$/.test(input)) {
            state[inputMode as 'register1' | 'register2' | 'register3'] += input
        }
    }
}
