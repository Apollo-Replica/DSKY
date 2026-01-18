const getRandomCharFromArray = <T>(array: T[]): T => {
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
}

const getRandomState = () => {
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const signs = ['', '+', '-']
    return {
        IlluminateCompLight: getRandomCharFromArray([true, false]),
        ProgramD1: getRandomCharFromArray(digits),
        ProgramD2: getRandomCharFromArray(digits),
        VerbD1: getRandomCharFromArray(digits),
        VerbD2: getRandomCharFromArray(digits),
        NounD1: getRandomCharFromArray(digits),
        NounD2: getRandomCharFromArray(digits),
        Register1Sign: getRandomCharFromArray(signs),
        Register1D1: getRandomCharFromArray(digits),
        Register1D2: getRandomCharFromArray(digits),
        Register1D3: getRandomCharFromArray(digits),
        Register1D4: getRandomCharFromArray(digits),
        Register1D5: getRandomCharFromArray(digits),
        Register2Sign: getRandomCharFromArray(signs),
        Register2D1: getRandomCharFromArray(digits),
        Register2D2: getRandomCharFromArray(digits),
        Register2D3: getRandomCharFromArray(digits),
        Register2D4: getRandomCharFromArray(digits),
        Register2D5: getRandomCharFromArray(digits),
        Register3Sign: getRandomCharFromArray(signs),
        Register3D1: getRandomCharFromArray(digits),
        Register3D2: getRandomCharFromArray(digits),
        Register3D3: getRandomCharFromArray(digits),
        Register3D4: getRandomCharFromArray(digits),
        Register3D5: getRandomCharFromArray(digits),
        IlluminateUplinkActy: Math.random() < 0.5,
        IlluminateNoAtt: Math.random() < 0.5,
        IlluminateStby: Math.random() < 0.5,
        IlluminateKeyRel: Math.random() < 0.5,
        IlluminateOprErr: Math.random() < 0.5,
        IlluminateNoDap: Math.random() < 0.5,
        IlluminatePrioDisp: Math.random() < 0.5,
        IlluminateTemp: Math.random() < 0.5,
        IlluminateGimbalLock: Math.random() < 0.5,
        IlluminateProg: Math.random() < 0.5,
        IlluminateRestart: Math.random() < 0.5,
        IlluminateTracker: Math.random() < 0.5,
        IlluminateAlt: Math.random() < 0.5,
        IlluminateVel: Math.random() < 0.5,
        StatusBrightness: 127,
        DisplayBrightness: 127,
        KeyboardBrightness: 127
    }
}

export const watchStateRandom = (callback: (state: any) => void) => {
    const intervalId = setInterval(() => {
        callback(getRandomState())
    }, 1000)
    
    // Return a stop function
    return () => {
        clearInterval(intervalId)
    }
}
