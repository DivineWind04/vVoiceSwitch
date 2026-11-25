import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ngButtonId, ngButtonsToLegacy, ngChannelsToLegacy, ngIaDialNumber } from './afv-ng.ts';

const button = {
  elementType: 'GG', x: 1, y: 2, lineType: 'IC_DIAL', dialNumber: '0003',
  text: 'D14', func: null, disabled: false, state: 'idle', tx: false, rx: false,
  callId: null, calls: [],
};

test('preserves button coordinates and direct line state', () => {
  const [entry] = ngButtonsToLegacy([button]);
  assert.equal(ngButtonId(button), 'button-1:2');
  assert.equal(entry?.call, 'DL_button-1:2');
  assert.equal(entry?.status, 'off');
  assert.equal(entry?.lineType, 1);
});

test('maps call states, shout lines, and placeholders', () => {
  const [ringing, shout, empty] = ngButtonsToLegacy([
    { ...button, state: 'ringing_in' },
    { ...button, x: 2, lineType: 'SHOUT', state: 'broadcast_in' },
    { ...button, elementType: 'EMPTY' },
  ]);
  assert.equal(ringing?.status, 'chime');
  assert.equal(shout?.call, 'SO_button-2:2');
  assert.equal(shout?.status, 'online');
  assert.equal(empty?.isPlaceholder, true);
});

test('maps air-ground controls and receiving activity', () => {
  assert.deepEqual(ngChannelsToLegacy([{ freq: 134550000, tx: true, rx: true, headset: false, rxActive: true, name: 'RCAG' }]),
    [{ call: 'A/G', freq: 134550000, t: true, r: true, h: false, talking: true, name: 'RCAG' }]);
});

test('preserves the IA access digit for both keypad formats', () => {
  assert.equal(ngIaDialNumber('003', 1), '1003');
  assert.equal(ngIaDialNumber('0003', 0), '0003');
  assert.equal(ngIaDialNumber('03', 1), null);
  assert.equal(ngIaDialNumber('003', 9), null);
});

test('places profile buttons by their coordinates and preserves function keys', () => {
  const result = ngButtonsToLegacy([
    { ...button, x: 2, y: 1 },
    { ...button, x: 0, y: 0, elementType: 'FUNC', func: 'HOLD', text: '' },
  ], 3);
  assert.equal(result.length, 6);
  assert.equal(result[0].call_name, 'HOLD');
  assert.equal(result[1].isPlaceholder, true);
  assert.equal(result[5].call, 'DL_button-2:1');
});