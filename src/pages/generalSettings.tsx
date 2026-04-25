import { useState, useEffect, useCallback } from 'react';
import Modal from 'antd/es/modal';
import Slider from 'antd/es/slider';
import Button from 'antd/es/button';
import { landlineSettingsStore, type LandlineSettings } from '../lib/landline/settingsStore';

interface GeneralSettingsProps {
  open: boolean;
  setModal: (open: boolean) => void;
}

export default function GeneralSettingsModal({ open, setModal }: GeneralSettingsProps) {
  const [settings, setSettings] = useState<LandlineSettings>(landlineSettingsStore.getSettings());
  const [settingPtt, setSettingPtt] = useState<1 | 2 | null>(null);

  // Subscribe to settings changes from the store
  useEffect(() => {
    const unsub = landlineSettingsStore.onSettingsChange((s) => {
      setSettings(s);
      // If we were capturing and store cleared capture, sync
      if (!landlineSettingsStore.isSettingPtt) {
        setSettingPtt(null);
      }
    });
    return unsub;
  }, []);

  // Sync settings when modal opens
  useEffect(() => {
    if (open) {
      setSettings(landlineSettingsStore.getSettings());
    } else {
      // Cancel any in-progress PTT capture when modal closes
      if (settingPtt) {
        landlineSettingsStore.cancelSettingPtt();
        setSettingPtt(null);
      }
    }
  }, [open]);

  const handleSetPtt = useCallback((slot: 1 | 2) => {
    setSettingPtt(slot);
    landlineSettingsStore.startSettingPtt(slot);
  }, []);

  const handleClearPtt = useCallback((slot: 1 | 2) => {
    landlineSettingsStore.clearPtt(slot);
    setSettingPtt(null);
  }, []);

  const handleVolumeChange = useCallback((key: 'micGain' | 'headsetVolume' | 'speakerVolume', value: number) => {
    landlineSettingsStore.update({ [key]: value });
  }, []);

  return (
    <Modal
      title="General Settings"
      open={open}
      onCancel={() => setModal(false)}
      footer={
        <Button type="primary" onClick={() => setModal(false)}>
          Close
        </Button>
      }
      width={420}
      destroyOnClose={false}
    >
      {/* PTT Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Push To Talk</div>

        {/* PTT 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 50, fontSize: 13 }}>PTT 1:</span>
          <span style={{
            flex: 1,
            fontSize: 13,
            padding: '4px 8px',
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            background: settingPtt === 1 ? '#1677ff22' : undefined,
            color: settingPtt === 1 ? '#1677ff' : undefined,
            minHeight: 28,
            display: 'flex',
            alignItems: 'center',
          }}>
            {settingPtt === 1 ? 'Press a key...' : settings.ptt1Label}
          </span>
          <Button
            size="small"
            type={settingPtt === 1 ? 'primary' : 'default'}
            onClick={() => settingPtt === 1 ? (() => { landlineSettingsStore.cancelSettingPtt(); setSettingPtt(null); })() : handleSetPtt(1)}
          >
            {settingPtt === 1 ? 'Cancel' : 'Set'}
          </Button>
          <Button size="small" onClick={() => handleClearPtt(1)} disabled={!settings.ptt1Key}>
            Clear
          </Button>
        </div>

        {/* PTT 2 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 50, fontSize: 13 }}>PTT 2:</span>
          <span style={{
            flex: 1,
            fontSize: 13,
            padding: '4px 8px',
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            background: settingPtt === 2 ? '#1677ff22' : undefined,
            color: settingPtt === 2 ? '#1677ff' : undefined,
            minHeight: 28,
            display: 'flex',
            alignItems: 'center',
          }}>
            {settingPtt === 2 ? 'Press a key...' : settings.ptt2Label}
          </span>
          <Button
            size="small"
            type={settingPtt === 2 ? 'primary' : 'default'}
            onClick={() => settingPtt === 2 ? (() => { landlineSettingsStore.cancelSettingPtt(); setSettingPtt(null); })() : handleSetPtt(2)}
          >
            {settingPtt === 2 ? 'Cancel' : 'Set'}
          </Button>
          <Button size="small" onClick={() => handleClearPtt(2)} disabled={!settings.ptt2Key}>
            Clear
          </Button>
        </div>
      </div>

      {/* Volume Section */}
      <div style={{ borderTop: '1px solid #d9d9d9', paddingTop: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Volume</div>

        {/* Microphone Gain */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span>Microphone</span>
            <span style={{ opacity: 0.6 }}>{settings.micGain}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            value={settings.micGain}
            onChange={(v) => handleVolumeChange('micGain', v)}
          />
        </div>

        {/* Headset Volume */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span>Headset</span>
            <span style={{ opacity: 0.6 }}>{settings.headsetVolume}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            value={settings.headsetVolume}
            onChange={(v) => handleVolumeChange('headsetVolume', v)}
          />
        </div>

        {/* Speaker Volume */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span>Speaker</span>
            <span style={{ opacity: 0.6 }}>{settings.speakerVolume}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            value={settings.speakerVolume}
            onChange={(v) => handleVolumeChange('speakerVolume', v)}
          />
        </div>
      </div>
    </Modal>
  );
}
