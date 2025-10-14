import { useEffect, useState } from 'react'
import { useCoreStore, type Facility } from './model'
import axios from 'axios'
import SettingModal from './pages/setting'
import Button from 'antd/es/button'
import { Alert } from 'antd'

// Import UI wrapper components
import VSCSWrapper from './components/VSCSWrapper'
import ETVSWrapper from './components/ETVSWrapper'
import STVSWrapper from './components/STVSWrapper'
import IVSRWrapper from './components/IVSRWrapper'
import RDVSWrapper from './components/RDVSWrapper'


function App() {
  const [settingModal, setSettingModal] = useState(false)
  const connected = useCoreStore(s => s.connected)
  const setPosData = useCoreStore(s => s.setPositionData)
  const callsign = useCoreStore(s => s.callsign)
  const afv_version = useCoreStore(s => s.afv_version)
  const currentUI = useCoreStore(s => s.currentUI) // Get current UI from store
  const [versionAlert, setVersionAlert] = useState<any>(null)

  // Function to render the appropriate UI component based on current UI context
  const renderUI = () => {
    switch (currentUI) {
      case 'etvs':
        return <ETVSWrapper />;
      case 'stvs':
        return <STVSWrapper />;
      case 'ivsr':
        return <IVSRWrapper />;
      case 'rdvs':
        return <RDVSWrapper />;
      case 'vscs':
      default:
        return <VSCSWrapper />;
    }
  };

  useEffect(() => {
    function find(stp: Facility, found: boolean) {
      for (const e of stp.positions) {
        if (e.cs === callsign) {
          return stp
        }
      }
      for (const k of stp.childFacilities) {
        const f: any = find(k, found)
        if (f) {
          return f
        }
      }
    }
  axios.get('/zoa_position.json').then(r => {
      const prod = find(r.data, false)
      setPosData(prod)
    }).catch(() => {

    })
    axios.get('/html_app/afv_poc/patch/version.json').then(r => {
      const version_data = r.data
      const latest_version = version_data.latest_version - 0
      const current_version = parseFloat(afv_version) || 0
      const lowest_allowable_version = version_data.lowest_allowable_version - 0
      if (current_version < lowest_allowable_version) {
        version_data.must_upgrade = true
      }
      setVersionAlert(latest_version > current_version ? version_data : null)
    })
  }, [callsign, afv_version])
  return (
    <>
      <audio src="Ringback.wav" preload="auto" id="ringback"></audio>
      <audio src="Override.mp3" preload="auto" id="override"></audio>
      <audio src="GGChime.mp3" preload="auto" id="ggchime"></audio>
      <div style={{ padding: '10px 20px' }}>
        <SettingModal open={settingModal} setModal={setSettingModal} />
        <h2>AFV Poc Client v2 - ZM</h2>
        {
          versionAlert ? <Alert type={versionAlert?.must_upgrade ? "error" : "warning"} style={{ marginBottom: 10 }} closable={!versionAlert?.must_upgrade}
            onClose={() => setVersionAlert(null)} showIcon message={<>
              Latest AFV version {versionAlert.latest_version} is available.
              {afv_version ? ' Your current version is: ' + afv_version + "." : null}
              {versionAlert?.must_upgrade ? " Lowest usable version is " + versionAlert.lowest_allowable_version + ", you must at least update to that version." : ""}
              <br />
              Download Link: <a href={versionAlert.link?.windows} target='_blank'>[Windows]</a> <a href={versionAlert.link?.macos} target='_blank'>[macOS]</a>
            </>} /> : null
        }
        {connected && !versionAlert?.must_upgrade ? <div>
          <em>Connected to AFV (CRC)</em>
          <Button onClick={() => setSettingModal(true)}>Setting</Button>
          {renderUI()}
        </div> : <>
          Not Connected
        </>}

      </div>

    </>
  )
}

export default App
