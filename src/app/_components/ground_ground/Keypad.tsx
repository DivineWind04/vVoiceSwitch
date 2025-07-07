// components/Keypad.tsx
"use client";

import SquareButton from "../base_button/SquareButton";

const Keypad: React.FC = () => {
  return (
    <div className="items-center space-x-1">
      <input className="h-10 w-48 center bg-customBlue">{/* Dialing Box */}</input>
      <div className="grid grid-cols-3 gap-1">
        <>
          <SquareButton topLine="" bottomLine="1"/>
          <SquareButton topLine="ABC" bottomLine="2" />
          <SquareButton topLine="DEF" bottomLine="3" />
          <SquareButton topLine="GHI" bottomLine="4" />
          <SquareButton topLine="JKL" bottomLine="5" />
          <SquareButton topLine="MNO" bottomLine="6" />
          <SquareButton topLine="PRS" bottomLine="7" />
          <SquareButton topLine="TUV" bottomLine="8" />
          <SquareButton topLine="XYZ" bottomLine="9" />
          <SquareButton topLine="*" bottomLine="" />
          <SquareButton topLine="" bottomLine="0" />
          <SquareButton topLine="#" bottomLine="" />
        </>
      </div>
    </div>
  );
};

export default Keypad;
