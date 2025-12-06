// components/AirGroundRow.tsx

import React from 'react';
import FrequencyButton from './FreqButton';
import SquareButton from '../base_button/SquareButton';
import OOSButton from '../base_button/OOSButton';
import OOSFreqButton from './OOSFreqButton';
import { useCoreStore } from '~/model';


type AirGroundRowProps = {
  data?: any; // Single ag_status item or undefined
};

const formatFreq = (freq: number) => {
  if (!freq) return "";
  const val = freq / 1_000_000;
  if (val % 1 === 0) return val.toFixed(1);
  return val.toString().replace(/0+$/, '').replace(/\.$/, '');
};

const AirGroundRow: React.FC<AirGroundRowProps> = ({ data }) => {
  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const ptt = useCoreStore((s: any) => s.ptt);

  if (!data) {
    // Render empty button set
    return (
      <div className="flex mb-1 gap-1">
        <OOSFreqButton />
        <OOSButton />
        <OOSButton />
        <OOSButton />
        <OOSButton />
      </div>
    );
  }
  const freq = data?.freq;
  const prefMode = !!data?.h; // preferred route headset flag
  const currMode = !!data?.h; // current shown as same for now
  const name = data.name || (freq ? formatFreq(freq) : '');
  const outOfService = false; // placeholder; adapt if model provides
  const showTxIndicator = !!data?.t; // TX is active when data.t is true
  const showRxIndicator = !!data?.r; // RX is active when data.r is true
  
  // TX Indicator Logic:
  // - TX selected + PTT pressed by me: flutter active (green)
  // - TX selected + steady: steady green
  // - TX not selected + someone else transmitting: flutter red
  // - TX not selected + no one transmitting: no indicator
  let txIndicator = '';
  if (data?.t) {
    // TX is selected by me
    txIndicator = ptt ? 'flutter active' : 'steady green';
  } else if (data?.talking && !data?.t) {
    // TX not selected by me, but someone else is transmitting on this frequency
    txIndicator = 'flutter red';
  }
  
  // RX Indicator Logic:
  // - RX selected + someone talking: flutter active (green)
  // - RX selected + steady: steady green
  // - RX not selected + VOX (audio) present: flutter red
  // - RX not selected + no audio: no indicator
  let rxIndicator = '';
  if (data?.r) {
    // RX is selected by me
    rxIndicator = data?.talking ? 'flutter active' : 'steady green';
  } else if (data?.talking && !data?.r) {
    // RX not selected by me, but there's VOX (voice activity) on this frequency
    rxIndicator = 'flutter red';
  }
  return (
    <div className="flex mb-1 gap-1">
      <FrequencyButton
        name={name}
        frequency={freq ? formatFreq(freq) : ''}
        prefMode={prefMode}
        currMode={currMode}
        onClick={() => {
          if (!data) return;
          sendMsg({ type: 'set_hs', cmd1: '' + data.freq, dbl1: !data.h });
        }}
      />
            <SquareButton 
            topLine='TX' 
            bottomLine='SEL' 
            showIndicator={!!data?.t || (!!data?.talking && !data?.t)} // Show for selected TX OR remote TX
            indicatorClassName={txIndicator}
            onClick={() => data && sendMsg({ type: 'tx', cmd1: '' + data.freq, dbl1: !data.t })} 
          />
          <SquareButton 
            topLine='RX' 
            bottomLine='SEL' 
            showIndicator={!!data?.r || (!!data?.talking && !data?.r)} // Show for selected RX OR remote VOX
            indicatorClassName={rxIndicator}
            onClick={() => data && sendMsg({ type: 'rx', cmd1: '' + data.freq, dbl1: !data.r })} 
          />
  <SquareButton topLine='TX' bottomLine='MAIN' />
  <SquareButton topLine='RX' bottomLine='MAIN' />
    </div>
  );
};

export default AirGroundRow;
