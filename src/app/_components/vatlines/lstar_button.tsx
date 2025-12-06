// LSTAR UI Button Components
import { Button, ButtonType } from '../../../types/vatlines_types';

type LstarButtonProps = {
  config: {
    id: string;
    shortName: string;
    target?: string;
    type?: any;
    label?: string;
    frequency?: string;
    name?: string;
    fillDesign?: string;
    textColor?: string;
    borderColor?: string;
    bgColor?: string;
    width?: number;
    height?: number;
  };
  variant?: 'standard' | 'priority' | 'frequency' | 'frequency-simple' | 'radio' | 'system' | 'triangle' | 'long-bar';
  typeString?: string;
  callback: (target: string, type: any) => void;
  className?: string;
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
  // Radio control specific props
  txActive?: boolean;
  rxActive?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onTxClick?: () => void;
  onRxClick?: () => void;
  // System status props
  systemStatus?: 'active' | 'inactive' | 'alert';
};

export default function LstarButtonComponent(props: LstarButtonProps) {
  const bgColor = props.buttonPattern?.bg || props.config.bgColor || '#526262'; // Default blue
  const textColor = props.buttonPattern?.fg || props.config.textColor || '#ffffff';
  const borderColor = props.buttonPattern?.border || props.config.borderColor || '#ffffff';
  const width = props.config.width || 80;
  const height = props.config.height || 80;

  // Priority button (red background)
  if (props.variant === 'priority') {
    return (
      <button
        type="button"
        onClick={() => props.callback(props.config.target || '', props.config.type || 'NONE')}
        className={`font-semibold border-2 rounded-lg ${props.className}`}
        style={{ 
          backgroundColor: '#a74f45', // Red background for priority
          color: '#ffffff',
          borderColor: '#ffffff',
          width: `${width}px`,
          height: `${height}px`,
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <div className="text-center leading-tight">
          {(props.config.name || props.config.label || props.config.shortName)
            ?.split('\\n')
            .map((line, index) => (
              <div key={index}>{line}</div>
            ))
          }
        </div>
      </button>
    );
  }

  // Triangle button (blue arrow without background)
  if (props.variant === 'triangle') {
    return (
      <button
        type="button"
        onClick={() => props.callback(props.config.target || '', props.config.type || 'NONE')}
        className={`flex items-center justify-center ${props.className}`}
        style={{ 
          backgroundColor: 'transparent',
          border: 'none',
          width: `${width}px`,
          height: `${height}px`,
          fontFamily: 'Arial, sans-serif',
          padding: 0
        }}
      >
        <svg 
          width={width * 0.8} 
          height={height * 0.8} 
          viewBox="0 0 24 24" 
          fill="none"
        >
          <path 
            d="M8 5l8 7-8 7V5z" 
            fill="#9cd9e4" 
            stroke="#9cd9e4" 
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </button>
    );
  }

  // Long bar (bottom white bar)
  if (props.variant === 'long-bar') {
    return (
      <div
        className={`border-2 rounded-lg flex items-center ${props.className}`}
        style={{ 
          backgroundColor: '#f8fafc', // Light gray/white
          borderColor: '#ffffff',
          width: `${width}px`,
          height: `${height}px`,
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <div className="w-full h-full flex items-center">          
          <div className="text-gray-600 text-xs px-2">
          </div>
        </div>
      </div>
    );
  }

  // Frequency button with TX/RX controls
  if (props.variant === 'frequency') {
    return (
      <button
        type="button"
        className={`border-2 rounded-lg overflow-hidden relative ${props.className}`}
        style={{ 
          backgroundColor: '#426386', // Main button background
          borderColor: '#ffffff',
          width: `${width}px`,
          height: `${height + 40}px`, // Reduced extra height for TX/RX controls
          padding: 0,
          minWidth: `${width}px`,
          minHeight: `${height + 40}px`,
          maxWidth: `${width}px`,
          maxHeight: `${height + 40}px`,
          fontSize: '14px',
          zoom: 1,
          transform: 'scale(1)',
          transformOrigin: 'top left',
          fontFamily: 'Arial, sans-serif'
        }}
        onClick={() => props.callback(props.config.target || '', props.config.type || 'NONE')}
      >
        {/* Frequency display area */}
        <div className="text-left font-semibold px-2 py-1 -mt-1 text-white pointer-events-none" style={{ backgroundColor: '#526262' }}>
          <div className="text-base font-bold -mt-1">
            {props.config.frequency || props.config.name}
          </div>
        </div>
        
        {/* TX/RX control row */}
        <div className="flex gap-0.5 p-1 -mt-3 pointer-events-none" style={{ backgroundColor: '#526262' }}>
          {/* TX Button - now a sub-area within the main button */}
          <button
            className={`flex-1 h-14 text-sm font-bold rounded-lg border border-2 flex flex-col items-center justify-center relative pointer-events-auto ${
              props.txActive ? 'text-black' : 'text-white'
            }`}
            style={{ 
              backgroundColor: props.txActive ? '#a2b5c7' : '#456388',
              borderColor: props.txActive ? '#000000' : '#ffffff'
            }}
            onClick={(e) => {
              e.stopPropagation();
              props.onTxClick && props.onTxClick();
            }}
          >
            <div className="text-sm font-bold p-1 -mt-6">TX</div>
            <div className="text-sm p-1 -mt-3">{props.txActive ? 'ON' : 'OFF'}</div>
            {/* Green indicator bar at bottom when active */}
            {props.txActive && (
              <div 
                className="absolute bottom-1 left-6 right-6 h-4 border-2 border-black rounded"
                style={{ backgroundColor: '#4ade80' }}
              ></div>
            )}
          </button>
          
          {/* RX Button */}
          <button
            className={`flex-1 h-14 text-xs font-bold rounded-lg border border-2 flex flex-col items-center justify-center relative pointer-events-auto ${
              props.rxActive ? 'text-black' : 'text-white'
            }`}
            style={{ 
              backgroundColor: props.rxActive ? '#a2b5c7' : '#456388',
              borderColor: props.rxActive ? '#000000' : '#ffffff'
            }}
            onClick={(e) => {
              e.stopPropagation();
              props.onRxClick && props.onRxClick();
            }}
          >
            <div className="text-sm font-bold p-1 -mt-6">RX</div>
            <div className="text-sm p-1 -mt-3">{props.rxActive ? 'ON' : 'OFF'}</div>
            {/* Green indicator bar at bottom when active */}
            {props.rxActive && (
              <div 
                className="absolute bottom-1 left-6 right-6 h-4 border-2 border-black rounded"
                style={{ backgroundColor: '#4ade80' }}
              ></div>
            )}
          </button>
          
          {/* Audio Button */}
          <button
            className="flex-1 h-14 text-lg text-black rounded-lg border border-2 flex items-center justify-center pointer-events-auto"
            style={{ 
              backgroundColor: '#a2b5c7',
              borderColor: props.rxActive ? '#000000' : '#ffffff'
            }}
            onClick={(e) => {
              e.stopPropagation();
              // Audio toggle functionality
            }}
          >
            🎧
          </button>
        </div>
      </button>
    );
  }

  // Simple frequency button (no TX/RX controls)
  if (props.variant === 'frequency-simple') {
    return (
      <button
        type="button"
        onClick={() => props.callback(props.config.target || '', props.config.type || 'NONE')}
        className={`font-bold border-2 rounded-lg ${props.className}`}
        style={{ 
          backgroundColor: '#426386', // Light blue matching reference
          color: '#ffffff',
          borderColor: '#ffffff',
          width: `${width}px`,
          height: `${height}px`,
          fontSize: '16px',
          minWidth: `${width}px`,
          minHeight: `${height}px`,
          maxWidth: `${width}px`,
          maxHeight: `${height}px`,
          zoom: 1,
          transform: 'scale(1)',
          transformOrigin: 'top left',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <div className="text-center leading-tight py-2">
          {props.config.frequency || props.config.name || props.config.label || props.config.shortName}
        </div>
      </button>
    );
  }

  // Radio control button (wider format)
  if (props.variant === 'radio') {
    return (
      <div 
        className={`border-2 rounded-lg text-white ${props.className}`}
        style={{ 
          backgroundColor: '#4a90b8', // Light blue like in reference
          borderColor: '#ffffff',
          width: `${width}px`,
          height: `${height}px`,
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <div className="text-center font-semibold leading-tight p-2">
          {props.config.name || props.config.label || props.config.shortName}
        </div>
      </div>
    );
  }

  // System status button
  if (props.variant === 'system') {
    const statusColor = props.systemStatus === 'active' ? '#77a8b5' : // Light blue for active
                       props.systemStatus === 'alert' ? '#f59e0b' : '#6b7280';
    
    const isSystemButtonWithRoundedTop = props.config.id === 'gg1' || props.config.id === 'system-status' || 
                                        props.config.type === 'GG_1' || props.config.type === 'SYSTEM_STATUS';
    const systemButtonClasses = `font-semibold border-2 ${isSystemButtonWithRoundedTop ? 'ag-button-rounded-top' : 'rounded-lg'} ${props.className}`;
    
    return (
      <button
        type="button"
        onClick={() => props.callback(props.config.target || '', props.config.type || 'NONE')}
        className={systemButtonClasses}
        style={{ 
          backgroundColor: statusColor,
          color: '#ffffff',
          borderColor: '#ffffff',
          width: `${width}px`,
          height: `${height}px`,
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <div className="text-center leading-tight">
          {(props.config.name || props.config.label || props.config.shortName)
            ?.split('\\n')
            .map((line, index) => (
              <div key={index}>{line}</div>
            ))
          }
        </div>
      </button>
    );
  }

  // Standard button (default)
  const isAgButton = props.config.id === 'ag' || props.config.type === 'AG';
  const buttonClasses = `font-semibold border-2 ${isAgButton ? 'ag-button-rounded-top' : 'rounded-lg'} ${props.className}`;
  
  return (
    <button
      type="button"
      onClick={() => props.callback(props.config.target || '', props.config.type || 'NONE')}
      className={buttonClasses}
      style={{ 
        backgroundColor: bgColor,
        color: textColor,
        borderColor: borderColor,
        width: `${width}px`,
        height: `${height}px`,
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div className="text-center leading-tight">
        {(props.config.name || props.config.label || props.config.shortName)
          ?.split('\\n')
          .map((line, index) => (
            <div key={index}>{line}</div>
          ))
        }
      </div>
    </button>
  );
}