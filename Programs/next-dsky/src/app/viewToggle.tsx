import type { DisplayVariant } from "./homeContent"

export default function ViewToggle({
  viewMode, onToggle, muted, onToggleMuted, displayVariant, onToggleDisplay,
}: {
  viewMode: 'full' | 'screen'
  onToggle: () => void
  muted: boolean
  onToggleMuted: () => void
  displayVariant: DisplayVariant
  onToggleDisplay: () => void
}) {
  const isFull = viewMode === 'full'
  const isAmoled = displayVariant === 'amoled544'
  return (
    <div className="view-toggle">
      <div className="toggle-panel toggle-panel-wide">
        {/* Corner screws */}
        <div className="toggle-screw" style={{ top: 3, left: 3 }} />
        <div className="toggle-screw" style={{ top: 3, right: 3 }} />
        <div className="toggle-screw" style={{ bottom: 3, left: 3 }} />
        <div className="toggle-screw" style={{ bottom: 3, right: 3 }} />

        <div className="toggle-row">
          {/* View toggle */}
          <div className="toggle-group" onClick={onToggle} title={isFull ? 'Screen only' : 'Full DSKY'}>
            <div className={`toggle-label ${isFull ? 'toggle-label-active' : ''}`}>FULL</div>
            <div className="toggle-housing">
              <div className={`toggle-lever ${isFull ? 'toggle-up' : 'toggle-down'}`}>
                <div className="toggle-knob" />
              </div>
            </div>
            <div className={`toggle-label ${!isFull ? 'toggle-label-active' : ''}`}>SCR</div>
          </div>

          <div className="toggle-divider" />

          {/* Audio toggle */}
          <div className="toggle-group" onClick={onToggleMuted} title={muted ? 'Unmute audio' : 'Mute audio'}>
            <div className={`toggle-label ${!muted ? 'toggle-label-active' : ''}`}>SOUND</div>
            <div className="toggle-housing">
              <div className={`toggle-lever ${!muted ? 'toggle-up' : 'toggle-down'}`}>
                <div className="toggle-knob" />
              </div>
            </div>
            <div className={`toggle-label ${muted ? 'toggle-label-active' : ''}`}>MUTE</div>
          </div>

          <div className="toggle-divider" />

          {/* Display variant toggle */}
          <div className="toggle-group" onClick={onToggleDisplay} title={isAmoled ? 'Switch to 800x480 LCD' : 'Switch to 960x544 AMOLED'}>
            <div className={`toggle-label ${isAmoled ? 'toggle-label-active' : ''}`}>AMOLED</div>
            <div className="toggle-housing">
              <div className={`toggle-lever ${isAmoled ? 'toggle-up' : 'toggle-down'}`}>
                <div className="toggle-knob" />
              </div>
            </div>
            <div className={`toggle-label ${!isAmoled ? 'toggle-label-active' : ''}`}>LCD</div>
          </div>
        </div>
      </div>
    </div>
  )
}
