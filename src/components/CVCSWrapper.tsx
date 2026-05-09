"use client";

import React, { useMemo, useState } from 'react';
import { useCoreStore } from '../model';
import Keypad from '../app/_components/ground_ground/Keypad';

type ThemeMode = 'day' | 'night';

interface CvcsTheme {
  shell: string;
  panel: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  tx: string;
  rx: string;
  gridSlot: string;
  danger: string;
  topBar: string;
}

const THEMES: Record<ThemeMode, CvcsTheme> = {
  day: {
    shell: 'linear-gradient(150deg, #dae6f2 0%, #c7d7e8 45%, #bdcee1 100%)',
    panel: 'linear-gradient(180deg, #f6f9fc 0%, #e8eef5 100%)',
    card: '#fdfefe',
    border: '#9eb2c8',
    text: '#1f2f44',
    textMuted: '#5a6d86',
    accent: '#2e7dc1',
    tx: '#1982d8',
    rx: '#1e5f9d',
    gridSlot: '#d5e0eb',
    danger: '#ef3a33',
    topBar: '#f1493f'
  },
  night: {
    shell: 'linear-gradient(150deg, #101722 0%, #0d1420 50%, #0a0f18 100%)',
    panel: 'linear-gradient(180deg, #1e2735 0%, #131c29 100%)',
    card: '#1b2430',
    border: '#3d4f67',
    text: '#d7e6ff',
    textMuted: '#8ca3c0',
    accent: '#5ba1df',
    tx: '#45a4ff',
    rx: '#2f73c4',
    gridSlot: '#223248',
    danger: '#ed4943',
    topBar: '#e14f42'
  }
};

const FREQS_PER_PAGE = 6;
const GG_PER_PAGE = 16;

export default function CVCSWrapper() {
  const [mode, setMode] = useState<ThemeMode>('night');
  const [agPage, setAgPage] = useState(1);
  const [ggPage, setGgPage] = useState(1);
  const [showKeypad, setShowKeypad] = useState(false);
  const [dialLineInfo, setDialLineInfo] = useState<{ trunkName: string; lineType: number } | null>(null);

  const theme = THEMES[mode];

  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const ptt = useCoreStore((s: any) => s.ptt);
  const ag_status = useCoreStore((s: any) => s.ag_status || []);
  const gg_status = useCoreStore((s: any) => s.gg_status || []);
  const vacsHandleButtonPress = useCoreStore((s: any) => s.vacsHandleButtonPress);
  const vvscsHandleButtonPress = useCoreStore((s: any) => s.vvscsHandleButtonPress);
  const landlineHandleButtonPress = useCoreStore((s: any) => s.landlineHandleButtonPress);
  const setActiveDialLine = useCoreStore((s: any) => s.setActiveDialLine);
  const cancelDialKeypad = useCoreStore((s: any) => s.cancelDialKeypad);
  const showLineTooltips = useCoreStore((s: any) => s.showLineTooltips);

  const agSlice = useMemo(() => {
    const start = (agPage - 1) * FREQS_PER_PAGE;
    const slice = ag_status.slice(start, start + FREQS_PER_PAGE);
    if (slice.length < FREQS_PER_PAGE) {
      return [...slice, ...new Array(FREQS_PER_PAGE - slice.length).fill(undefined)];
    }
    return slice;
  }, [ag_status, agPage]);

  const ggSlice = useMemo(() => {
    const start = (ggPage - 1) * GG_PER_PAGE;
    const slice = gg_status.slice(start, start + GG_PER_PAGE);
    if (slice.length < GG_PER_PAGE) {
      return [...slice, ...new Array(GG_PER_PAGE - slice.length).fill(undefined)];
    }
    return slice;
  }, [gg_status, ggPage]);

  const formatFreq = (freq: number) => {
    if (!freq) return '--';
    const val = freq / 1_000_000;
    if (val % 1 === 0) return val.toFixed(1);
    return val.toString().replace(/0+$/, '').replace(/\.$/, '');
  };

  const buildTooltip = (data: any, typeLabel: string) => {
    if (!showLineTooltips) return undefined;
    const callId = data?.call?.substring(3) || '';
    const displayName = data?.trunkName || data?.call_name || callId || 'UNKNOWN';
    return `${typeLabel} - ${displayName}`;
  };

  const openDialKeypad = (trunkName: string, lineType: number) => {
    const info = { trunkName, lineType };
    setDialLineInfo(info);
    setShowKeypad(true);
    setActiveDialLine(info);
  };

  const closeDialKeypad = () => {
    setShowKeypad(false);
    setDialLineInfo(null);
    cancelDialKeypad();
  };

  const handleAgToggle = (item: any, modeType: 'tx' | 'rx') => {
    if (!item?.freq) return;
    if (modeType === 'tx') {
      sendMsg({ type: 'tx', cmd1: item.freq.toString(), dbl1: !item.t });
      return;
    }
    sendMsg({ type: 'rx', cmd1: item.freq.toString(), dbl1: !item.r });
  };

  const handleGgPress = (data: any) => {
    if (!data) return;

    if (data.isVvscs && data.vvscsLineId) {
      vvscsHandleButtonPress(data.vvscsLineId, data.status);
      return;
    }

    if (data.isLandline && data.landlineCallId) {
      const isDialLine = data.lineType === 3;
      const idleStates = ['off', 'idle', ''];
      if (isDialLine && idleStates.includes(data.status || '')) {
        const trunkName = data.trunkName || data.call_name || data.call || '';
        openDialKeypad(trunkName, 3);
        return;
      }
      landlineHandleButtonPress(data.landlineCallId, data.status);
      return;
    }

    if (data.isVacs && data.vacsCallId) {
      vacsHandleButtonPress(data.vacsCallId, data.status);
      return;
    }

    const callType = data.call?.substring(0, 2);
    const callId = data.call?.substring(3);
    const lineType = data.lineType ?? 2;
    const isDialLine = lineType === 3;

    if (!callId) return;

    if (callType === 'SO') {
      if (data.status === 'idle' || data.status === 'online' || data.status === 'chime') {
        sendMsg({ type: 'call', cmd1: callId, dbl1: 2 });
        return;
      }
      if (data.status === 'ok' || data.status === 'active') {
        sendMsg({ type: 'stop', cmd1: callId, dbl1: 1 });
      }
      return;
    }

    if (isDialLine && !['ok', 'active', 'ringing', 'chime', 'busy', 'hold'].includes(data.status || '')) {
      const trunkName = data.trunkName || data.call_name || data.call || '';
      openDialKeypad(trunkName, 3);
      return;
    }

    if (data.status === 'off' || data.status === '' || data.status === 'idle') {
      sendMsg({ type: 'call', cmd1: callId, dbl1: lineType });
      return;
    }

    if (data.status === 'ok' || data.status === 'active') {
      sendMsg({ type: 'stop', cmd1: callId, dbl1: isDialLine ? 1 : lineType });
      return;
    }

    if (data.status === 'chime') {
      sendMsg({ type: 'pick_up', cmd1: callId, dbl1: 1 });
    }
  };

  const handleReleaseAll = () => {
    const activeCalls = (gg_status || []).filter((call: any) => call && ['ok', 'active', 'ringing', 'chime'].includes(call.status));

    for (const call of activeCalls) {
      if (call.isLandline && call.landlineCallId) {
        landlineHandleButtonPress(call.landlineCallId, call.status);
      } else if (call.isVvscs && call.vvscsLineId) {
        vvscsHandleButtonPress(call.vvscsLineId, call.status);
      } else if (call.isVacs && call.vacsCallId) {
        vacsHandleButtonPress(call.vacsCallId, call.status);
      } else {
        const callId = call.call?.substring(3) || '';
        const lineType = call.lineType ?? 2;
        if (callId) sendMsg({ type: 'stop', cmd1: callId, dbl1: lineType });
      }
    }

    closeDialKeypad();
  };

  const ggStateStyle = (status: string | undefined) => {
    if (status === 'busy') return { backgroundColor: '#7b1e21', borderColor: '#bb2f34' };
    if (status === 'chime' || status === 'ringing') return { backgroundColor: '#1e4f87', borderColor: '#5fa4e8' };
    if (status === 'ok' || status === 'active') return { backgroundColor: '#1b5f43', borderColor: '#46cc95' };
    if (status === 'hold') return { backgroundColor: '#70520f', borderColor: '#ddb03f' };
    return { backgroundColor: theme.gridSlot, borderColor: theme.border };
  };

  const agPageCount = Math.max(1, Math.ceil(ag_status.length / FREQS_PER_PAGE));
  const ggPageCount = Math.max(1, Math.ceil(gg_status.length / GG_PER_PAGE));

  return (
    <div
      className="w-full min-h-screen flex items-center justify-center p-4"
      style={{
        background: theme.shell,
        fontFamily: "'Rajdhani', 'Segoe UI', sans-serif"
      }}
    >
      <div
        className="w-full max-w-[1260px] rounded-xl border shadow-2xl"
        style={{
          background: theme.panel,
          borderColor: theme.border,
          color: theme.text,
          boxShadow: mode === 'day' ? '0 30px 60px rgba(18, 41, 66, 0.22)' : '0 30px 70px rgba(0, 0, 0, 0.6)'
        }}
      >
        <div className="grid grid-cols-12 gap-2 p-2 border-b" style={{ borderColor: theme.border }}>
          <div className="col-span-5 rounded-sm px-3 py-1 text-sm font-semibold tracking-wider" style={{ backgroundColor: theme.card, color: theme.textMuted }}>
            SUPERVISOR CONSOLE
          </div>
          <div className="col-span-4 rounded-sm px-3 py-1 text-xs font-semibold" style={{ backgroundColor: theme.topBar, color: '#f7f7f7' }}>
            UNATTENDED CWP - Headset not connected
          </div>
          <div className="col-span-3 flex items-center justify-end gap-2">
            <button
              onClick={() => setMode((prev) => (prev === 'day' ? 'night' : 'day'))}
              className="rounded-sm border px-3 py-1 text-xs font-semibold tracking-wider"
              style={{
                borderColor: theme.border,
                backgroundColor: theme.card,
                color: theme.text
              }}
            >
              DAY/NIGHT: {mode === 'day' ? 'DAY' : 'NIGHT'}
            </button>
            <div className="text-xs" style={{ color: theme.textMuted }}>CVCS</div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2 p-2">
          <div className="col-span-2 grid gap-2">
            {['HS/LS', 'A/G SPEAKER', 'G/G SPEAKER', 'AUDIO'].map((label) => (
              <div
                key={label}
                className="h-14 rounded-sm border flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: theme.card, borderColor: theme.border }}
              >
                {label}
              </div>
            ))}
            <button
              onClick={handleReleaseAll}
              className="h-14 rounded-sm border text-xs font-bold tracking-wide"
              style={{ backgroundColor: theme.card, borderColor: theme.border }}
            >
              RELIEF / END
            </button>
            <button
              onClick={() => setGgPage((p) => (p > 1 ? p - 1 : 1))}
              className="h-12 rounded-sm border text-xs font-semibold"
              style={{ backgroundColor: theme.card, borderColor: theme.border }}
            >
              GG PAGE PREV
            </button>
            <button
              onClick={() => setGgPage((p) => (p < ggPageCount ? p + 1 : p))}
              className="h-12 rounded-sm border text-xs font-semibold"
              style={{ backgroundColor: theme.card, borderColor: theme.border }}
            >
              GG PAGE NEXT
            </button>
          </div>

          <div className="col-span-5 grid gap-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {agSlice.map((item: any, idx: number) => (
                <div
                  key={`ag-${idx}`}
                  className="rounded-sm border p-2"
                  style={{
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    opacity: item ? 1 : 0.35
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[11px] font-semibold" style={{ color: theme.textMuted }}>
                      {item?.name || `A/G ${idx + 1}`}
                    </div>
                    <div className="text-sm font-bold">{item?.freq ? formatFreq(item.freq) : '--'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={!item}
                      onClick={() => handleAgToggle(item, 'rx')}
                      className="h-9 rounded-sm border text-xs font-semibold"
                      style={{
                        backgroundColor: item?.r ? theme.rx : theme.gridSlot,
                        borderColor: item?.r ? '#74b8ff' : theme.border,
                        color: item?.r ? '#f0f8ff' : theme.text
                      }}
                    >
                      RX
                    </button>
                    <button
                      disabled={!item}
                      onClick={() => handleAgToggle(item, 'tx')}
                      className="h-9 rounded-sm border text-xs font-semibold"
                      style={{
                        backgroundColor: item?.t ? theme.tx : theme.gridSlot,
                        borderColor: item?.t ? '#89c9ff' : theme.border,
                        color: item?.t ? '#f0f8ff' : theme.text
                      }}
                    >
                      TX
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setAgPage((p) => (p > 1 ? p - 1 : 1))}
                className="rounded-sm border px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: theme.card, borderColor: theme.border }}
              >
                A/G PREV
              </button>
              <div className="text-xs" style={{ color: theme.textMuted }}>
                A/G PAGE {agPage} / {agPageCount}
              </div>
              <button
                onClick={() => setAgPage((p) => (p < agPageCount ? p + 1 : p))}
                className="rounded-sm border px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: theme.card, borderColor: theme.border }}
              >
                A/G NEXT
              </button>
            </div>
          </div>

          <div className="col-span-5 grid gap-2">
            <div className="grid grid-cols-4 gap-2">
              {ggSlice.map((item: any, idx: number) => {
                const callName = item?.call_name || item?.call || `G/G ${idx + 1}`;
                const callParts = callName.includes(',') ? callName.split(',').map((p: string) => p.trim()) : [callName];
                const lineType = item?.lineType;
                const typeLabel = lineType === 3 ? 'DIAL' : lineType === 0 ? 'OVERRIDE' : 'RING';

                return (
                  <button
                    key={`gg-${idx}`}
                    title={buildTooltip(item, typeLabel)}
                    onClick={() => handleGgPress(item)}
                    className="h-20 rounded-sm border p-2 text-left"
                    style={{
                      ...ggStateStyle(item?.status),
                      color: item ? theme.text : theme.textMuted,
                      opacity: item ? 1 : 0.35
                    }}
                    disabled={!item || item.status === 'pending' || item.status === 'terminate' || item.status === 'overridden'}
                  >
                    <div className="text-[11px] leading-tight font-semibold truncate">{callParts[0] || ''}</div>
                    <div className="text-[10px] leading-tight truncate" style={{ color: theme.textMuted }}>{callParts[1] || ''}</div>
                    <div className="mt-1 text-[10px] font-bold tracking-wider" style={{ color: theme.accent }}>
                      {(item?.status || 'OFF').toUpperCase()}
                      {item?.status === 'active' || (item?.status === 'ok' && ptt) ? ' TX' : ''}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={`gg-page-${n}`}
                  onClick={() => setGgPage(n)}
                  className="h-10 rounded-sm border text-xs font-semibold"
                  style={{
                    backgroundColor: ggPage === n ? theme.accent : theme.card,
                    borderColor: theme.border,
                    color: ggPage === n ? '#f4f9ff' : theme.text
                  }}
                >
                  G/G {n}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div
                className="h-12 rounded-sm border flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: theme.card, borderColor: theme.border }}
              >
                MON
              </div>
              <div
                className="h-12 rounded-sm border flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: theme.danger, borderColor: '#ff847e', color: '#fff' }}
              >
                CWP PRIORITY
              </div>
            </div>
          </div>
        </div>

        {showKeypad && (
          <div className="border-t p-3" style={{ borderColor: theme.border }}>
            <Keypad dialLineInfo={dialLineInfo} onClose={closeDialKeypad} />
          </div>
        )}
      </div>
    </div>
  );
}
