import Image from "next/image";
import type { DskyState } from "../types/dsky"

interface AlarmsProps {
    dskyState: DskyState
    opacity: number
    area?: { left: number, top: number, width: number, height: number }
    mode?: 'overlay' | 'screen'
}

// Default area position (% of DSKY image container) — used in overlay mode
const DEFAULT_AREA = { left: 13.1, top: 10, width: 33.2, height: 48.1 }

// Each alarm: key, overlay position (% of alarm container), color
// Overlay positions are tuned for the DSKY photo overlay mode.
const alarmDefs = [
    { key: 'IlluminateUplinkActy', left: 5.6, top: 4.7, width: 41.9, height: 11.8, color: 'rgb(151, 217, 255)' },
    { key: 'IlluminateNoAtt',      left: 5.6, top: 17.7, width: 41.9, height: 11.8, color: 'rgb(151, 217, 255)' },
    { key: 'IlluminateStby',       left: 5.6, top: 31.2, width: 41.9, height: 11.8, color: 'rgb(151, 217, 255)' },
    { key: 'IlluminateKeyRel',     left: 5.6, top: 44, width: 41.9, height: 11.8, color: 'rgb(151, 217, 255)' },
    { key: 'IlluminateOprErr',     left: 6, top: 57, width: 41.9, height: 11.8, color: 'rgb(151, 217, 255)' },
    { key: 'IlluminateNoDap',      left: 5.6, top: 70.4, width: 41.9, height: 11.8, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminatePrioDisp',   left: 5.6, top: 83.5, width: 41.9, height: 11.8, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateTemp',       left: 51.4, top: 5, width: 41.9, height: 11.8, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateGimbalLock', left: 51.4, top: 18, width: 41.9, height: 11.8, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateProg',       left: 51.4, top: 31, width: 41.9, height: 11.8, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateRestart',    left: 51, top: 44.2, width: 41.9, height: 11.8, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateTracker',    left: 51.8, top: 57.4, width: 41.9, height: 11.8, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateAlt',        left: 51.8, top: 70.4, width: 41.9, height: 11.8, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateVel',        left: 50.6, top: 83.5, width: 41.9, height: 11.8, color: 'rgb(253, 203, 21)' },
]

// Screen-mode positions: match the SVG mask window cutouts exactly (% of mask viewBox)
const screenAlarmDefs = [
    { key: 'IlluminateUplinkActy', left: 5.35, top: 3.44, width: 41.97, height: 12.13, color: 'rgb(151, 217, 255)' },
    { key: 'IlluminateNoAtt',      left: 5.34, top: 16.75, width: 41.98, height: 12.29, color: 'rgb(151, 217, 255)' },
    { key: 'IlluminateStby',       left: 5.37, top: 30.51, width: 41.95, height: 12.01, color: 'rgb(151, 217, 255)' },
    { key: 'IlluminateKeyRel',     left: 5.34, top: 43.98, width: 42.01, height: 12.29, color: 'rgb(151, 217, 255)' },
    { key: 'IlluminateOprErr',     left: 5.35, top: 57.45, width: 41.97, height: 12.13, color: 'rgb(151, 217, 255)' },
    { key: 'IlluminateNoDap',      left: 5.35, top: 70.78, width: 41.97, height: 12.13, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminatePrioDisp',   left: 5.34, top: 84.09, width: 41.98, height: 12.29, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateTemp',       left: 52.68, top: 3.59, width: 41.95, height: 11.98, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateGimbalLock', left: 52.68, top: 17.05, width: 41.95, height: 11.99, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateProg',       left: 52.66, top: 30.27, width: 41.98, height: 12.25, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateRestart',    left: 52.65, top: 43.98, width: 41.98, height: 12.28, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateTracker',    left: 52.68, top: 57.45, width: 41.95, height: 11.98, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateAlt',        left: 52.66, top: 70.65, width: 41.98, height: 12.25, color: 'rgb(253, 203, 21)' },
    { key: 'IlluminateVel',        left: 52.68, top: 84.38, width: 41.95, height: 11.99, color: 'rgb(253, 203, 21)' },
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
    const a = area ?? DEFAULT_AREA
    const containerStyle = {
        position: 'absolute' as const,
        left: `${a.left}%`,
        top: `${a.top}%`,
        width: `${a.width}%`,
        height: `${a.height}%`,
        pointerEvents: 'none' as const,
    }
    return (
        <>
            {/* Color rectangles — behind the DSKY chassis (zIndex 1) */}
            <div style={{ ...containerStyle, zIndex: 1 }}>
                {alarmDefs.map(alarm => (
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
            </div>
            {/* SVG labels — above the DSKY chassis (zIndex 3) */}
            <div style={{ ...containerStyle, zIndex: 3 }}>
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
