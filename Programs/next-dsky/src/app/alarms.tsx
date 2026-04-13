import Image from "next/image";
import type { DskyState } from "../types/dsky"

interface AlarmsProps {
    dskyState: DskyState
    opacity: number
    area?: { left: number, top: number, width: number, height: number }
    mode?: 'overlay' | 'screen'
}

// Default area position (% of DSKY image container) — used in overlay mode
const DEFAULT_BG_AREA = { left: 12.3, top: 9.1, width: 34, height: 49.2 }
const DEFAULT_LABEL_AREA = { left: 12.3, top: 10, width: 34, height: 47.8 }

// Each alarm: key, overlay position (% of alarm container), color
// Positions mapped from original hand-tuned values to new container (12.3, 9.5, 34, 48.8)
const alarmDefs = [
    { key: 'IlluminateUplinkActy', left: 7.82, top: 5.66, width: 40.91, height: 11.63, color: 'rgb(255, 245, 180)' },
    { key: 'IlluminateNoAtt',      left: 7.82, top: 18.47, width: 40.91, height: 11.63, color: 'rgb(255, 245, 180)' },
    { key: 'IlluminateStby',       left: 7.82, top: 31.78, width: 40.91, height: 11.63, color: 'rgb(255, 245, 180)' },
    { key: 'IlluminateKeyRel',     left: 7.82, top: 44.39, width: 40.91, height: 11.63, color: 'rgb(255, 245, 180)' },
    { key: 'IlluminateOprErr',     left: 8.21, top: 57.21, width: 40.91, height: 11.63, color: 'rgb(255, 245, 180)' },
    { key: 'IlluminateNoDap',      left: 7.82, top: 70.41, width: 40.91, height: 11.63, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminatePrioDisp',   left: 7.82, top: 83.33, width: 40.91, height: 11.63, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateTemp',       left: 52.54, top: 5.95, width: 40.91, height: 11.63, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateGimbalLock', left: 52.54, top: 18.77, width: 40.91, height: 11.63, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateProg',       left: 52.54, top: 31.58, width: 40.91, height: 11.63, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateRestart',    left: 52.15, top: 44.59, width: 40.91, height: 11.63, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateTracker',    left: 52.93, top: 57.60, width: 40.91, height: 11.63, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateAlt',        left: 52.93, top: 70.41, width: 40.91, height: 11.63, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateVel',        left: 51.76, top: 83.33, width: 40.91, height: 11.63, color: 'rgb(230, 120, 30)' },
]

// Screen-mode positions: match the SVG mask window cutouts exactly (% of mask viewBox)
const screenAlarmDefs = [
    { key: 'IlluminateUplinkActy', left: 5.35, top: 3.44, width: 41.97, height: 12.13, color: 'rgb(255, 245, 180)' },
    { key: 'IlluminateNoAtt',      left: 5.34, top: 16.75, width: 41.98, height: 12.29, color: 'rgb(255, 245, 180)' },
    { key: 'IlluminateStby',       left: 5.37, top: 30.51, width: 41.95, height: 12.01, color: 'rgb(255, 245, 180)' },
    { key: 'IlluminateKeyRel',     left: 5.34, top: 43.98, width: 42.01, height: 12.29, color: 'rgb(255, 245, 180)' },
    { key: 'IlluminateOprErr',     left: 5.35, top: 57.45, width: 41.97, height: 12.13, color: 'rgb(255, 245, 180)' },
    { key: 'IlluminateNoDap',      left: 5.35, top: 70.78, width: 41.97, height: 12.13, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminatePrioDisp',   left: 5.34, top: 84.09, width: 41.98, height: 12.29, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateTemp',       left: 52.68, top: 3.59, width: 41.95, height: 11.98, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateGimbalLock', left: 52.68, top: 17.05, width: 41.95, height: 11.99, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateProg',       left: 52.66, top: 30.27, width: 41.98, height: 12.25, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateRestart',    left: 52.65, top: 43.98, width: 41.98, height: 12.28, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateTracker',    left: 52.68, top: 57.45, width: 41.95, height: 11.98, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateAlt',        left: 52.66, top: 70.65, width: 41.98, height: 12.25, color: 'rgb(230, 120, 30)' },
    { key: 'IlluminateVel',        left: 52.68, top: 84.38, width: 41.95, height: 11.99, color: 'rgb(230, 120, 30)' },
]

const Alarms = ({ dskyState, opacity, area, mode = 'overlay' }: AlarmsProps) => {
    if (mode === 'screen') {
        // Screen mode: color bands behind SVG mask.
        // Positions match the SVG mask window cutouts exactly.
        return (
            <div style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'hidden',
            }}>
                {screenAlarmDefs.map(alarm => (
                    <div key={alarm.key} style={{
                        position: 'absolute',
                        left: `${alarm.left}%`,
                        top: `${alarm.top}%`,
                        width: `${alarm.width}%`,
                        height: `${alarm.height}%`,
                        backgroundColor: dskyState[alarm.key] ? alarm.color : 'white',
                        opacity: dskyState[alarm.key] ? opacity : 1,
                    }} />
                ))}
                {/* SVG mask on top — frames the alarm windows */}
                <Image
                    alt={'alarms_mask'}
                    src={'./alarms_mask.svg'}
                    width={1000}
                    height={1000}
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        top: 0,
                        left: 0,
                        zIndex: 2,
                    }}
                />
            </div>
        )
    }

    // Overlay mode: absolute positioning within DSKY image container
    const bg = area ?? DEFAULT_BG_AREA
    const lbl = DEFAULT_LABEL_AREA
    const baseStyle = {
        position: 'absolute' as const,
        pointerEvents: 'none' as const,
    }
    return (
        <>
            {/* Color rectangles — above the DSKY chassis, below labels */}
            <div style={{ ...baseStyle, left: `${bg.left}%`, top: `${bg.top}%`, width: `${bg.width}%`, height: `${bg.height}%`, zIndex: 2 }}>
                {alarmDefs.map(alarm => {
                    const active = !!dskyState[alarm.key]
                    return (
                        <div key={alarm.key} style={{
                            position: 'absolute',
                            left: `${alarm.left}%`,
                            top: `${alarm.top}%`,
                            width: `${alarm.width}%`,
                            height: `${alarm.height}%`,
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                position: 'absolute',
                                left: '15%',
                                top: '20%',
                                width: '70%',
                                height: '60%',
                                backgroundColor: active ? alarm.color : undefined,
                                opacity: active ? opacity : 0,
                                borderRadius: '3px',
                                boxShadow: active ? `0 0 14px 10px ${alarm.color}` : undefined,
                            }} />
                        </div>
                    )
                })}
            </div>
            {/* SVG labels — above the DSKY chassis (zIndex 3) */}
            <div style={{ ...baseStyle, left: `${lbl.left}%`, top: `${lbl.top}%`, width: `${lbl.width}%`, height: `${lbl.height}%`, zIndex: 3 }}>
                <Image
                    alt={'alarms_labels'}
                    src={'./alarms_labels.svg'}
                    width={1000}
                    height={1000}
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        top: 0,
                        left: 0,
                    }}
                />
            </div>
        </>
    )
}

export default Alarms
