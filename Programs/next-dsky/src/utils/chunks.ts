export const getChangedChunks = (oldState:any, newState:any) => {
    let changedChunks = []
    const start = Math.floor(Math.random() * 11) + 1; // Random starting point in the update-loop

    for (let i = 1; i <= 11; i++) {
        const current = (start + i - 1) % 11 + 1;
        const updatedState = updateChunk(oldState, newState,current)
        if(hasChanged(oldState, updatedState)){
            changedChunks.push(current)
        }
    }
    return changedChunks
}

const hasChanged = (stateOld:any, stateNew:any) =>{
    return(JSON.stringify(stateOld) != JSON.stringify(stateNew))
}

const getChunk1 = (state: any) =>{
    const { IlluminateCompLight, ProgramD1, ProgramD2 } = state
    return { IlluminateCompLight, ProgramD1, ProgramD2 }
}

const getChunk2 = (state: any) =>{
    const { VerbD1, VerbD2 } = state
    return { VerbD1, VerbD2 }
}

const getChunk3 = (state: any) =>{
    const { NounD1, NounD2 } = state
    return { NounD1, NounD2 }
}

const getChunk4 = (state: any) =>{
    const { Register1D1 } = state
    return { Register1D1 }
}

const getChunk5 = (state: any) =>{
    const { Register1Sign, Register1D2, Register1D3 } = state
    return { Register1Sign, Register1D2, Register1D3 }
}

const getChunk6 = (state: any) =>{
    const { Register1D4, Register1D5 } = state
    return { Register1D4, Register1D5 }
}

const getChunk7 = (state: any) =>{
    const { Register2Sign, Register2D1, Register2D2 } = state
    return { Register2Sign, Register2D1, Register2D2 }
}

const getChunk8 = (state: any) =>{
    const { Register2D3, Register2D4 } = state
    return { Register2D3, Register2D4 }
}

const getChunk9 = (state: any) =>{
    const { Register2D5, Register3D1 } = state
    return { Register2D5, Register3D1 }
}

const getChunk10 = (state: any) =>{
    const { Register3Sign, Register3D2, Register3D3 } = state
    return { Register3Sign, Register3D2, Register3D3 }
}

const getChunk11 = (state: any) =>{
    const { Register3D4, Register3D5 } = state
    return { Register3D4, Register3D5 }
}

const updateChunk = (oldState: any, newState: any, chunkToUpdate: Number) => {

    let newChunk
    switch(chunkToUpdate){
        case 1:
            newChunk = getChunk1(newState)
            break;
        case 2:
            newChunk = getChunk2(newState)
            break;
        case 3:
            newChunk = getChunk3(newState)
            break;
        case 4:
            newChunk = getChunk4(newState)
            break;
        case 5:
            newChunk = getChunk5(newState)
            break;
        case 6:
            newChunk = getChunk6(newState)
            break;
        case 7:
            newChunk = getChunk7(newState)
            break;
        case 8:
            newChunk = getChunk8(newState)
            break;
        case 9:
            newChunk = getChunk9(newState)
            break;
        case 10:
            newChunk = getChunk10(newState)
            break;
        case 11:
            newChunk = getChunk11(newState)
            break;
    }

    return {
        ...oldState,
        ...newChunk
    }
}

export const chunkedUpdate = async (newState:any,hookData:any) => {
    // Determine amount of changed chunks
    const changedChunks: Number[] = getChangedChunks(hookData.lastState,newState)

    // Play clicking sound depending on amount of changed chunks
    if(changedChunks.length && !hookData.muted?.current){
      const audioBuffer = hookData.audioFiles[`${changedChunks.length}-${Math.floor(Math.random() * 5)}`]
      if(audioBuffer) {
        const source = hookData.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(hookData.audioContext.destination);
        source.start();
      }
    }

    // Update dsky's chunks
    let partialState = hookData.lastState
    for(const chunk of changedChunks){
      partialState = updateChunk(partialState,newState,chunk)
      hookData.setDskyState(partialState)
      await new Promise(r => setTimeout(r, 30))
    }
    hookData.setDskyState(newState);
    hookData.lastState = newState
  }
