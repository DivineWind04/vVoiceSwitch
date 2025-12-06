import { ButtonType } from './types';
import SpeakerSvgComponent from './speaker_svg';
import { useState } from 'react';

interface ButtonProps {
  shortName?: string;
  longName?: string;
  target?: string;
  type?: ButtonType;
}

interface Callback {
  (target: string, type: ButtonType): void;
}

export default function VscsButtonComponent(props: {
  config: ButtonProps;
  typeString: string;
  callback: Callback | undefined;
  className: string;
  multiLineData?: {
    line1?: string;
    line2?: string;
    line3?: string;
    line4?: string;
    line5?: string;
  };
}) {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = () => {
    if (!props.callback) return;
    setIsPressed(true);
  };

  const handleMouseUp = () => {
    if (!props.callback) return;
    setIsPressed(false);
  props.callback(props.config.target ?? '', props.config.type ?? ButtonType.NONE);
  };

  const handleMouseLeave = () => {
    if (!props.callback) return;
    setIsPressed(false);
  };

  return (
    <button
      type="button"
      disabled={!props.callback}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      className={`${props.className} ${isPressed && !props.className.includes('ag-button') ? 'state-touched' : ''}`}
    >
      {props.multiLineData && props.className.includes('gg-button') ? (
        // 5-line layout for G/G buttons
        <div className="gg-button-content">
          <div className="gg-line1">
            {props.config.type === ButtonType.SHOUT ? (
              <div className="gg-speaker-icon">
                <img src="/VSCSSpeakerIcon.bmp" alt="Speaker" style={{ width: '20px', height: '16px' }} />
              </div>
            ) : (
              props.multiLineData.line1 || ''
            )}
          </div>
          <div className="gg-line2">{props.multiLineData.line2 || ''}</div>
          <div className="gg-line3">{props.multiLineData.line3 || ''}</div>
          <div className="gg-line4">{props.multiLineData.line4 || ''}</div>
          <div className="gg-line5">
            {props.config.type === ButtonType.OVERRIDE ? 'OVR' : (props.multiLineData.line5 || props.typeString)}
          </div>
        </div>
      ) : (
        // Original 3-line layout for A/G and other buttons
        <>
          <div className="first-line">
            <div className="scale-75 h-4 pb-4">
              {props.config.type === ButtonType.SHOUT ? (
                <SpeakerSvgComponent />
              ) : null}
            </div>
            {props.config.shortName}
          </div>
          <div className="second-line">{props.config.longName}</div>
          <div className="landline-type mt-4">{props.typeString}</div>
        </>
      )}
    </button>
  );
}
