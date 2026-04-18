import Image from "next/image";
import type { DskyState } from "../types/dsky"

type Rect = { left: number, top: number, width: number, height: number }

interface AlarmsProps {
    dskyState: DskyState
    opacity: number
    area?: Rect
    mode?: 'overlay' | 'screen'
}

// Container area within the DSKY image (overlay mode only)
const DEFAULT_BG_AREA: Rect = { left: 12.3, top: 9.1, width: 34, height: 49.2 }
const DEFAULT_LABEL_AREA: Rect = { left: 12.3, top: 10, width: 34, height: 47.8 }

const WHITE = 'rgb(255, 245, 180)'
const AMBER = 'rgb(230, 120, 30)'

// Each alarm carries both position rects: `overlay` is tuned to the DSKY image chassis,
// `screen` matches the alarm-mask SVG window cutouts exactly.
const alarms: { key: string, color: string, overlay: Rect, screen: Rect }[] = [
    { key: 'IlluminateUplinkActy', color: WHITE,
      overlay: { left: 7.82,  top: 5.66,  width: 40.91, height: 11.63 },
      screen:  { left: 5.35,  top: 3.44,  width: 41.97, height: 12.13 } },
    { key: 'IlluminateNoAtt',      color: WHITE,
      overlay: { left: 7.82,  top: 18.47, width: 40.91, height: 11.63 },
      screen:  { left: 5.34,  top: 16.75, width: 41.98, height: 12.29 } },
    { key: 'IlluminateStby',       color: WHITE,
      overlay: { left: 7.82,  top: 31.78, width: 40.91, height: 11.63 },
      screen:  { left: 5.37,  top: 30.51, width: 41.95, height: 12.01 } },
    { key: 'IlluminateKeyRel',     color: WHITE,
      overlay: { left: 7.82,  top: 44.39, width: 40.91, height: 11.63 },
      screen:  { left: 5.34,  top: 43.98, width: 42.01, height: 12.29 } },
    { key: 'IlluminateOprErr',     color: WHITE,
      overlay: { left: 8.21,  top: 57.21, width: 40.91, height: 11.63 },
      screen:  { left: 5.35,  top: 57.45, width: 41.97, height: 12.13 } },
    { key: 'IlluminatePrioDisp',   color: AMBER,
      overlay: { left: 7.82,  top: 70.41, width: 40.91, height: 11.63 },
      screen:  { left: 5.35,  top: 70.78, width: 41.97, height: 12.13 } },
    { key: 'IlluminateNoDap',      color: AMBER,
      overlay: { left: 7.82,  top: 83.33, width: 40.91, height: 11.63 },
      screen:  { left: 5.34,  top: 84.09, width: 41.98, height: 12.29 } },
    { key: 'IlluminateTemp',       color: AMBER,
      overlay: { left: 52.54, top: 5.95,  width: 40.91, height: 11.63 },
      screen:  { left: 52.68, top: 3.59,  width: 41.95, height: 11.98 } },
    { key: 'IlluminateGimbalLock', color: AMBER,
      overlay: { left: 52.54, top: 18.77, width: 40.91, height: 11.63 },
      screen:  { left: 52.68, top: 17.05, width: 41.95, height: 11.99 } },
    { key: 'IlluminateProg',       color: AMBER,
      overlay: { left: 52.54, top: 31.58, width: 40.91, height: 11.63 },
      screen:  { left: 52.66, top: 30.27, width: 41.98, height: 12.25 } },
    { key: 'IlluminateRestart',    color: AMBER,
      overlay: { left: 52.15, top: 44.59, width: 40.91, height: 11.63 },
      screen:  { left: 52.65, top: 43.98, width: 41.98, height: 12.28 } },
    { key: 'IlluminateTracker',    color: AMBER,
      overlay: { left: 52.93, top: 57.60, width: 40.91, height: 11.63 },
      screen:  { left: 52.68, top: 57.45, width: 41.95, height: 11.98 } },
    { key: 'IlluminateAlt',        color: AMBER,
      overlay: { left: 52.93, top: 70.41, width: 40.91, height: 11.63 },
      screen:  { left: 52.66, top: 70.65, width: 41.98, height: 12.25 } },
    { key: 'IlluminateVel',        color: AMBER,
      overlay: { left: 51.76, top: 83.33, width: 40.91, height: 11.63 },
      screen:  { left: 52.68, top: 84.38, width: 41.95, height: 11.99 } },
]

const rectStyle = (r: Rect) => ({
    position: 'absolute' as const,
    left: `${r.left}%`, top: `${r.top}%`, width: `${r.width}%`, height: `${r.height}%`,
})

const SvgLayer = ({ src, zIndex }: { src: string, zIndex?: number }) => (
    <Image
        alt={src.replace(/^\.\/|\.svg$/g, '')}
        src={src}
        width={1000}
        height={1000}
        style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex }}
    />
)

const Alarms = ({ dskyState, opacity, area, mode = 'overlay' }: AlarmsProps) => {
    if (mode === 'screen') {
        // Screen mode: flat white cells that turn colored when active; chassis SVG on top frames the windows.
        return (
            <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' }}>
                {alarms.map(alarm => {
                    const active = !!dskyState[alarm.key]
                    return <div key={alarm.key} style={{
                        ...rectStyle(alarm.screen),
                        backgroundColor: active ? alarm.color : 'white',
                        opacity: active ? opacity : 1,
                    }} />
                })}
                <SvgLayer src={'./dsky/alarms_chassis.svg'} zIndex={2} />
                <SvgLayer src={'./dsky/alarms_labels.svg'} zIndex={3} />
            </div>
        )
    }

    // Overlay mode: lit cells glow over the printed DSKY chassis; when off they're transparent.
    const bg = area ?? DEFAULT_BG_AREA
    const lbl = DEFAULT_LABEL_AREA
    const baseStyle = { position: 'absolute' as const, pointerEvents: 'none' as const }
    return (
        <>
            <div style={{ ...baseStyle, ...rectStyle(bg), zIndex: 2 }}>
                {alarms.map(alarm => {
                    const active = !!dskyState[alarm.key]
                    return (
                        <div key={alarm.key} style={{ ...rectStyle(alarm.overlay), overflow: 'hidden' }}>
                            <div style={{
                                position: 'absolute',
                                left: '15%', top: '20%', width: '70%', height: '60%',
                                backgroundColor: active ? alarm.color : undefined,
                                opacity: active ? opacity : 0,
                                borderRadius: '3px',
                                boxShadow: active ? `0 0 14px 10px ${alarm.color}` : undefined,
                            }} />
                        </div>
                    )
                })}
            </div>
            <div style={{ ...baseStyle, ...rectStyle(lbl), zIndex: 3 }}>
                <SvgLayer src={'./dsky/alarms_labels.svg'} />
            </div>
        </>
    )
}

export default Alarms
