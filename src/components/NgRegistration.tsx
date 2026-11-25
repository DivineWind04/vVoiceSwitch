'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Select, Space, Tag } from 'antd';
import { useCoreStore } from '~/model';
import type { NgPositionRef } from '~/lib/afv-ng';

const key = (position: NgPositionRef) => `${position.facilityId}/${position.positionId}`;

export default function NgRegistration() {
  const ll = useCoreStore(state => state.ngState);
  const positions = useCoreStore(state => state.ngPositions);
  const request = useCoreStore(state => state.ngRequest);
  const error = useCoreStore(state => state.ngError);
  const [open, setOpen] = useState(false);
  const [artcc, setArtcc] = useState('');
  const [main, setMain] = useState<string>();
  const [assumed, setAssumed] = useState<string[]>([]);
  const [profile, setProfile] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [callsOpen, setCallsOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [dialCode, setDialCode] = useState('');

  useEffect(() => {
    if (positions) {
      setArtcc(positions.artccId);
      setMain(current => current || (positions.suggestedMain ? key(positions.suggestedMain) : undefined));
      setAssumed(current => current.length ? current : (positions.suggestedAssumed || []).map(key));
    }
  }, [positions]);

  async function load() {
    setBusy(true);
    const result = await request({ type: 'get_positions', ...(artcc.trim() ? { artccId: artcc.trim().toUpperCase() } : {}) });
    setLocalError(result.ok ? '' : result.error?.message || 'Unable to load positions');
    setBusy(false);
  }

  async function register() {
    const selected = positions?.positions.find(position => key(position) === main);
    if (!selected) return;
    const refs = (positions?.positions || []).filter(position => assumed.includes(key(position)) && key(position) !== main)
      .map(({ facilityId, positionId }) => ({ facilityId, positionId }));
    setBusy(true);
    const result = await request({ type: 'register', main: { facilityId: selected.facilityId, positionId: selected.positionId }, assumed: refs, ...(profile ? { profileId: profile } : {}) });
    setLocalError(result.ok ? '' : result.error?.message || 'Registration failed');
    setBusy(false);
    if (result.ok) setOpen(false);
  }

  async function act(message: Record<string, unknown>) {
    setBusy(true);
    const result = await request(message);
    setLocalError(result.ok ? '' : result.error?.message || 'Request failed');
    setBusy(false);
    return result.ok;
  }

  async function callNumber() {
    if (!/^\d{4}$/.test(dialNumber)) {
      setLocalError('Enter a four-digit dial number.');
      return;
    }
    const existing = [...(ll?.buttons.flatMap(button => button.calls) || []), ...(ll?.ia || [])];
    const releasable = [...new Map(existing.filter(call => call.canRelease && ['connected', 'conference', 'broadcast_out', 'override_out', 'setup_out', 'ringing_out'].includes(call.state)).map(call => [call.callId, call])).values()];
    setBusy(true);
    const results = await Promise.all(releasable.map(call => request({ type: 'release', callId: call.callId })));
    const failed = results.find(result => !result.ok);
    const result = failed || await request({ type: 'call', dialNumber });
    setLocalError(result.ok ? '' : result.error?.message || 'Call failed');
    setBusy(false);
    if (result.ok) setDialNumber('');
  }

  const selected = positions?.positions.find(position => key(position) === main);
  const held = new Set((ll?.session?.positions || []).map(key));
  const options = (positions?.positions || []).map(position => ({
    value: key(position),
    label: `${position.facilityId} ${position.positionId} ${position.positionName}${position.occupied && !held.has(key(position)) ? ' (occupied)' : ''}`,
    disabled: position.occupied && !held.has(key(position)),
  }));
  const calls = [...new Map([...(ll?.buttons.flatMap(button => button.calls) || []), ...(ll?.ia || [])].map(call => [call.callId, call])).values()];

  return (
    <div style={{ padding: 8 }}>
      <Space wrap>
        <Tag color={ll?.afv.connected ? 'green' : 'red'}>AFV: {ll?.afv.connected ? 'connected' : 'disconnected'}</Tag>
        {ll && <Tag color={ll.server === 'connected' ? 'green' : 'orange'}>Landline: {ll.server}</Tag>}
        {ll?.session && <Tag>{key(ll.session.mainPosition)}</Tag>}
        {ll?.afv.connected && <Button onClick={() => { setOpen(true); if (!positions) void load(); }}>Positions</Button>}
        {ll?.session && <Button onClick={() => void request({ type: 'deregister' })}>Logout</Button>}
        {ll?.session && <Button onClick={() => { setLocalError(''); setCallsOpen(true); }}>Calls ({calls.length})</Button>}
        {ll?.session && <Select style={{ minWidth: 180 }} value={ll.selectedProfileId || undefined}
          options={(ll.session.positions.find(position => key(position) === key(ll.session!.mainPosition))?.profiles || []).map(item => ({ value: item.profileId, label: item.profileName || item.profileId }))}
          onChange={profileId => void request({ type: 'select_profile', profileId })} />}
      </Space>
      {(error || ll?.sessionEnd) && <Alert type="warning" showIcon message={error || ll?.sessionEnd?.error?.message || ll?.sessionEnd?.reason} />}
      <Modal open={open} title="Register positions" onCancel={() => setOpen(false)} onOk={() => void register()} okText="Register" confirmLoading={busy} okButtonProps={{ disabled: !main }}>
        {localError && <Alert type="error" showIcon message={localError} />}
        <Space.Compact style={{ width: '100%', margin: '12px 0' }}>
          <Input value={artcc} onChange={event => setArtcc(event.target.value)} placeholder="ARTCC ID" onPressEnter={() => void load()} />
          <Button loading={busy} onClick={() => void load()}>Load</Button>
        </Space.Compact>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select showSearch style={{ width: '100%' }} placeholder="Main position" options={options} value={main} optionFilterProp="label" onChange={value => { setMain(value); setProfile(undefined); setAssumed(current => current.filter(item => item !== value)); }} />
          <Select mode="multiple" style={{ width: '100%' }} placeholder="Assumed positions" options={options.filter(option => option.value !== main)} value={assumed} optionFilterProp="label" onChange={setAssumed} />
          <Select style={{ width: '100%' }} placeholder="Profile" options={(selected?.profiles || []).map(item => ({ value: item.profileId, label: item.profileName || item.profileId }))} value={profile} onChange={setProfile} allowClear />
        </Space>
      </Modal>
      <Modal open={callsOpen} title="Calls" onCancel={() => setCallsOpen(false)} footer={null}>
        {localError && <Alert type="error" showIcon message={localError} />}
        <Space.Compact style={{ width: '100%', margin: '12px 0' }}>
          <Input aria-label="IA dial number" inputMode="numeric" maxLength={4} value={dialNumber} onChange={event => setDialNumber(event.target.value)} onPressEnter={() => void callNumber()} placeholder="Dial number" />
          <Button type="primary" disabled={ll?.server !== 'connected'} loading={busy} onClick={() => void callNumber()}>Call</Button>
        </Space.Compact>
        <Space direction="vertical" style={{ width: '100%' }}>
          {calls.map(call => <div key={call.callId}>
            <Space wrap>
              <span>{call.peer?.positionName || call.dialNumber} ({call.kind}, {call.state})</span>
              {call.state === 'ringing_in' && <Button disabled={busy} onClick={() => void act({ type: 'answer', callId: call.callId })}>Answer</Button>}
              {call.state === 'ringing_in' && <Button disabled={busy} onClick={() => void act({ type: 'reject', callId: call.callId })}>Reject</Button>}
              {['connected', 'conference', 'held'].includes(call.state) && <Button disabled={busy} onClick={() => void act({ type: 'hold', callId: call.callId, held: call.state !== 'held' })}>{call.state === 'held' ? 'Resume' : 'Hold'}</Button>}
              {call.state !== 'ringing_in' && call.canRelease && <Button disabled={busy} onClick={() => void act({ type: 'release', callId: call.callId })}>Release</Button>}
            </Space>
            {call.kind === 'IP_DIAL' && ['connected', 'broadcast_out'].includes(call.state) && <Space.Compact style={{ width: '100%', marginTop: 4 }}>
              <Input aria-label="Dial line code" inputMode="numeric" value={dialCode} onChange={event => setDialCode(event.target.value)} placeholder="Dial code" />
              <Button disabled={busy} onClick={() => void act({ type: 'dial', callId: call.callId, ...(dialCode ? { dialCode } : {}) })}>Ring</Button>
            </Space.Compact>}
          </div>)}
        </Space>
      </Modal>
    </div>
  );
}