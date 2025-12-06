// Stub for missing props type
import { Button, ButtonType } from '../../../types/vatlines_types';

type StandardButtonProps = {
  config: {
    id: string;
    shortName: string;
    target?: string;
    type?: any;
    // Legacy properties for compatibility
    label?: string;
    frequency?: string;
    name?: string;
    fillDesign?: string;
    textColor?: string;
    borderColor?: string;
  };
  typeString?: string;
  callback: (target: string, type: any) => void;
  className?: string;
  multiLineData?: {
    line1?: string;
    line2?: string;
  };
  buttonPattern?: {
    bg: string;
    fg: string;
    border: string;
    fill: string;
  };
  lineTypeInfo?: {
    typeLetter: string;
    indicatorState: string;
  };
};

type RadioButtonProps = {
  variant: 'radio';
  radioSize: 'short' | 'long';
  label: string;
  value?: string;
  checked?: boolean;
  onChange?: (value: string) => void;
  bgColor?: string;
  textColor?: string;
  labelColor?: string;
  indicatorColor?: string;
  indicatorBg?: string;
  frequency?: string;
  borderColor?: string;
  frequencyColor?: string;
  className?: string;
  pttActive?: boolean; // PTT is pressed and this freq is selected for TX
  talking?: boolean;   // Someone else is transmitting on this frequency
  selected?: boolean;  // Is this button selected (shows white border)
  onSelect?: () => void; // Click handler for selection
  onTxClick?: () => void; // TX button click handler
  onRxClick?: () => void; // RX button click handler
  onHsClick?: () => void; // HS button click handler
  // Radio module status props based on table
  rxSelected?: boolean;     // RX (indicator) - lights when receiver selected
  rxHsSelected?: boolean;   // RX HS (indicator) - lights when headset selected
  rxLsSelected?: boolean;   // RX LS (indicator) - lights when loudspeaker selected
  rxMsMode?: 'M' | 'S';     // RX M/S - Main or Standby mode
  txSelected?: boolean;     // TX select indicator
  txMsMode?: 'M' | 'S';     // TX M/S - Main or Standby mode
  receiverAudio?: boolean;  // Audio present and routed to headset/loudspeaker
  onRxHsLsClick?: () => void; // HS/LS pushbutton click
  onRxMsClick?: () => void;   // RX M/S pushbutton click
  onTxMsClick?: () => void;   // TX M/S pushbutton click
};

export type RdvsButtonComponentProps = StandardButtonProps | RadioButtonProps;
export type { StandardButtonProps, RadioButtonProps };

function ShortRadioButton(props: RadioButtonProps) {
  const bgColor = props.bgColor || '#000000';
  const textColor = props.textColor || '#a8dbd8';
  const labelColor = props.labelColor || '#888888';
  const indicatorColor = props.indicatorColor || '#c35c2f';
  const indicatorBg = props.indicatorBg || bgColor;
  const borderColor = props.borderColor || indicatorColor; // Always use the original border color
  const frequencyColor = props.frequencyColor || '#a8dbd8';
  const freqDisplay = props.frequency && props.frequency.trim() !== '' ? props.frequency : '--------';
  
  // Debug logging for PTT and selection status
  if (props.frequency && props.frequency !== '--------') {
    console.log(`RDVS Button ${props.frequency}:`, {
      pttActive: props.pttActive,
      talking: props.talking,
      selected: props.selected,
      showingDoubleBoard: props.selected
    });
  }
  
  // Standard radio button display for air-to-ground
  return (
    <div
      className="pixel-radio w-[121px] h-[50px] flex flex-col justify-between pt-0 pb-1 px-1 relative cursor-pointer"
      style={{ 
        backgroundColor: bgColor,
        // Double border effect when selected: outer white border + inner red border
        border: props.selected ? '2px solid white' : `2px solid ${borderColor}`,
        boxShadow: props.selected ? `inset 0 0 0 2px ${borderColor}` : 'none'
      }}
      onClick={props.onSelect} // Make clickable
    >
      {/* Hs Rx Tx row - top */}
      <div className="flex flex-row justify-between items-center text-[14px] font-[100] px-0.5 mt-0 mb-0 rdvs-label" style={{ color: labelColor }}>
        <span 
          className="flex flex-col items-start"
          style={{ color: (props.rxHsSelected || props.rxLsSelected) ? '#93ca63' : labelColor }}
        >
          <span>{props.rxLsSelected ? 'Ls' : 'Hs'}</span>
        </span>
        <span 
          style={{ color: props.rxSelected ? '#93ca63' : labelColor }}
        >
          Rx
        </span>
        <span 
          style={{ color: props.txSelected ? '#93ca63' : labelColor }}
        >
          Tx
        </span>
      </div>
      {/* Frequency and indicator row */}
      <div className="flex flex-row justify-between items-end flex-1 mt-0">
        <span className="leading-none overflow-visible whitespace-nowrap rdvs-label" style={{ color: textColor, fontSize: 20, minWidth: 0 }}>{freqDisplay}</span>
        <span className="flex items-center justify-center flex-shrink-0">
          <span className={`inline-block w-[12px] h-[12px] rounded-full flex items-center justify-center border-2 ${
            // Circle states based on PTT and talking status
            props.pttActive ? 'animate-pulse' : ''
          }`}
                style={{ 
                  borderColor: '#f05c5c',
                  backgroundColor: (props.pttActive || props.talking) ? '#f05c5c' : 'transparent'
                }}>
            {/* Inner fill when active */}
            {(props.pttActive || props.talking) && (
              <span className="w-3 h-3 rounded-full" 
                    style={{ 
                      backgroundColor: '#f05c5c',
                      animation: props.pttActive ? 'flutter-8hz 0.125s infinite' : props.talking ? 'flutter-8hz 0.125s infinite' : 'none'
                    }}>
              </span>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}

export default function RdvsButtonComponent(props: RdvsButtonComponentProps) {
  if ('variant' in props && props.variant === 'radio') {
    if (props.radioSize === 'short') {
      return <ShortRadioButton {...props} />;
    }
    // Long radio redesigned to match screenshot
    const longBgColor = props.bgColor || '#000000';
    const longTextColor = props.textColor || '#a8dbd8';
    const longFrequencyColor = props.frequencyColor || '#a8dbd8';
    const longBorderColor = props.borderColor || '#C0632A';
    
    return (
      <div
        className="pixel-radio-long w-[375px] h-[50px] flex flex-row items-start p-2 border-2 relative rdvs-label"
        style={{ 
          backgroundColor: longBgColor, 
          borderColor: longBorderColor
        }}
      >
        {/* HS/LS Section - Stacked vertically with indicators and click handlers */}
        <div className="flex flex-col mr-6 -mt-1">
          <span 
            className="text-[20px] font-[100] -mt-1 cursor-pointer" 
            style={{ color: longTextColor }}
            onClick={(e) => {
              e.stopPropagation();
              props.onRxHsLsClick && props.onRxHsLsClick();
            }}
          >
            HS
          </span>
          <span 
            className="text-[20px] font-[100] -mt-1 cursor-pointer" 
            style={{ color: longTextColor }}
            onClick={(e) => {
              e.stopPropagation();
              props.onRxHsLsClick && props.onRxHsLsClick();
            }}
          >
            LS
          </span>
        </div>
        
        {/* Green box for HS/LS with indicators */}
        <div className="flex flex-col">
          <div className="w-[26px] h-[40px] border-2 relative -ml-5 mr-3 -mt-1 cursor-pointer" 
               style={{ 
                 backgroundColor: 'black',
                 borderColor: '#93ca63',
                 // HS indicator (top half) - lights continuously if headset selected, flutters with audio
                 background: props.rxHsSelected ? 
                   (props.receiverAudio ? 
                     'linear-gradient(to bottom, #93ca63 0%, #93ca63 50%, black 50%, black 100%)' :
                     'linear-gradient(to bottom, #93ca63 0%, #93ca63 50%, black 50%, black 100%)'
                   ) : 
                   (props.rxLsSelected ? 
                     'linear-gradient(to bottom, black 0%, black 50%, #93ca63 50%, #93ca63 100%)' :
                     'black'
                   )
               }}
               onClick={(e) => {
                 e.stopPropagation();
                 props.onRxHsLsClick && props.onRxHsLsClick();
               }}>
            {/* HS flutter animation when receiver audio present and routed to headset */}
            {props.rxHsSelected && props.receiverAudio && (
              <div className="absolute top-0 left-0 w-full h-1/2 animate-pulse" 
                   style={{ backgroundColor: '#93ca63' }}></div>
            )}
            {/* LS flutter animation when receiver audio present and routed to loudspeaker */}
            {props.rxLsSelected && props.receiverAudio && (
              <div className="absolute bottom-0 left-0 w-full h-1/2 animate-pulse" 
                   style={{ backgroundColor: '#93ca63' }}></div>
            )}
          </div>
        </div>

        {/* Vertical divider line after HS/LS */}
        <div className="flex flex-row items-start mr-2 -mt-2">
          <div className="w-[2px] h-[48px]" style={{ backgroundColor: '#C0632A' }}></div>
        </div>

        {/* RX and Frequency Section - Vertical stack */}
        <div className="flex flex-col mr-2">
          {/* RX Section - Label next to box with indicator */}
          <div className="flex flex-row items-center -mb-1 -mt-2">
            <span 
              className="text-[20px] font-[100] mr-2" 
              style={{ color: longTextColor }}
            >
              RX
            </span>
            <div className="w-[26px] h-[17px] border-2 relative cursor-pointer" 
                 style={{ 
                   borderColor: '#93ca63',
                   // RX indicator - lights continuously when receiver selected
                   backgroundColor: props.rxSelected ? '#93ca63' : 'black'
                 }}
                 onClick={(e) => {
                   e.stopPropagation();
                   props.onRxClick && props.onRxClick();
                 }}>
            </div>
          </div>
          
          {/* Frequency Display */}
          <div className="text-[20px] font-[100] overflow-visible whitespace-nowrap" style={{ color: longFrequencyColor, minWidth: 0 }}>
            {props.frequency}
          </div>
        </div>
        
        {/* Vertical divider line after RX */}
        <div className="flex flex-row items-start mr-2 -mt-2">
          <div className="w-[2px] h-[48px]" style={{ backgroundColor: '#C0632A' }}></div>
        </div>

        {/* RX M/S Section - Label next to box with mode indicator */}
        <div className="flex flex-row items-start mr-2 -mt-1">
          <span 
            className="text-[18px] font-[100] -mt-1" 
            style={{ color: longTextColor }}
          >
            M/S
          </span>
          <div className="w-[26px] h-[17px] border-2 relative flex items-center justify-center cursor-pointer"
               style={{ 
                 borderColor: '#93ca63',
                 backgroundColor: props.rxSelected ? '#93ca63' : 'black'
               }}
               onClick={(e) => {
                 e.stopPropagation();
                 props.onRxMsClick && props.onRxMsClick();
               }}>
            {/* Display M or S based on rxMsMode */}
            <span className="rdvs-label text-[14px]" 
                  style={{ color: props.rxSelected ? 'black' : 'white' }}>
              {props.rxMsMode || 'M'}
            </span>
          </div>
        </div>
        
        {/* Vertical divider line after first M/S */}
        <div className="flex flex-row items-start mr-2 -mt-2">
          <div className="w-[2px] h-[48px]" style={{ backgroundColor: '#C0632A' }}></div>
        </div>

        <div className="flex flex-col mr-2">
          {/* TX Section - Label next to box with indicator */}
          <div className="flex flex-row items-start -mt-1">
            <span 
              className="rdvs-label text-[20px] mr-2 -mt-1" 
              style={{ color: longTextColor }}
            >
              TX
            </span>
            <div className="w-[26px] h-[17px] border-2 cursor-pointer" 
                 style={{ 
                   borderColor: '#93ca63',
                   // TX select indicator - lights continuously when TX enabled
                   backgroundColor: props.txSelected ? '#93ca63' : 'black'
                 }}
                 onClick={(e) => {
                   e.stopPropagation();
                   props.onTxClick && props.onTxClick();
                 }}>
            </div>
          </div>
          {/* TX status indicator (circle) positioned below TX box */}
          <div className="flex justify-center mt-1 ml-8">
            <div className={`w-[12px] h-[12px] rounded-full border-2 ${
              // Circle states based on PTT and talking status (same as short radio button)
              props.pttActive ? 'animate-pulse' : ''
            }`}
            style={{ 
              borderColor: '#f05c5c',
              backgroundColor: (props.pttActive || props.talking) ? '#f05c5c' : 'transparent'
            }}>
              {/* Inner fill when active */}
              {(props.pttActive || props.talking) && (
                <div className="w-full h-full rounded-full" 
                      style={{ 
                        backgroundColor: '#f05c5c',
                        animation: props.pttActive ? 'flutter-8hz 0.125s infinite' : props.talking ? 'flutter-8hz 0.125s infinite' : 'none'
                      }}>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Vertical divider line after TX */}
        <div className="flex flex-row items-start mr-2 -mt-2">
          <div className="w-[2px] h-[48px]" style={{ backgroundColor: '#C0632A' }}></div>
        </div>

        {/* TX M/S Section - Label next to box with mode indicator */}
        <div className="flex flex-row items-start mr-2 -mt-1">
          <span 
            className="text-[18px] font-[100] -mt-1" 
            style={{ color: longTextColor }}
          >
            M/S
          </span>
          <div className="w-[26px] h-[17px] border-2 relative flex items-center justify-center cursor-pointer"
               style={{ 
                 borderColor: '#93ca63',
                 backgroundColor: props.txSelected ? '#93ca63' : 'black'
               }}
               onClick={(e) => {
                 e.stopPropagation();
                 props.onTxMsClick && props.onTxMsClick();
               }}>
            {/* Display M or S based on txMsMode */}
            <span className="text-[12px] font-bold" 
                  style={{ color: props.txSelected ? 'black' : 'white' }}>
              {props.txMsMode || 'M'}
            </span>
          </div>
        </div>
      </div>
    );
  }
  if ('config' in props) {
    // Use buttonPattern colors if available, otherwise fallback to config or defaults
    const bgColor = props.buttonPattern?.bg || '#333';
    const textColor = props.buttonPattern?.fg || props.config.textColor || '#FFFFFF';
    const borderColor = props.buttonPattern?.border || props.config.borderColor || '#555';
    
    const fillDesignClass = props.config.fillDesign ? `fill-${props.config.fillDesign}` : '';
    
    return (
      <button
        type="button"
        onClick={() => props.callback(props.config.target || '', props.config.type || 'NONE')}
        className={`text-[20px] font-[100] tracking-widest w-[70px] h-[50px] leading-[0.8] relative rdvs-label ${props.className}`}
        style={{ 
          backgroundColor: bgColor,
          color: textColor,
          borderColor: borderColor, 
          borderWidth: 2, 
          borderStyle: 'solid'
        }}
      >
        {/* Fill design as background layer */}
        {props.config.fillDesign && (
          <div className={`absolute inset-0 ${fillDesignClass} opacity-30`}></div>
        )}
        
        {/* Text content on top */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full" style={{ color: textColor }}>
          {(() => {
            const name = props.config.name || props.config.label || props.config.shortName || '';
            const firstLine = name.slice(0, 7);
            const secondLine = name.length > 7 ? name.slice(7, 14) : '';
            return (
              <>
                <div className="first-line text-center">{firstLine || <br />}</div>
                <div className="second-line text-center">{secondLine || <br />}</div>
              </>
            );
          })()}
          {/* Frequency display if present */}
          {props.config.frequency && (
            <div className="frequency text-xs text-center" style={{ color: textColor }}>
              {props.config.frequency}
            </div>
          )}
        </div>
        
        {/* Cyan indicator positioned absolutely at bottom center */}
        <div className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 outline outline-2 outline-cyan-300 flex items-center w-3 h-3 justify-center indicator font-[100] text-xs ${
          // Status-based styling: hollow by default, filled when active
          props.lineTypeInfo && props.lineTypeInfo.indicatorState !== 'off' ? 
            `text-black ${
              props.lineTypeInfo.indicatorState === 'flashing' ? 'rdvs-flash' :
              props.lineTypeInfo.indicatorState === 'winking' ? 'rdvs-wink' :
              props.lineTypeInfo.indicatorState === 'flutter' ? 'rdvs-flutter' : 
              'bg-cyan-300' // Steady-on (no animation)
            }` : 'bg-black text-white'
        }`}>
          {props.lineTypeInfo ? props.lineTypeInfo.typeLetter : props.typeString}
        </div>
      </button>
    );
  }
  return null;
}