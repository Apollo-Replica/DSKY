// HomeAssistant integration placeholder
// This is a simplified version - copy the full implementation from api-dsky/src/homeassistant if needed

import { OFF_TEST } from '../../utils/dskyStates';

let state: any = { ...OFF_TEST }
let setState = (_state: any) => {}

export const watchStateHA = async (callback: (state: any) => void) => {
    setState = callback
    console.log('[HomeAssistant] Integration not fully implemented yet')
    // Just send initial state
    setState(state)
    
    // Return cleanup function
    return () => {
        console.log('[HomeAssistant] Cleanup')
        setState = (_state: any) => {}
    }
}

export const getHAKeyboardHandler = async () => {
    return async (_data: string) => {
        console.log('[HomeAssistant] Keyboard input not implemented')
    }
}
