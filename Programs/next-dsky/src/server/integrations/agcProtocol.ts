/**
 * AGC binary protocol encoding/decoding and DSKY state mapping.
 * Extracted from YaAGCIntegration to separate protocol concerns from process management.
 */

export const codeToString = (code: number): string => {
    if (code === 0) return ""
    if (code === 21) return "0"
    if (code === 3) return "1"
    if (code === 25) return "2"
    if (code === 27) return "3"
    if (code === 15) return "4"
    if (code === 30) return "5"
    if (code === 28) return "6"
    if (code === 19) return "7"
    if (code === 29) return "8"
    if (code === 31) return "9"
    return "?"
}

export const parseDskyKey = (ch: string): [number, number, number] => {
    let returnValue: [number, number, number] = [0o32, 0o20000, 0o20000]
    switch (ch) {
        case '0': returnValue = [0o15, 0o20, 0o37]; break
        case '1': returnValue = [0o15, 0o1, 0o37]; break
        case '2': returnValue = [0o15, 0o2, 0o37]; break
        case '3': returnValue = [0o15, 0o3, 0o37]; break
        case '4': returnValue = [0o15, 0o4, 0o37]; break
        case '5': returnValue = [0o15, 0o5, 0o37]; break
        case '6': returnValue = [0o15, 0o6, 0o37]; break
        case '7': returnValue = [0o15, 0o7, 0o37]; break
        case '8': returnValue = [0o15, 0o10, 0o37]; break
        case '9': returnValue = [0o15, 0o11, 0o37]; break
        case '+': returnValue = [0o15, 0o32, 0o37]; break
        case '-': returnValue = [0o15, 0o33, 0o37]; break
        case 'V': returnValue = [0o15, 0o21, 0o37]; break
        case 'N': returnValue = [0o15, 0o37, 0o37]; break
        case 'R': returnValue = [0o15, 0o22, 0o37]; break
        case 'C': returnValue = [0o15, 0o36, 0o37]; break
        case 'P': returnValue = [0o32, 0o0, 0o20000]; break
        case 'PR': returnValue = [0o32, 0o20000, 0o20000]; break
        case 'K': returnValue = [0o15, 0o31, 0o37]; break
        case 'E': returnValue = [0o15, 0o34, 0o37]; break
    }
    return returnValue
}

export const getYaAGCPort = (options: { yaagc?: string } = {}): number => {
    const version = options.yaagc || 'Comanche055'
    switch (version) {
        case 'Comanche055': return 19697
        case 'Luminary099': return 19797
        case 'Luminary210': return 19897
        case 'own': return 4000
        default: return 19697
    }
}

export const YAAGC_VERSIONS = [
    { name: 'Comanche055', value: 'Comanche055' },
    { name: 'Luminary099', value: 'Luminary099' },
    { name: 'Luminary210', value: 'Luminary210' },
    { name: 'Start my own YaAGC', value: 'own' },
]

/**
 * Encode a key press into a 4-byte AGC input packet and send both mask + data.
 */
export const encodeInputPacket = (tuple: [number, number, number]): [Buffer, Buffer] => {
    const [channel, value, mask] = tuple
    const maskBuf = Buffer.alloc(4)
    maskBuf[0] = 0x20 | ((channel >> 3) & 0x0F)
    maskBuf[1] = 0x40 | ((channel << 3) & 0x38) | ((mask >> 12) & 0x07)
    maskBuf[2] = 0x80 | ((mask >> 6) & 0x3F)
    maskBuf[3] = 0xC0 | (mask & 0x3F)

    const dataBuf = Buffer.alloc(4)
    dataBuf[0] = 0x00 | ((channel >> 3) & 0x0F)
    dataBuf[1] = 0x40 | ((channel << 3) & 0x38) | ((value >> 12) & 0x07)
    dataBuf[2] = 0x80 | ((value >> 6) & 0x3F)
    dataBuf[3] = 0xC0 | (value & 0x3F)

    return [maskBuf, dataBuf]
}

/**
 * Validate a 4-byte AGC output packet in the input buffer.
 * Returns [channel, value] if valid, null if the first byte should be discarded.
 */
export const decodeOutputPacket = (buffer: number[]): [number, number] | null => {
    if ((buffer[0] & 0xF0) !== 0x00) return null
    if ((buffer[1] & 0xC0) !== 0x40) return null
    if ((buffer[2] & 0xC0) !== 0x80) return null
    if ((buffer[3] & 0xC0) !== 0xC0) return null

    const channel = ((buffer[0] & 0x0F) << 3) | ((buffer[1] & 0x38) >> 3)
    const value = ((buffer[1] & 0x07) << 12) | ((buffer[2] & 0x3F) << 6) | (buffer[3] & 0x3F)
    return [channel, value]
}

export interface AGCParsingState {
    last10: number
    last11: number
    last163: number
    plusMinusState1: number
    plusMinusState2: number
    plusMinusState3: number
    vnFlashing: boolean
    vnFlashState: boolean
}

export const createParsingState = (): AGCParsingState => ({
    last10: 0,
    last11: 0,
    last163: 0,
    plusMinusState1: 0,
    plusMinusState2: 0,
    plusMinusState3: 0,
    vnFlashing: false,
    vnFlashState: false,
})

/**
 * Parse an AGC output channel/value pair and update DSKY display state.
 * Returns true if the state was updated and should be emitted.
 */
export const parseAGCOutput = (channel: number, value: number, state: any, parsing: AGCParsingState): boolean => {
    if (channel === 0o13) {
        value &= 0o3000
    }

    if ((channel === 0o10 && value === parsing.last10) ||
        (channel === 0o11 && value === parsing.last11) ||
        (channel === 0o163 && value === parsing.last163)) return false

    if (![0o163, 0o13, 0o11, 0o10].includes(channel)) return false

    switch (channel) {
        case 0o10: {
            parsing.last10 = value
            const aaaa = (value >> 11) & 0x0F
            const b = (value >> 10) & 0x01
            const ccccc = (value >> 5) & 0x1F
            const ddddd = value & 0x1F
            let plusMinus: string
            const sc = codeToString(ccccc)
            const sd = codeToString(ddddd)
            switch (aaaa) {
                case 11:
                    state.ProgramD1 = sc
                    state.ProgramD2 = sd
                    break
                case 10:
                    state.VerbD1 = sc
                    state.VerbD2 = sd
                    break
                case 9:
                    state.NounD1 = sc
                    state.NounD2 = sd
                    break
                case 8:
                    state.Register1D1 = sd
                    break
                case 7:
                    plusMinus = "  "
                    if (b !== 0) {
                        plusMinus = "1+"
                        parsing.plusMinusState1 |= 1
                    } else {
                        parsing.plusMinusState1 &= ~1
                    }
                    if (parsing.plusMinusState1 === 0 && plusMinus === "1+") state.Register1Sign = " "
                    else if (parsing.plusMinusState1 === 0 && plusMinus === "  ") state.Register1Sign = " "
                    else if (parsing.plusMinusState1 === 1 && plusMinus === "1+") state.Register1Sign = "+"
                    state.Register1D2 = sc
                    state.Register1D3 = sd
                    break
                case 6:
                    plusMinus = "  "
                    if (b !== 0) {
                        plusMinus = "1-"
                        parsing.plusMinusState1 |= 2
                    } else {
                        parsing.plusMinusState1 &= ~2
                    }
                    if (parsing.plusMinusState1 === 0 && plusMinus === "1-") state.Register1Sign = ""
                    else if (parsing.plusMinusState1 === 0 && plusMinus === "  ") state.Register1Sign = ""
                    else if (parsing.plusMinusState1 === 2 && plusMinus === "1-") state.Register1Sign = "-"
                    state.Register1D4 = sc
                    state.Register1D5 = sd
                    break
                case 5:
                    plusMinus = "  "
                    if (b !== 0) {
                        plusMinus = "2+"
                        parsing.plusMinusState2 |= 1
                    } else {
                        parsing.plusMinusState2 &= ~1
                    }
                    if (parsing.plusMinusState2 === 0 && plusMinus === "2+") state.Register2Sign = ""
                    else if (parsing.plusMinusState2 === 0 && plusMinus === "  ") state.Register2Sign = ""
                    else if (parsing.plusMinusState2 === 1 && plusMinus === "2+") state.Register2Sign = "+"
                    state.Register2D1 = sc
                    state.Register2D2 = sd
                    break
                case 4:
                    plusMinus = "  "
                    if (b !== 0) {
                        plusMinus = "2-"
                        parsing.plusMinusState2 |= 2
                    } else {
                        parsing.plusMinusState2 &= ~2
                    }
                    if (parsing.plusMinusState2 === 0 && plusMinus === "2-") state.Register2Sign = ""
                    else if (parsing.plusMinusState2 === 0 && plusMinus === " ") state.Register2Sign = ""
                    else if (parsing.plusMinusState2 === 2 && plusMinus === "2-") state.Register2Sign = "-"
                    state.Register2D3 = sc
                    state.Register2D4 = sd
                    break
                case 3:
                    state.Register2D5 = sc
                    state.Register3D1 = sd
                    break
                case 2:
                    plusMinus = "  "
                    if (b !== 0) {
                        plusMinus = "3+"
                        parsing.plusMinusState3 |= 1
                    } else {
                        parsing.plusMinusState3 &= ~1
                    }
                    if (parsing.plusMinusState3 === 0 && plusMinus === "3+") state.Register3Sign = ""
                    else if (parsing.plusMinusState3 === 0 && plusMinus === "  ") state.Register3Sign = ""
                    else if (parsing.plusMinusState3 === 1 && plusMinus === "3+") state.Register3Sign = "+"
                    state.Register3D2 = sc
                    state.Register3D3 = sd
                    break
                case 1:
                    plusMinus = "  "
                    if (b !== 0) {
                        plusMinus = "3-"
                        parsing.plusMinusState3 |= 2
                    } else {
                        parsing.plusMinusState3 &= ~2
                    }
                    if (parsing.plusMinusState3 === 0 && plusMinus === "3-") state.Register3Sign = ""
                    else if (parsing.plusMinusState3 === 0 && plusMinus === "  ") state.Register3Sign = ""
                    else if (parsing.plusMinusState3 === 2 && plusMinus === "3-") state.Register3Sign = "-"
                    state.Register3D4 = sc
                    state.Register3D5 = sd
                    break
                case 12:
                    state.IlluminatePrioDisp = (value & 0x01) !== 0 ? 1 : 0
                    state.IlluminateNoDap = (value & 0x02) !== 0 ? 1 : 0
                    state.IlluminateVel = (value & 0x04) !== 0 ? 1 : 0
                    state.IlluminateNoAtt = (value & 0x08) !== 0 ? 1 : 0
                    state.IlluminateAlt = (value & 0x10) !== 0 ? 1 : 0
                    state.IlluminateGimbalLock = (value & 0x20) !== 0 ? 1 : 0
                    state.IlluminateTracker = (value & 0x80) !== 0 ? 1 : 0
                    state.IlluminateProg = (value & 0x100) !== 0 ? 1 : 0
                    break
            }
            break
        }
        case 0o11:
            parsing.last11 = value
            state.IlluminateCompLight = (value & 0x02) !== 0
            state.IlluminateUplinkActy = (value & 0x04) !== 0 ? 1 : 0
            if ((value & 0x20) !== 0) {
                if (!parsing.vnFlashing) parsing.vnFlashing = true
            } else {
                if (parsing.vnFlashing !== false) parsing.vnFlashing = false
            }
            break
        case 0o163:
            parsing.last163 = value
            state.IlluminateTemp = (value & 0x08) !== 0 ? 1 : 0
            state.IlluminateStby = (value & 0o400) !== 0 ? 1 : 0
            state.IlluminateKeyRel = (value & 0o20) !== 0 ? 1 : 0
            state.IlluminateOprErr = (value & 0o100) !== 0 ? 1 : 0
            state.IlluminateRestart = (value & 0o200) !== 0 ? 1 : 0
            break
    }
    return true
}
