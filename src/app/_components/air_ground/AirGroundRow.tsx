// components/AirGroundRow.tsx

import React from 'react';
import FrequencyButton from './FreqButton';
import SummFreqButton from './SummFreqButton';
import SquareButton from '../base_button/SquareButton';
import DAButton from "../ground_ground/DAButton";
import OOSButton from '../base_button/OOSButton';
import OOSFreqButton from './OOSFreqButton';
import { off } from 'process';
import FrequencyConfig from "example-config.json";

type AirGroundRowProps = {
  frequency: string;
  name: string;
  prefMode: boolean; // True for hs, False for ls
  currMode: boolean; // True for hs, False for ls
  outOfService?: boolean;
  offline?: boolean;
  summary?: boolean; // True if this is a summary row
  ground3?: boolean; // True if this is a ground 3 row
};

// const AirGroundRow: React.FC<AirGroundRowProps> = ({ frequency, name, prefMode, currMode, outOfService, offline, summary, ground3 }) => {
//   return (
//     <div className="flex mb-[3px] gap-[3px]">
//       {/* Frequency Button */}
//       {!offline && !summary || !ground3 ? (
//         <FrequencyButton
//           name={name}
//           frequency={frequency}
//           prefMode={prefMode}
//           currMode={currMode}
//         />
//       ) : (
//         <OOSFreqButton />
//       )  
//       }
//       {/* Square Buttons */}
//       {!outOfService && !offline ? (
//         <>
//           <SquareButton topLine='TX' bottomLine='SEL' />
//           <SquareButton topLine='RX' bottomLine='SEL' />
//           <SquareButton topLine='TX' bottomLine='MAIN' />
//           <SquareButton topLine='RX' bottomLine='MAIN' />
//         </>
//       ) : (
//         <>
//           <OOSButton />
//           <OOSButton />
//           <OOSButton />
//           <OOSButton />
//         </>
//       )}
//     </div>
//   );
// };

const AirGroundRow: React.FC<AirGroundRowProps> = ({ frequency, name, prefMode, currMode, outOfService, offline, summary, ground3 }) => {
  let freqButton;
  if ((!offline && !summary) || !ground3) {
    freqButton = (
      <FrequencyButton
        name={name}
        frequency={frequency}
        prefMode={prefMode}
        currMode={currMode}
      />
    );
  } else if (!offline && summary) {
    freqButton = (
      <SummFreqButton
        name={name}
        frequency={frequency}
        prefMode={prefMode}
        currMode={currMode}
      />
    );
  } else if (!offline && ground3) {
    freqButton = (
      <DAButton
        topLine={FrequencyConfig.GGLines.name_top}
        middleLine={"name_middle" in FrequencyConfig.GGLines ? FrequencyConfig.GGLines.name_middle : undefined}
        bottomLine={"name_bottom" in FrequencyConfig.GGLines ? FrequencyConfig.GGLines.name_bottom : undefined}
        latching={false}
        dialLine={"dial_line" in FrequencyConfig.GGLines ? FrequencyConfig.GGLines.dial_line : undefined}
      />
    );
  } else {
    freqButton = <OOSFreqButton />;
  }

  let squareButtons;
  if (!outOfService && !offline) {
    squareButtons = (
      <>
        <SquareButton topLine='TX' bottomLine='SEL' />
        <SquareButton topLine='RX' bottomLine='SEL' />
        <SquareButton topLine='TX' bottomLine='MAIN' />
        <SquareButton topLine='RX' bottomLine='MAIN' />
      </>
    );
      } else if (!offline && summary) {
    freqButton = (
      <SummFreqButton
        name={name}
        frequency={frequency}
        prefMode={prefMode}
        currMode={currMode}
      />
    );
  } else if (!offline && ground3) {
    freqButton = (
      <DAButton
        topLine={FrequencyConfig.GGLines.name_top}
        middleLine={"name_middle" in FrequencyConfig.GGLines ? FrequencyConfig.GGLines.name_middle : undefined}
        bottomLine={"name_bottom" in FrequencyConfig.GGLines ? FrequencyConfig.GGLines.name_bottom : undefined}
        latching={false}
        dialLine={"dial_line" in FrequencyConfig.GGLines ? FrequencyConfig.GGLines.dial_line : undefined}
      />
    );
  } else {
    squareButtons = (
      <>
        <OOSButton />
        <OOSButton />
        <OOSButton />
        <OOSButton />
      </>
    );
  }

  return (
    <div className="flex mb-[3px] gap-[3px]">
      {freqButton}
      {squareButtons}
    </div>
  );
};

export default AirGroundRow;
