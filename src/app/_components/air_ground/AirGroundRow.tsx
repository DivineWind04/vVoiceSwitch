// components/AirGroundRow.tsx

import React from 'react';
import FrequencyButton from './FreqButton';
import SquareButton from '../base_button/SquareButton';
import OOSButton from '../base_button/OOSButton';
import OOSFreqButton from './OOSFreqButton';
import { useCoreStore } from '~/model';

type AirGroundRowProps = {
  data?: any; // ag_status item
  offline?: boolean;
};

const formatFreq = (freq: number) => {
  if (!freq) return "";
  const val = freq / 1_000_000;
  if (val % 1 === 0) return val.toFixed(1);
  return val.toString().replace(/0+$/, '').replace(/\.$/, '');
};

const AirGroundRow: React.FC<AirGroundRowProps> = ({ data, offline }) => {
  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const ptt = useCoreStore((s: any) => s.ptt);
  const freq = data?.freq;
  const prefMode = !!data?.h; // preferred route headset flag
  const currMode = !!data?.h; // current shown as same for now
  const name = data ? (data.name || (freq ? formatFreq(freq) : '')) : '';
  const outOfService = false; // placeholder; adapt if model provides
  const txIndicator = data?.t ? (ptt ? 'flutter active' : 'steady green') : '';
  const rxIndicator = data?.r ? (data?.talking ? 'flutter active' : 'steady green') : '';
  return (
    <div className="flex mb-1 gap-1">
      {/* Frequency Button */}
      {!offline ? (
        <FrequencyButton
          name={name}
          frequency={freq ? formatFreq(freq) : ''}
          prefMode={prefMode}
          currMode={currMode}
          onToggleRoute={(toHeadset) => {
            if (!data) return;
            sendMsg({ type: 'set_hs', cmd1: '' + data.freq, dbl1: toHeadset });
          }}
        />
      ) : (
        <OOSFreqButton />
      )  
      }
      {/* Square Buttons */}
      {!outOfService && !offline ? (
        <>
          <SquareButton topLine='TX' bottomLine='SEL' indicatorClassName={txIndicator} onClick={() => data && sendMsg({ type: 'tx', cmd1: '' + data.freq, dbl1: !data.t })} />
          <SquareButton topLine='RX' bottomLine='SEL' indicatorClassName={rxIndicator} onClick={() => data && sendMsg({ type: 'rx', cmd1: '' + data.freq, dbl1: !data.r })} />
          <SquareButton topLine='TX' bottomLine='MAIN' />
          <SquareButton topLine='RX' bottomLine='MAIN' />
        </>
      ) : (
        <>
          <OOSButton />
          <OOSButton />
          <OOSButton />
          <OOSButton />
        </>
      )}
    </div>
  );
};

export default AirGroundRow;
