"use client"

import type { ReactNode } from "react"

interface MenuCardProps {
    index: number
    icon: ReactNode
    label: string
    description?: string
    badge?: string
    badgeActive?: boolean
    selected: boolean
    onClick: () => void
}

export default function MenuCard({
    index,
    icon,
    label,
    description,
    badge,
    badgeActive,
    selected,
    onClick,
}: MenuCardProps) {
    return (
        <div
            style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4cqh 2cqw',
                background: selected ? 'rgba(74, 222, 128, 0.1)' : 'rgba(10, 20, 10, 0.85)',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: selected ? 'var(--menu-primary)' : 'var(--menu-border)',
                borderRadius: '1cqh',
                cursor: 'pointer',
                fontFamily: 'monospace',
                textAlign: 'center',
                transition: 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
                boxShadow: selected ? '0 0 12px rgba(74, 222, 128, 0.25)' : 'none',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
                outline: 'none',
            }}
            onClick={onClick}
            role="menuitem"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            data-menu-card="true"
        >
            {/* Number */}
            <span style={{
                position: 'absolute',
                top: '1cqh',
                left: '2cqw',
                fontSize: '2.2cqh',
                color: selected ? 'var(--menu-primary)' : 'var(--menu-secondary)',
                fontWeight: 600,
                opacity: selected ? 1 : 0.5,
            }}>
                {index}
            </span>

            {/* Badge */}
            {badge && (
                <span style={{
                    position: 'absolute',
                    top: '1cqh',
                    right: '2cqw',
                    fontSize: '2cqh',
                    padding: '0.4cqh 1.5cqw',
                    borderRadius: 2,
                    background: badgeActive ? 'rgba(74, 222, 128, 0.25)' : 'rgba(74, 222, 128, 0.15)',
                    color: badgeActive ? 'var(--menu-highlight)' : 'var(--menu-primary)',
                    fontWeight: 600,
                }}>
                    {badge}
                </span>
            )}

            {/* Icon */}
            <span style={{
                fontSize: '7cqh',
                color: 'var(--menu-primary)',
                lineHeight: 1,
                textShadow: selected ? '0 0 8px rgba(74, 222, 128, 0.5)' : 'none',
            }}>
                {icon}
            </span>

            {/* Label */}
            <span style={{
                fontSize: '3.5cqh',
                fontWeight: 600,
                color: 'var(--menu-primary)',
                letterSpacing: '0.4cqh',
                textTransform: 'uppercase',
                marginTop: '1cqh',
                textShadow: selected ? '0 0 8px rgba(74, 222, 128, 0.5)' : 'none',
            }}>
                {label}
            </span>

            {/* Description */}
            {description && (
                <span style={{
                    fontSize: '2.2cqh',
                    color: 'var(--menu-secondary)',
                    marginTop: '0.5cqh',
                }}>
                    {description}
                </span>
            )}
        </div>
    )
}
