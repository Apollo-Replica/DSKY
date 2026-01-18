import * as net from 'net'
import { OFF_TEST } from '../../utils/dskyStates';
import { YAAGC_VERSIONS } from '../configState';

let last10: number, last11: number, last163: number;
let plusMinusState1: number = 0, plusMinusState2: number = 0, plusMinusState3: number = 0;
let vnFlashing: boolean = false;
let state: any = { ...OFF_TEST }
let handleAGCUpdate = (_state: any) => {}
let yaAGCClient: net.Socket | null = null

const parseAGCOutput = (channel: number, value: number): boolean => {
    if (channel === 0o13) {
        value &= 0o3000;
    }

    if ((channel === 0o10 && value === last10) ||
        (channel === 0o11 && value === last11) ||
        (channel === 0o163 && value === last163)) return false // Data is irrelevant

    if (![0o163, 0o13, 0o11, 0o10].includes(channel)) return false // Data is irrelevant

    state = { ...state } // Create new state to avoid modifying the propagated state.
    switch (channel) {
        case 0o10:
            last10 = value;
            const aaaa = (value >> 11) & 0x0F;
            const b = (value >> 10) & 0x01;
            const ccccc = (value >> 5) & 0x1F;
            const ddddd = value & 0x1F;
            let plusMinus: string;
            const sc = codeToString(ccccc);
            const sd = codeToString(ddddd);
            switch (aaaa) {
                case 11:
                    state.ProgramD1 = sc
                    state.ProgramD2 = sd
                    break;
                case 10:
                    state.VerbD1 = sc
                    state.VerbD2 = sd
                    break;
                case 9:
                    state.NounD1 = sc
                    state.NounD2 = sd
                    break;
                case 8:
                    state.Register1D1 = sd
                    break;
                case 7:
                    plusMinus = "  ";
                    if (b !== 0) {
                        plusMinus = "1+";
                        plusMinusState1 |= 1;
                    } else {
                        plusMinusState1 &= ~1;
                    }

                    if (plusMinusState1 === 0 && plusMinus === "1+") {
                        state.Register1Sign = " "
                    } else if (plusMinusState1 === 0 && plusMinus === "  ") {
                        state.Register1Sign = " "
                    } else if (plusMinusState1 === 1 && plusMinus === "1+") {
                        state.Register1Sign = "+"
                    }
                    state.Register1D2 = sc
                    state.Register1D3 = sd
                    break;
                case 6:
                    plusMinus = "  ";
                    if (b !== 0) {
                        plusMinus = "1-";
                        plusMinusState1 |= 2;
                    } else {
                        plusMinusState1 &= ~2;
                    }

                    if (plusMinusState1 === 0 && plusMinus === "1-") {
                        state.Register1Sign = ""
                    } else if (plusMinusState1 === 0 && plusMinus === "  ") {
                        state.Register1Sign = ""
                    } else if (plusMinusState1 === 2 && plusMinus === "1-") {
                        state.Register1Sign = "-"
                    }
                    state.Register1D4 = sc
                    state.Register1D5 = sd
                    break;
                case 5:
                    plusMinus = "  ";
                    if (b !== 0) {
                        plusMinus = "2+";
                        plusMinusState2 |= 1;
                    } else {
                        plusMinusState2 &= ~1;
                    }

                    if (plusMinusState2 === 0 && plusMinus === "2+") {
                        state.Register2Sign = ""
                    } else if (plusMinusState2 === 0 && plusMinus === "  ") {
                        state.Register2Sign = ""
                    } else if (plusMinusState2 === 1 && plusMinus === "2+") {
                        state.Register2Sign = "+"
                    }
                    state.Register2D1 = sc
                    state.Register2D2 = sd
                    break;
                case 4:
                    plusMinus = "  ";
                    if (b !== 0) {
                        plusMinus = "2-";
                        plusMinusState2 |= 2;
                    } else {
                        plusMinusState2 &= ~2;
                    }

                    if (plusMinusState2 === 0 && plusMinus === "2-") {
                        state.Register2Sign = ""
                    } else if (plusMinusState2 === 0 && plusMinus === " ") {
                        state.Register2Sign = ""
                    } else if (plusMinusState2 === 2 && plusMinus === "2-") {
                        state.Register2Sign = "-"
                    }
                    state.Register2D3 = sc
                    state.Register2D4 = sd
                    break;
                case 3:
                    state.Register2D5 = sc
                    state.Register3D1 = sd
                    break;
                case 2:
                    plusMinus = "  ";
                    if (b !== 0) {
                        plusMinus = "3+";
                        plusMinusState3 |= 1;
                    } else {
                        plusMinusState3 &= ~1;
                    }

                    if (plusMinusState3 === 0 && plusMinus === "3+") {
                        state.Register3Sign = ""
                    } else if (plusMinusState3 === 0 && plusMinus === "  ") {
                        state.Register3Sign = ""
                    } else if (plusMinusState3 === 1 && plusMinus === "3+") {
                        state.Register3Sign = "+"
                    }
                    state.Register3D2 = sc
                    state.Register3D3 = sd
                    break;
                case 1:
                    plusMinus = "  ";
                    if (b !== 0) {
                        plusMinus = "3-";
                        plusMinusState3 |= 2;
                    } else {
                        plusMinusState3 &= ~2;
                    }

                    if (plusMinusState3 === 0 && plusMinus === "3-") {
                        state.Register3Sign = ""
                    } else if (plusMinusState3 === 0 && plusMinus === "  ") {
                        state.Register3Sign = ""
                    } else if (plusMinusState3 === 2 && plusMinus === "3-") {
                        state.Register3Sign = "-"
                    }
                    state.Register3D4 = sc
                    state.Register3D5 = sd
                    break;
                case 12:
                    if ((value & 0x01) !== 0) {
                        state.IlluminatePrioDisp = 1
                    } else {
                        state.IlluminatePrioDisp = 0
                    }
                    if ((value & 0x02) !== 0) {
                        state.IlluminateNoDap = 1
                    } else {
                        state.IlluminateNoDap = 0
                    }
                    if ((value & 0x04) !== 0) {
                        state.IlluminateVel = 1
                    } else {
                        state.IlluminateVel = 0
                    }
                    if ((value & 0x08) !== 0) {
                        state.IlluminateNoAtt = 1
                    } else {
                        state.IlluminateNoAtt = 0
                    }
                    if ((value & 0x10) !== 0) {
                        state.IlluminateAlt = 1
                    } else {
                        state.IlluminateAlt = 0
                    }
                    if ((value & 0x20) !== 0) {
                        state.IlluminateGimbalLock = 1
                    } else {
                        state.IlluminateGimbalLock = 0
                    }
                    if ((value & 0x80) !== 0) {
                        state.IlluminateTracker = 1
                    } else {
                        state.IlluminateTracker = 0
                    }
                    if ((value & 0x100) !== 0) {
                        state.IlluminateProg = 1
                    } else {
                        state.IlluminateProg = 0
                    }
                    break;
                default:
                    break;
            }
            break;
        case 0o11:
            last11 = value;
            state.IlluminateCompLight = false
            if ((value & 0x02) !== 0) {
                state.IlluminateCompLight = true
            }
            if ((value & 0x04) !== 0) {
                state.IlluminateUplinkActy = 1
            } else {
                state.IlluminateUplinkActy = 0
            }
            if ((value & 0x20) !== 0) {
                if (!vnFlashing) {
                    vnFlashing = true;
                }
            } else {
                if (vnFlashing !== false) {
                    vnFlashing = false;
                }
            }
            break;
        case 0o163:
            last163 = value;
            if ((value & 0x08) !== 0) {
                state.IlluminateTemp = 1
            } else {
                state.IlluminateTemp = 0
            }
            if ((value & 0o400) !== 0) {
                state.IlluminateStby = 1
            } else {
                state.IlluminateStby = 0
            }
            if ((value & 0o20) !== 0) {
                state.IlluminateKeyRel = 1
            } else {
                state.IlluminateKeyRel = 0
            }
            if ((value & 0o100) !== 0) {
                state.IlluminateOprErr = 1
            } else {
                state.IlluminateOprErr = 0
            }
            if ((value & 0o200) !== 0) {
                state.IlluminateRestart = 1
            } else {
                state.IlluminateRestart = 0
            }
            break;
    }
    return true // Data was relevant
}

const outputFromAGC = (inputBuffer: number[]): boolean => {
    let ok: number = 1;

    if ((inputBuffer[0] & 0xF0) !== 0x00) {
        ok = 0;
    } else if ((inputBuffer[1] & 0xC0) !== 0x40) {
        ok = 0;
    } else if ((inputBuffer[2] & 0xC0) !== 0x80) {
        ok = 0;
    } else if ((inputBuffer[3] & 0xC0) !== 0xC0) {
        ok = 0;
    }

    if (ok === 0 && inputBuffer.length > 0) {
        inputBuffer.shift(); // Remove the first number of the array
        return false
    } else if (ok === 1 && inputBuffer.length >= 4) {
        const channel: number = ((inputBuffer[0] & 0x0F) << 3) | ((inputBuffer[1] & 0x38) >> 3);
        const value: number = ((inputBuffer[1] & 0x07) << 12) | ((inputBuffer[2] & 0x3F) << 6) | (inputBuffer[3] & 0x3F);
        const relevantData = parseAGCOutput(channel, value);
        inputBuffer.splice(0, 4); // Remove the first 4 elements from the array
        return relevantData
    }
    return false
};

// Flashing of Verb/Noun
let vnFlashState = false
setInterval(() => {
    vnFlashState = !vnFlashState
    if (vnFlashing) {
        handleAGCUpdate(vnFlashState ?
            { ...state, VerbD1: '', VerbD2: '', NounD1: '', NounD2: '' } :
            state
        )
    }
}, 600)

// Get yaAGC port from version
const getYaAGCPort = (options: { yaagc?: string } = {}): number => {
    const version = options.yaagc || 'Comanche055'
    const versionInfo = YAAGC_VERSIONS.find(v => v.value === version)

    // Default ports based on version
    switch (version) {
        case 'Comanche055':
            return 19697
        case 'Luminary099':
            return 19797
        case 'Luminary210':
            return 19897
        default:
            return 19697
    }
}

export const watchStateYaAGC = async (callback: (state: any) => void, options: { yaagc?: string } = {}) => {
    const port = getYaAGCPort(options)
    let stopped = false
    let reconnectTimeout: NodeJS.Timeout | null = null
    
    yaAGCClient = new net.Socket();
    yaAGCClient.connect({ port, host: '127.0.0.1', keepAlive: true }, () => {
        console.log('[yaAGC] Socket connected!');
        state = OFF_TEST
    });

    let inputBuffer: number[] = []
    yaAGCClient.on('data', function(data) {
        if (stopped) return
        const newbytes = data.toJSON().data
        if (newbytes.every((byte: number) => byte == 255)) return // This was a pinging packet. ignore.
        inputBuffer = [...inputBuffer, ...newbytes]
        while (inputBuffer.length >= 4) {
            let relevantData = outputFromAGC(inputBuffer)
            if (!relevantData) continue
            handleAGCUpdate(vnFlashing && vnFlashState ?
                { ...state, VerbD1: '', VerbD2: '', NounD1: '', NounD2: '' } :
                state
            )
        }
    });

    const handleSocketError = async (error: string) => {
        if (stopped) return
        console.log(`[yaAGC] Socket ${error}! Reconnecting...`)
        yaAGCClient?.destroy()
        reconnectTimeout = setTimeout(() => {
            if (!stopped) watchStateYaAGC(callback, options)
        }, 2000)
    }

    yaAGCClient.on('close', async (hadError: boolean) => {
        if (!hadError && !stopped) await handleSocketError('closed')
    })

    yaAGCClient.on('error', async () => {
        if (!stopped) await handleSocketError('connection failed')
    })

    handleAGCUpdate = callback
    
    // Return cleanup function
    return () => {
        console.log('[yaAGC] Closing socket')
        stopped = true
        if (reconnectTimeout) clearTimeout(reconnectTimeout)
        if (yaAGCClient) {
            yaAGCClient.destroy()
            yaAGCClient = null
        }
    }
}

const codeToString = (code: number): string => {
    if (code === 0) {
        return "";
    } else if (code === 21) {
        return "0";
    } else if (code === 3) {
        return "1";
    } else if (code === 25) {
        return "2";
    } else if (code === 27) {
        return "3";
    } else if (code === 15) {
        return "4";
    } else if (code === 30) {
        return "5";
    } else if (code === 28) {
        return "6";
    } else if (code === 19) {
        return "7";
    } else if (code === 29) {
        return "8";
    } else if (code === 31) {
        return "9";
    }
    return "?";
}

const parseDskyKey = (ch: string): [number, number, number] => {
    let returnValue: [number, number, number] = [0o32, 0o20000, 0o20000];
    // channel, value, mask
    switch (ch) {
        case '0':
            returnValue = [0o15, 0o20, 0o37]
            break;
        case '1':
            returnValue = [0o15, 0o1, 0o37]
            break;
        case '2':
            returnValue = [0o15, 0o2, 0o37]
            break;
        case '3':
            returnValue = [0o15, 0o3, 0o37]
            break;
        case '4':
            returnValue = [0o15, 0o4, 0o37]
            break;
        case '5':
            returnValue = [0o15, 0o5, 0o37]
            break;
        case '6':
            returnValue = [0o15, 0o6, 0o37]
            break;
        case '7':
            returnValue = [0o15, 0o7, 0o37]
            break;
        case '8':
            returnValue = [0o15, 0o10, 0o37]
            break;
        case '9':
            returnValue = [0o15, 0o11, 0o37]
            break;
        case '+':
            returnValue = [0o15, 0o32, 0o37]
            break;
        case '-':
            returnValue = [0o15, 0o33, 0o37]
            break;
        case 'V':
            returnValue = [0o15, 0o21, 0o37]
            break;
        case 'N':
            returnValue = [0o15, 0o37, 0o37]
            break;
        case 'R':
            returnValue = [0o15, 0o22, 0o37]
            break;
        case 'C':
            returnValue = [0o15, 0o36, 0o37]
            break;
        case 'P':
            returnValue = [0o32, 0o0, 0o20000]
            break;
        case 'PR':
            returnValue = [0o32, 0o20000, 0o20000]
            break;
        case 'K':
            returnValue = [0o15, 0o31, 0o37]
            break;
        case 'E':
            returnValue = [0o15, 0o34, 0o37]
            break;
    }
    return returnValue
}

const sendInputPacketToAGC = (tuple: [number, number, number]) => {
    if (!yaAGCClient) return
    const [channel, value, mask] = tuple
    const outputBuffer = Buffer.alloc(4);
    // First, create and output the mask command.
    outputBuffer[0] = 0x20 | ((channel >> 3) & 0x0F);
    outputBuffer[1] = 0x40 | ((channel << 3) & 0x38) | ((mask >> 12) & 0x07);
    outputBuffer[2] = 0x80 | ((mask >> 6) & 0x3F);
    outputBuffer[3] = 0xC0 | (mask & 0x3F);
    yaAGCClient.write(outputBuffer);
    // Now, the actual data for the channel.
    outputBuffer[0] = 0x00 | ((channel >> 3) & 0x0F);
    outputBuffer[1] = 0x40 | ((channel << 3) & 0x38) | ((value >> 12) & 0x07);
    outputBuffer[2] = 0x80 | ((value >> 6) & 0x3F);
    outputBuffer[3] = 0xC0 | (value & 0x3F);
    yaAGCClient.write(outputBuffer);
}

let keyboardHandler = (_data: string) => {}
export const getYaAGCKeyboardHandler = async () => {
    keyboardHandler = (data: string) => {
        const key = data?.toUpperCase()

        if (!yaAGCClient) return

        const pressKey = parseDskyKey(key)
        sendInputPacketToAGC(pressKey)
        if (key == "P") {
            const releaseProKey = parseDskyKey("PR")
            setTimeout(() => sendInputPacketToAGC(releaseProKey), 750)
        }
    }

    return (data: string) => keyboardHandler(data)
}
