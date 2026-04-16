export default function ViewToggle({ viewMode, onToggle }: { viewMode: 'full' | 'screen'; onToggle: () => void }) {
  const isFull = viewMode === 'full'
  return (
    <div className="view-toggle" onClick={onToggle} title={isFull ? 'Screen only' : 'Full DSKY'}>
      <div className="toggle-panel">
        {/* Corner screws */}
        <div className="toggle-screw" style={{ top: 3, left: 3 }} />
        <div className="toggle-screw" style={{ top: 3, right: 3 }} />
        <div className="toggle-screw" style={{ bottom: 3, left: 3 }} />
        <div className="toggle-screw" style={{ bottom: 3, right: 3 }} />

        {/* Fixed labels — both always visible */}
        <div className={`toggle-label ${isFull ? 'toggle-label-active' : ''}`}>FULL</div>

        {/* Switch housing + lever */}
        <div className="toggle-housing">
          <div className={`toggle-lever ${isFull ? 'toggle-up' : 'toggle-down'}`}>
            <div className="toggle-knob" />
          </div>
        </div>

        <div className={`toggle-label ${!isFull ? 'toggle-label-active' : ''}`}>SCR</div>
      </div>
    </div>
  )
}
