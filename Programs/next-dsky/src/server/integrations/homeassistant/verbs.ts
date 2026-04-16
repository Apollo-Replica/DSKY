import { AgcContext, VerbHandler } from './types'

export const numberToString = (num: number): string => {
    const sign = num >= 0 ? '+' : '-'
    return `${sign}${Math.abs(Math.round(num)).toString().padStart(5, '0')}`
}

const displayNoun = (ctx: AgcContext): void => {
    const noun = ctx.getNounValues(ctx.state.noun)
    ctx.state.register1 = numberToString(noun[0])
    ctx.state.register2 = numberToString(noun[1])
    ctx.state.register3 = numberToString(noun[2])
}

// V06 — Display noun values (one-shot)
const createV06 = (ctx: AgcContext, verbs: Record<string, VerbHandler>): VerbHandler => {
    return async (enter = false, pro = false) => {
        try {
            if (enter || pro) {
                const previousVerb = ctx.state.verbStack[ctx.state.verbStack.length - 1]
                if (previousVerb) {
                    return verbs[previousVerb](enter, pro)
                }
            }
            if (pro) return
            if (enter) {
                ctx.state.inputMode = ''
                ctx.state.verb = '06'
                verbs['06'](false, false)
            } else {
                ctx.state.compActy = true
                await new Promise(r => setTimeout(r, 100))
                ctx.state.compActy = false
                displayNoun(ctx)
            }
        } catch {
            console.log('[HA] V06 fail')
        }
    }
}

// V16 — Monitor noun values (auto-refresh)
const createV16 = (ctx: AgcContext, verbs: Record<string, VerbHandler>): VerbHandler => {
    return async (enter = false, pro = false) => {
        try {
            if ((enter || pro) && ctx.state.verb === '16') {
                const previousVerb = ctx.state.verbStack[ctx.state.verbStack.length - 1]
                if (previousVerb) {
                    return verbs[previousVerb](enter, pro)
                }
            }
            if (pro) return
            if (enter) {
                ctx.state.inputMode = ''
                ctx.state.verb = '16'
                ctx.state.verbNounFlashing = false
                ctx.state.keyRel = ['16', ctx.state.noun]
                ctx.state.keyRelMode = true
                verbs['16'](false, false)
            } else {
                ctx.state.compActy = true
                await new Promise(r => setTimeout(r, 100))
                ctx.state.compActy = false
                displayNoun(ctx)
            }
        } catch {
            console.log('[HA] V16 fail')
        }
    }
}

// V21/V22/V23 — Load Register 1/2/3
const createLoadRegisterVerb = (ctx: AgcContext, verbs: Record<string, VerbHandler>, registerIndex: 0 | 1 | 2): VerbHandler => {
    const registerKey = `register${registerIndex + 1}` as 'register1' | 'register2' | 'register3'
    return (enter = false, pro = false) => {
        if (pro) return
        try {
            if (!ctx.state.verbNounFlashing) {
                ctx.state.inputMode = registerKey
                ctx.state.verbNounFlashing = true
                const noun = ctx.getNounValues(ctx.state.noun)
                ctx.state.register1 = registerIndex === 0 ? '' : numberToString(noun[0])
                ctx.state.register2 = registerIndex === 1 ? '' : numberToString(noun[1])
                ctx.state.register3 = registerIndex === 2 ? '' : numberToString(noun[2])
            } else {
                ctx.state.inputMode = ''
                ctx.setNounValue(ctx.state.noun, registerIndex, Number(ctx.state[registerKey]) || 0)
                ctx.state.verbNounFlashing = false
                const previousVerb = ctx.state.verbStack[ctx.state.verbStack.length - 1]
                if (previousVerb) {
                    verbs[previousVerb](enter, pro)
                } else {
                    verbs['06'](true, false)
                }
            }
        } catch (e) {
            console.log(`[HA] V2${registerIndex + 1} fail`, e)
        }
    }
}

// V24 — Load Register 1 + 2 (chains V21 -> V22)
const createV24 = (ctx: AgcContext, verbs: Record<string, VerbHandler>): VerbHandler => {
    return (enter = false, pro = false) => {
        if (pro) return
        try {
            if (ctx.state.verb === '21') {
                ctx.state.verb = '22'
                verbs['22'](false, false)
            } else if (ctx.state.verb === '24') {
                ctx.state.verbStack.push('24')
                ctx.state.verb = '21'
                verbs['21'](false, false)
            } else {
                ctx.state.verbStack = ctx.state.verbStack.filter(v => v !== '24')
                const previousVerb = ctx.state.verbStack[ctx.state.verbStack.length - 1]
                if (previousVerb) {
                    verbs[previousVerb](false, false)
                } else {
                    ctx.state.verb = '16'
                    verbs['16'](false, false)
                }
            }
        } catch (e) {
            console.log('[HA] V24 fail', e)
        }
    }
}

// V25 — Load Register 1 + 2 + 3 (chains V21 -> V22 -> V23)
const createV25 = (ctx: AgcContext, verbs: Record<string, VerbHandler>): VerbHandler => {
    return (enter = false, pro = false) => {
        if (pro) return
        try {
            if (ctx.state.verb === '21') {
                ctx.state.verb = '22'
                verbs['22'](false, false)
            } else if (ctx.state.verb === '22') {
                ctx.state.verb = '23'
                verbs['23'](false, false)
            } else if (ctx.state.verb === '25') {
                ctx.state.verbStack.push('25')
                ctx.state.verb = '21'
                verbs['21'](false, false)
            } else {
                ctx.state.verbStack = ctx.state.verbStack.filter(v => v !== '25')
                const previousVerb = ctx.state.verbStack[ctx.state.verbStack.length - 1]
                if (previousVerb) {
                    verbs[previousVerb](false, false)
                } else {
                    ctx.state.verb = '16'
                    verbs['16'](false, false)
                }
            }
        } catch (e) {
            console.log('[HA] V25 fail', e)
        }
    }
}

// V35 — Lamp Test (5 seconds)
const createV35 = (ctx: AgcContext): VerbHandler => {
    return (enter = false, pro = false) => {
        if (pro) return
        ctx.state.lightTest = 1
        ctx.state.program = '88'
        ctx.state.verb = '88'
        ctx.state.noun = '88'
        ctx.state.verbNounFlashing = true
        ctx.state.register1 = '+88888'
        ctx.state.register2 = '+88888'
        ctx.state.register3 = '+88888'
        setTimeout(() => {
            ctx.state.lightTest = 0
            ctx.state.program = ''
            ctx.state.verb = '88'
            ctx.state.noun = '88'
            ctx.state.verbNounFlashing = false
            ctx.state.register1 = '+88888'
            ctx.state.register2 = '+88888'
            ctx.state.register3 = '+88888'
        }, 5000)
    }
}

// V37 — Change Program
const createV37 = (ctx: AgcContext): VerbHandler => {
    return (enter = false, pro = false) => {
        if (pro) return
        try {
            if (!ctx.state.verbNounFlashing) {
                ctx.state.inputMode = 'noun'
                ctx.state.noun = ''
                ctx.state.verbNounFlashing = true
            } else if (ctx.state.noun === '00') {
                // P00 — idle program
                ctx.state.program = '00'
                ctx.state.inputMode = ''
                ctx.state.verbNounFlashing = false
                ctx.state.verbStack = []
                ctx.state.noun = ''
                ctx.state.verb = ''
                ctx.state.register1 = ''
                ctx.state.register2 = ''
                ctx.state.register3 = ''
            } else {
                ctx.state.operatorErrorActive = true
            }
        } catch {
            console.log('[HA] V37 fail')
        }
    }
}

// V40 — Toggle switch (on/off) for entity in R1 of current noun
const createV40 = (ctx: AgcContext, verbs: Record<string, VerbHandler>): VerbHandler => {
    return async (enter = false, pro = false) => {
        if (pro) return
        try {
            if (!enter) return
            const entityId = ctx.getNounEntity?.(ctx.state.noun, 0)
            if (!entityId) {
                ctx.state.operatorErrorActive = true
                return
            }

            const domain = entityId.split('.')[0]
            if (!ctx.callService) {
                ctx.state.operatorErrorActive = true
                return
            }

            ctx.state.compActy = true
            const currentValue = ctx.getNounValues(ctx.state.noun)[0]

            const toggleableDomains = ['switch', 'light']
            if (!toggleableDomains.includes(domain)) {
                ctx.state.operatorErrorActive = true
                ctx.state.compActy = false
                return
            }
            const service = currentValue === 1 ? 'turn_off' : 'turn_on'
            await ctx.callService(domain, service, { entity_id: entityId })

            ctx.state.compActy = false
            ctx.state.verb = '16'
            ctx.state.keyRel = ['16', ctx.state.noun]
            ctx.state.keyRelMode = true
            verbs['16'](false, false)
        } catch (e) {
            console.log('[HA] V40 fail', e)
            ctx.state.compActy = false
        }
    }
}

export const createVerbs = (ctx: AgcContext): Record<string, VerbHandler> => {
    const verbs: Record<string, VerbHandler> = {}

    verbs['06'] = createV06(ctx, verbs)
    verbs['16'] = createV16(ctx, verbs)
    verbs['21'] = createLoadRegisterVerb(ctx, verbs, 0)
    verbs['22'] = createLoadRegisterVerb(ctx, verbs, 1)
    verbs['23'] = createLoadRegisterVerb(ctx, verbs, 2)
    verbs['24'] = createV24(ctx, verbs)
    verbs['25'] = createV25(ctx, verbs)
    verbs['35'] = createV35(ctx)
    verbs['37'] = createV37(ctx)
    verbs['40'] = createV40(ctx, verbs)

    return verbs
}
