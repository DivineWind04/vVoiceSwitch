// components/Keypad.tsx
"use client";

import KeypadButton from "../ground_ground/KeypadButton";

const Keypad: React.FC = () => {
  return (
    <div className="items-center space-x-2">
      {/* <input className="h-8 w-48 center bg-customBlue">{/* Dialing Box</input>*/}
      <div className="grid grid-cols-3 gap-[4px]">
        <>
          <KeypadButton topLine="" bottomLine="1"/>
          <KeypadButton topLine="ABC" bottomLine="2" />
          <KeypadButton topLine="DEF" bottomLine="3" />
          <KeypadButton topLine="GHI" bottomLine="4" />
          <KeypadButton topLine="JKL" bottomLine="5" />
          <KeypadButton topLine="MNO" bottomLine="6" />
          <KeypadButton topLine="PRS" bottomLine="7" />
          <KeypadButton topLine="TUV" bottomLine="8" />
          <KeypadButton topLine="WXY" bottomLine="9" />
          <KeypadButton topLine="*" bottomLine="" />
          <KeypadButton topLine="" bottomLine="0" />
          <KeypadButton topLine="#" bottomLine="" />
        </>
      </div>
    </div>
  );
};

export default Keypad;
