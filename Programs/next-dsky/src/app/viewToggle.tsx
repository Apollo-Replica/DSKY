export default function ViewToggle({
  viewMode, onToggle, muted, onToggleMuted,
}: {
  viewMode: 'full' | 'screen'
  onToggle: () => void
  muted: boolean
  onToggleMuted: () => void
}) {
  const isFull = viewMode === 'full'
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
        </div>
      </div>
    </div>
  )
}
