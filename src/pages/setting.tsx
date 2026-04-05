import Modal from 'antd/es/modal'
import Select from 'antd/es/select'
import Input from 'antd/es/input'
import Button from 'antd/es/button'
import { useCoreStore, type Facility } from '../model';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { loadVacsCredentials, clearVacsCredentials } from '../lib/vacs/store';
import { VVSCS_SERVER_URL } from '../lib/vvscs/types';
import { vnasStore } from '../lib/vnas/store';
import type { VnasEnvironment } from '../lib/vnas/types';

interface Position {
    cs: string;
    pos: string;
    freq: number;
    rn: string;
    lines: any[];
}

/** Recursively collect all positions from a facility and its children */
function collectPositions(facility: Facility): Position[] {
    const positions: Position[] = [...(facility.positions || [])];
    for (const child of facility.childFacilities || []) {
        positions.push(...collectPositions(child));
    }
    return positions;
}

const formatFreq = (freq: number) => {
    if (!freq) return '';
    const val = freq / 1_000_000;
    if (val % 1 === 0) return val.toFixed(1);
    return val.toString().replace(/0+$/, '').replace(/\.$/, '');
};

interface SettingModalProps {
    open: boolean;
    setModal: (open: boolean) => void;
}

function SettingModal({ open, setModal }: SettingModalProps) {
    const positionsData = useCoreStore(s => s.positionData)
    const updateSelectedPosition = useCoreStore(s => s.updateSelectedPositions)
    const vacsConnected = useCoreStore(s => s.vacsConnected)
    const vacsStatus = useCoreStore(s => s.vacsStatus)
    const vacsError = useCoreStore(s => s.vacsError)
    const connectVacs = useCoreStore(s => s.connectVacs)
    const connectVacsWithVatsimToken = useCoreStore(s => s.connectVacsWithVatsimToken)
    const disconnectVacs = useCoreStore(s => s.disconnectVacs)
    const vvscsConnected = useCoreStore(s => s.vvscsConnected)
    const vvscsStatus = useCoreStore(s => s.vvscsStatus)
    const vvscsError = useCoreStore(s => s.vvscsError)
    const connectVvscs = useCoreStore(s => s.connectVvscs)
    const disconnectVvscs = useCoreStore(s => s.disconnectVvscs)
    const callsign = useCoreStore(s => s.callsign)
    const isSweatbox = useCoreStore(s => s.isSweatbox)
    const vnasConfig = useCoreStore(s => s.vnasConfig)
    const vnasEnvironment = useCoreStore(s => s.vnasEnvironment)
    const vnasHubConnected = useCoreStore(s => s.vnasHubConnected)
    const vnasStatus = useCoreStore(s => s.vnasStatus)
    const vnasSession = useCoreStore(s => s.vnasSession)
    const vnasError = useCoreStore(s => s.vnasError)
    const vnasSelectEnvironment = useCoreStore(s => s.vnasSelectEnvironment)
    const vnasLoginWithToken = useCoreStore(s => s.vnasLoginWithToken)
    const vnasDisconnect = useCoreStore(s => s.vnasDisconnect)
    const [selectedFacility, setSelectedFacility] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
    const [vacsToken, setVacsToken] = useState('')
    const [vacsLoggingIn, setVacsLoggingIn] = useState(false)
    const [vacsLoginError, setVacsLoginError] = useState<string | null>(null)
    const [hasSavedToken, setHasSavedToken] = useState(() => !!loadVacsCredentials())
    const [vvscsFacility, setVvscsFacility] = useState('')
    const [vvscsPosition, setVvscsPosition] = useState('')
    const vacsPopupRef = useRef<Window | null>(null)
    const vnasPopupRef = useRef<Window | null>(null)
    const [vnasLoggingIn, setVnasLoggingIn] = useState(false)
    const [vnasLoginError, setVnasLoginError] = useState<string | null>(null)

    // Listen for OAuth callback messages from the popup (VACS and vNAS)
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Only accept messages from our own origin
            if (event.origin !== window.location.origin) return;

            let data: any;
            try {
                data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            } catch {
                return; // Not a JSON message
            }

            if (!data || typeof data.success === 'undefined') return;

            // Check if this is a vNAS auth result
            if (data.source === 'vnas') {
                setVnasLoggingIn(false);
                setVnasLoginError(null);
                if (data.success && data.vatsimToken) {
                    console.log('[Settings] vNAS OAuth success');
                    vnasLoginWithToken(data.vatsimToken).catch((err) => {
                        setVnasLoginError(err instanceof Error ? err.message : 'Login failed');
                    });
                } else {
                    const msg = data.error || 'vNAS authentication failed';
                    console.error('[Settings] vNAS OAuth failed:', msg);
                    setVnasLoginError(msg);
                }
                return;
            }

            // Check if this is a VACS auth result
            if (!data.wsToken && !data.error) return;

            setVacsLoggingIn(false);
            setVacsLoginError(null);

            if (data.success && data.wsToken) {
                console.log('[Settings] VACS OAuth success, CID:', data.cid);
                const positionId = callsign || undefined;
                connectVacs(data.wsToken, positionId, false);
                setTimeout(() => setHasSavedToken(!!loadVacsCredentials()), 3000);
            } else {
                const msg = data.error || 'VACS authentication failed';
                console.error('[Settings] VACS OAuth failed:', msg);
                setVacsLoginError(msg);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [callsign, connectVacs, vnasLoginWithToken]);

    // Fetch vNAS config on first mount
    useEffect(() => {
        vnasStore.fetchConfig().catch(() => {/* ignore */});
    }, []);

    /** Login with VATSIM via OAuth2 popup (VACS) */
    const handleVatsimLogin = useCallback(async () => {
        setVacsLoggingIn(true);
        setVacsLoginError(null);
        try {
            const res = await fetch('/api/vacs/auth/vatsim-login?env=dev');
            const data = await res.json();

            if (!data.url) {
                const msg = data.error || 'Failed to start VATSIM login';
                console.error('[Settings] No auth URL returned:', msg);
                setVacsLoginError(msg);
                setVacsLoggingIn(false);
                return;
            }

            // Open VATSIM login in a popup
            const popup = window.open(
                data.url,
                'vatsim-login',
                'width=600,height=700,menubar=no,toolbar=no,location=no,status=no'
            );
            vacsPopupRef.current = popup;

            // Watch for popup close without completing
            const checkClosed = setInterval(() => {
                if (popup?.closed) {
                    clearInterval(checkClosed);
                    setVacsLoggingIn(false);
                    vacsPopupRef.current = null;
                }
            }, 500);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            console.error('[Settings] VATSIM login error:', err);
            setVacsLoginError(msg);
            setVacsLoggingIn(false);
        }
    }, []);

    // Build facility options from top-level childFacilities, plus the parent itself if it has positions
    const facilities = useMemo(() => {
        if (!positionsData) return [];
        const children = (positionsData.childFacilities || []).map(f => ({
            value: f.id,
            label: f.name || f.id,
        }));
        if (positionsData.positions && positionsData.positions.length > 0) {
            return [
                { value: positionsData.id, label: positionsData.name || positionsData.id },
                ...children,
            ];
        }
        return children;
    }, [positionsData]);

    // Get positions for the selected facility, filtered by search
    const filteredPositions = useMemo(() => {
        if (!positionsData || !selectedFacility) return [];
        let all: Position[];
        if (selectedFacility === positionsData.id) {
            // Parent facility selected — show only its direct positions
            all = [...(positionsData.positions || [])];
        } else {
            const facility = positionsData.childFacilities?.find(f => f.id === selectedFacility);
            if (!facility) return [];
            all = collectPositions(facility);
        }
        if (!search.trim()) return all;
        const q = search.toLowerCase();
        return all.filter(p =>
            p.pos?.toLowerCase().includes(q) ||
            p.cs?.toLowerCase().includes(q) ||
            p.rn?.toLowerCase().includes(q)
        );
    }, [positionsData, selectedFacility, search]);

    const onSubmit = () => {
        if (!selectedPosition) return;
        updateSelectedPosition([selectedPosition]);
        setModal(false);
        // Reset state for next open
        setSelectedFacility(null);
        setSearch('');
        setSelectedPosition(null);
    };

    const onCancel = () => {
        setModal(false);
        setSelectedFacility(null);
        setSearch('');
        setSelectedPosition(null);
    };

    /** Connect with a VATSIM access token (exchanges for WS token automatically) */
    const handleVacsConnect = useCallback(async () => {
        if (!vacsToken.trim()) return;
        setVacsLoginError(null);
        const positionId = callsign || undefined;
        await connectVacsWithVatsimToken(vacsToken.trim(), positionId, false);
        setVacsToken('');
        setTimeout(() => setHasSavedToken(!!loadVacsCredentials()), 3000);
    }, [vacsToken, callsign, connectVacsWithVatsimToken]);

    /** Clear saved VACS token from localStorage */
    const handleClearSavedToken = useCallback(() => {
        clearVacsCredentials();
        setHasSavedToken(false);
    }, []);

    const handleVvscsConnect = useCallback(() => {
        if (!vvscsFacility.trim() || !vvscsPosition.trim()) return;
        connectVvscs(vvscsFacility.trim().toUpperCase(), vvscsPosition.trim());
        // Don't clear inputs so user can see what they connected as
    }, [vvscsFacility, vvscsPosition, connectVvscs]);

    /** Login with VATSIM for vNAS (sweatbox) via OAuth2 popup */
    const handleVnasLogin = useCallback(async () => {
        setVnasLoggingIn(true);
        setVnasLoginError(null);
        try {
            const res = await fetch('/api/vnas/auth/login');
            const data = await res.json();

            if (!data.url) {
                const msg = data.error || 'Failed to start VATSIM login for vNAS';
                setVnasLoginError(msg);
                setVnasLoggingIn(false);
                return;
            }

            const popup = window.open(
                data.url,
                'vnas-login',
                'width=600,height=700,menubar=no,toolbar=no,location=no,status=no'
            );
            vnasPopupRef.current = popup;

            const checkClosed = setInterval(() => {
                if (popup?.closed) {
                    clearInterval(checkClosed);
                    setVnasLoggingIn(false);
                    vnasPopupRef.current = null;
                }
            }, 500);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setVnasLoginError(msg);
            setVnasLoggingIn(false);
        }
    }, []);

    /** Handle vNAS environment change */
    const handleVnasEnvChange = useCallback((envName: string) => {
        if (!vnasConfig) return;
        if (!envName) {
            vnasSelectEnvironment(null);
            return;
        }
        const env = vnasConfig.environments.find(e => e.name === envName);
        if (env) {
            vnasSelectEnvironment(env);
        }
    }, [vnasConfig, vnasSelectEnvironment]);

    /** Get detected position info from vNAS session */
    const vnasDetectedPosition = useMemo(() => {
        return vnasStore.getDetectedPosition();
    }, [vnasSession]);

    /** Apply vNAS-detected position to the position selector */
    const handleApplyVnasPosition = useCallback(() => {
        if (!vnasDetectedPosition || !positionsData) return;
        // Search all facilities for a position matching the detected callsign
        const findPosition = (fac: Facility): Position | null => {
            const pos = fac.positions?.find(p => p.cs === vnasDetectedPosition.callsign);
            if (pos) return pos;
            for (const child of fac.childFacilities || []) {
                const found = findPosition(child);
                if (found) return found;
            }
            return null;
        };
        const pos = findPosition(positionsData);
        if (pos) {
            updateSelectedPosition([pos]);
            setModal(false);
        }
    }, [vnasDetectedPosition, positionsData, updateSelectedPosition, setModal]);

    return (
        <Modal
            title="Select Position"
            open={open}
            onCancel={onCancel}
            onOk={onSubmit}
            okButtonProps={{ disabled: !selectedPosition }}
            okText="Connect"
        >
            {/* vNAS / Sweatbox Environment */}
            <div style={{ marginBottom: 12, borderBottom: '1px solid #d9d9d9', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>Server Environment</span>
                    {isSweatbox && (
                        <span style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: '#fa8c16',
                            color: '#fff',
                        }}>
                            SWEATBOX
                        </span>
                    )}
                </div>
                <Select
                    placeholder="Select environment..."
                    value={vnasEnvironment?.name || undefined}
                    onChange={handleVnasEnvChange}
                    allowClear
                    style={{ width: '100%', marginBottom: 8 }}
                    options={(vnasConfig?.environments || [])
                        .filter(e => !e.isDisabled)
                        .map(e => ({
                            value: e.name,
                            label: `${e.name}${e.isSweatbox ? ' (Sweatbox)' : ''}${e.isPrimary ? ' ★' : ''}`,
                        }))}
                    loading={!vnasConfig}
                    notFoundContent={!vnasConfig ? 'Loading environments...' : 'No environments available'}
                />
                {vnasEnvironment && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{
                                fontSize: 12,
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: vnasHubConnected ? '#52c41a' : '#d9d9d9',
                                color: vnasHubConnected ? '#fff' : '#666',
                            }}>
                                {vnasStatus}
                            </span>
                        </div>
                        {vnasError && (
                            <div style={{ fontSize: 12, color: '#ff4d4f', marginBottom: 4 }}>{vnasError}</div>
                        )}
                        {vnasLoginError && (
                            <div style={{ fontSize: 12, color: '#ff4d4f', marginBottom: 4 }}>{vnasLoginError}</div>
                        )}
                        {vnasHubConnected ? (
                            <div>
                                {vnasDetectedPosition ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 12, color: '#52c41a' }}>
                                            Detected: {vnasDetectedPosition.callsign} ({vnasDetectedPosition.name}) — {vnasDetectedPosition.artccId}
                                        </span>
                                        <Button size="small" type="primary" onClick={handleApplyVnasPosition}>
                                            Apply
                                        </Button>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                                        Waiting for session... (connect in vATIS/EuroScope first)
                                    </div>
                                )}
                                <Button size="small" danger onClick={() => vnasDisconnect()}>
                                    Disconnect vNAS
                                </Button>
                            </div>
                        ) : (
                            <Button
                                type="primary"
                                size="small"
                                loading={vnasLoggingIn}
                                onClick={handleVnasLogin}
                            >
                                {vnasLoggingIn ? 'Waiting for VATSIM...' : 'Login with VATSIM (vNAS)'}
                            </Button>
                        )}
                    </>
                )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <Select
                    placeholder="Facility"
                    value={selectedFacility}
                    onChange={(val) => {
                        setSelectedFacility(val);
                        setSelectedPosition(null);
                    }}
                    options={facilities}
                    style={{ width: 160 }}
                    showSearch
                    filterOption={(input, option) =>
                        (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                />
                <Input
                    placeholder="Search positions..."
                    value={search}
                    onChange={e => {
                        setSearch(e.target.value);
                        setSelectedPosition(null);
                    }}
                    allowClear
                    disabled={!selectedFacility}
                    style={{ flex: 1 }}
                />
            </div>

            <div style={{
                maxHeight: 320,
                overflowY: 'auto',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
            }}>
                {!selectedFacility ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                        Select a facility to view positions
                    </div>
                ) : filteredPositions.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                        No positions found
                    </div>
                ) : (
                    filteredPositions.map((pos) => {
                        const isSelected = selectedPosition?.cs === pos.cs;
                        return (
                            <div
                                key={pos.cs}
                                onClick={() => setSelectedPosition(pos)}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    background: isSelected ? '#1677ff' : 'transparent',
                                    color: isSelected ? '#fff' : 'inherit',
                                    borderBottom: '1px solid #f0f0f0',
                                }}
                            >
                                <div style={{ fontWeight: 500 }}>{pos.pos}</div>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>
                                    {pos.cs}{pos.freq ? ` — ${formatFreq(pos.freq)}` : ''}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* VACS WebRTC Connection — hidden in sweatbox mode */}
            {!isSweatbox && (
            <div style={{ marginTop: 16, borderTop: '1px solid #d9d9d9', paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>VACS (WebRTC)</span>
                    <span style={{
                        fontSize: 12,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: vacsConnected ? '#52c41a' : '#d9d9d9',
                        color: vacsConnected ? '#fff' : '#666',
                    }}>
                        {vacsStatus}
                    </span>
                </div>
                {vacsError && (
                    <div style={{ fontSize: 12, color: '#ff4d4f', marginBottom: 8 }}>
                        {vacsError}
                    </div>
                )}
                {vacsConnected ? (
                    <Button size="small" danger onClick={disconnectVacs}>
                        Disconnect
                    </Button>
                ) : (
                    <>
                        {hasSavedToken && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <span style={{ fontSize: 12, color: '#52c41a' }}>
                                    Token saved — will auto-connect when position has vacs: lines
                                </span>
                                <Button size="small" onClick={handleClearSavedToken} style={{ marginLeft: 'auto' }}>
                                    Forget
                                </Button>
                            </div>
                        )}
                        {vacsLoginError && (
                            <div style={{ fontSize: 12, color: '#ff4d4f', marginBottom: 8 }}>
                                {vacsLoginError}
                            </div>
                        )}
                        <Button
                            type="primary"
                            size="small"
                            loading={vacsLoggingIn}
                            onClick={handleVatsimLogin}
                            style={{ marginBottom: 8 }}
                        >
                            {vacsLoggingIn ? 'Waiting for VATSIM...' : 'Login with VATSIM'}
                        </Button>
                        <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
                            Or paste a VATSIM access token:
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Input
                                size="small"
                                placeholder="Paste VATSIM access token"
                                value={vacsToken}
                                onChange={e => setVacsToken(e.target.value)}
                                onPressEnter={handleVacsConnect}
                                style={{ flex: 1 }}
                            />
                            <Button
                                size="small"
                                type="primary"
                                disabled={!vacsToken.trim()}
                                onClick={handleVacsConnect}
                            >
                                Connect
                            </Button>
                        </div>
                    </>
                )}
            </div>
            )}

            {/* v-VSCS WebRTC Connection — hidden in sweatbox mode */}
            {!isSweatbox && (
            <div style={{ marginTop: 16, borderTop: '1px solid #d9d9d9', paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>v-VSCS (WebRTC)</span>
                    <span style={{
                        fontSize: 12,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: vvscsConnected ? '#52c41a' : '#d9d9d9',
                        color: vvscsConnected ? '#fff' : '#666',
                    }}>
                        {vvscsStatus}
                    </span>
                </div>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>
                    Server: {VVSCS_SERVER_URL}
                </div>
                {vvscsError && (
                    <div style={{ fontSize: 12, color: '#ff4d4f', marginBottom: 8 }}>
                        {vvscsError}
                    </div>
                )}
                {vvscsConnected ? (
                    <Button size="small" danger onClick={disconnectVvscs}>
                        Disconnect
                    </Button>
                ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Input
                            size="small"
                            placeholder="Facility (e.g. ZOA)"
                            value={vvscsFacility}
                            onChange={e => setVvscsFacility(e.target.value)}
                            style={{ width: 110 }}
                        />
                        <Input
                            size="small"
                            placeholder="Position (e.g. R62)"
                            value={vvscsPosition}
                            onChange={e => setVvscsPosition(e.target.value)}
                            onPressEnter={handleVvscsConnect}
                            style={{ flex: 1 }}
                        />
                        <Button
                            size="small"
                            type="primary"
                            disabled={!vvscsFacility.trim() || !vvscsPosition.trim()}
                            onClick={handleVvscsConnect}
                        >
                            Connect
                        </Button>
                    </div>
                )}
            </div>
            )}
        </Modal>
    );
}

export default SettingModal;
