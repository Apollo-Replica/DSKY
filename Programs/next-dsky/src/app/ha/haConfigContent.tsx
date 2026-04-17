"use client"

import { useEffect, useState, useRef } from 'react'
import { useServerState } from '../hooks/useServerState'
import { Page, Card, Title, Label, Input, Button, StatusBadge, Hint, ErrorText, Spacer, EntityList, CheckboxRow, Checkbox, Domain } from './haStyledComponents'

export default function HaConfigContent() {
    const { serverState, wsConnected, sendMessage } = useServerState()
    const initializedRef = useRef(false)

    // Form state
    const [url, setUrl] = useState('')
    const [token, setToken] = useState('')
    const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([])
    const [editing, setEditing] = useState(false)

    // Pre-fill form from persisted config on first load
    useEffect(() => {
        if (initializedRef.current || !serverState) return
        initializedRef.current = true

        const ha = serverState.ha
        if (ha.url) setUrl(ha.url)
        if (ha.token) setToken(ha.token)
        if (ha.selectedIds) setLocalSelectedIds(ha.selectedIds)
    }, [serverState])

    // Sync entity selection when server discovers new entities
    useEffect(() => {
        if (!editing) return
        if (serverState?.ha?.selectedIds) {
            setLocalSelectedIds(serverState.ha.selectedIds)
        } else if (serverState?.ha?.entities) {
            setLocalSelectedIds(serverState.ha.entities.map(e => e.entity_id))
        }
    }, [serverState?.ha?.entities, editing])

    const ha = serverState?.ha
    const isConfigured = ha?.configured === true
    const hasEntities = (ha?.entities?.length ?? 0) > 0
    const entities = ha?.entities ?? []
    const haError = ha?.error

    const handleDiscover = () => {
        sendMessage('action:discover-ha', { url, token })
        setEditing(true)
    }

    const handleConfigure = () => {
        sendMessage('action:ha-configure', {
            url,
            token,
            entityIds: localSelectedIds,
            entities,
        })
        setEditing(false)
    }

    const handleReconfigure = () => {
        setEditing(true)
        sendMessage('action:discover-ha', { url, token })
    }

    const toggleEntity = (entityId: string) => {
        setLocalSelectedIds(prev =>
            prev.includes(entityId)
                ? prev.filter(id => id !== entityId)
                : [...prev, entityId]
        )
    }

    const allSelected = entities.length > 0 && entities.every(e => localSelectedIds.includes(e.entity_id))
    const toggleSelectAll = () => {
        if (allSelected) setLocalSelectedIds([])
        else setLocalSelectedIds(entities.map(e => e.entity_id))
    }

    if (!wsConnected) {
        return (
            <Page>
                <Card>
                    <Title>Connecting to DSKY...</Title>
                    <Hint>Make sure the DSKY server is running.</Hint>
                </Card>
            </Page>
        )
    }

    if (serverState && serverState.ha.enabled !== true) {
        return (
            <Page>
                <Card>
                    <Title>Home Assistant Disabled</Title>
                    <Hint>Set <code>DSKY_HOMEASSISTANT=1</code> in the server environment to enable this integration.</Hint>
                </Card>
            </Page>
        )
    }

    // --- Configured state (not editing) ---
    if (isConfigured && !editing) {
        return (
            <Page>
                <Card>
                    <Title>Home Assistant</Title>
                    <StatusBadge active>CONFIGURED</StatusBadge>
                    {ha?.url && <Hint>{ha.url}</Hint>}
                    {ha?.selectedIds && <Hint>{ha.selectedIds.length} entities active</Hint>}
                    <Spacer />
                    <Button onClick={handleReconfigure}>
                        Edit Configuration
                    </Button>
                    <Spacer />
                    <Button onClick={() => sendMessage('action:ha-reconfigure')} variant="danger">
                        Remove Configuration
                    </Button>
                    <Hint style={{ marginTop: 12 }}>
                        This will stop the Home Assistant integration and clear saved credentials.
                    </Hint>
                </Card>
            </Page>
        )
    }

    // --- Setup / edit form ---
    return (
        <Page>
            <Card>
                <Title>{isConfigured ? 'Edit Configuration' : 'Home Assistant Setup'}</Title>

                <Label>Home Assistant URL</Label>
                <Input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="http://homeassistant.local:8123"
                />

                <Label>Long-Lived Access Token</Label>
                <Input
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="Paste your token here"
                    type="password"
                />

                <Spacer />
                <Button
                    onClick={handleDiscover}
                    disabled={!url.startsWith('http') || token.trim().length === 0}
                    variant={hasEntities ? 'secondary' : undefined}
                >
                    {hasEntities ? 'Re-discover Entities' : 'Discover Entities'}
                </Button>

                {haError && (
                    <ErrorText>{haError}</ErrorText>
                )}

                {hasEntities && (
                    <>
                        <Spacer />
                        <Label>Entities ({localSelectedIds.length}/{entities.length} selected)</Label>

                        <CheckboxRow onClick={toggleSelectAll}>
                            <Checkbox checked={allSelected} readOnly />
                            <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
                        </CheckboxRow>

                        <EntityList>
                            {entities.map(entity => (
                                <CheckboxRow key={entity.entity_id} onClick={() => toggleEntity(entity.entity_id)}>
                                    <Checkbox checked={localSelectedIds.includes(entity.entity_id)} readOnly />
                                    <span>{entity.friendly_name}</span>
                                    <Domain>{entity.domain}</Domain>
                                </CheckboxRow>
                            ))}
                        </EntityList>

                        <Spacer />
                        <Button
                            onClick={handleConfigure}
                            disabled={localSelectedIds.length === 0}
                        >
                            Save &amp; Start
                        </Button>
                    </>
                )}

                {isConfigured && (
                    <>
                        <Spacer />
                        <Button onClick={() => setEditing(false)} variant="secondary">
                            Cancel
                        </Button>
                    </>
                )}
            </Card>
        </Page>
    )
}
