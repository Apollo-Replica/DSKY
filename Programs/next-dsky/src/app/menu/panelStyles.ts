/**
 * Shared styles for info-panel screens (CommandsScreen, AboutScreen).
 */

export const panelStyle: React.CSSProperties = {
    background: 'rgba(10, 20, 10, 0.85)',
    border: '1px solid var(--menu-border)',
    borderRadius: '1cqh',
    padding: '3cqh 3cqw',
    fontFamily: 'monospace',
    color: 'var(--menu-primary)',
}

export const sectionStyle: React.CSSProperties = {
    marginBottom: '3cqh',
}

export const titleStyle: React.CSSProperties = {
    fontSize: '2.5cqh',
    color: 'var(--menu-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.3cqh',
    marginBottom: '1.5cqh',
    paddingBottom: '0.8cqh',
    borderBottom: '1px solid var(--menu-border)',
}

export const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: '2cqw',
    padding: '0.5cqh 0',
    fontSize: '2.5cqh',
}

export const keyStyle: React.CSSProperties = {
    color: 'var(--menu-accent)',
    fontWeight: 600,
    minWidth: '12cqw',
    flexShrink: 0,
}

export const valueStyle: React.CSSProperties = {
    color: 'var(--menu-primary)',
}

export const hintStyle: React.CSSProperties = {
    color: 'var(--menu-secondary)',
    fontSize: '2.2cqh',
}
