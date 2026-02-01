import { useState } from 'react';
import VscsButtonComponent from './vscs_button';
import VscsStaticButton from './vscs_static_button';
import { ButtonType } from './App';
import SettingModal from '~/app/components/SettingModal';
import { useCoreStore } from '../../../model';

interface VscsUtilProps {
  sendMsg: (data: any) => void;
}

export default function VscsUtil({ sendMsg }: VscsUtilProps) {
  const [settingModal, setSettingModal] = useState(false);
  const selectedPositions = useCoreStore((s: any) => s.selectedPositions);
  const positionData = useCoreStore((s: any) => s.positionData);
  
  // Get the current position identifier
  const getCurrentPositionName = () => {
    // If there are selected positions, use the first one
    if (selectedPositions && selectedPositions.length > 0) {
      return selectedPositions[0].pos;
    }
    
    // Otherwise, try to get the first position from positionData
    if (positionData?.positions && positionData.positions.length > 0) {
      return positionData.positions[0].pos;
    }
    
    // Fallback to default
    return 'FD/CD';
  };

  return (
    <div className="vscs-panel relative w-full h-full">
      {/* 4x2 Grid of Cyan Buttons - positioned beneath SVG but above background */}
      {/* Row 1 */}
      <div 
        className="absolute"
        style={{ 
          left: '611px', 
          top: '91px', 
          width: '75px', 
          height: '85px',
          zIndex: 15 
        }}
      >
        <VscsStaticButton 
          className="bg-cyan-400 cursor-pointer w-full h-full"
          onClick={() => {/* TODO: Implement button 1 */}}
        >
          🡇
          SYSTEM TONES
        </VscsStaticButton>
      </div>
      
      <div 
        className="absolute"
        style={{ 
          left: '695px', 
          top: '91px', 
          width: '75px', 
          height: '85px',
          zIndex: 15 
        }}
      >
        <VscsStaticButton 
          className="bg-cyan-400 cursor-pointer w-full h-full"
          onClick={() => {/* TODO: Implement button 2 */}}
        >
          🡅
        </VscsStaticButton>
      </div>

      {/* Row 2 */}
      <div 
        className="absolute"
        style={{ 
          left: '611px', 
          top: '194px', 
          width: '75px', 
          height: '85px',
          zIndex: 15 
        }}
      >
        <VscsStaticButton 
          className="bg-cyan-400 cursor-pointer w-full h-full"
          onClick={() => {/* TODO: Implement button 3 */}}
        >
          🡇
          OVR TONE
        </VscsStaticButton>
      </div>
      
      <div 
        className="absolute"
        style={{ 
          left: '695px', 
          top: '194px', 
          width: '75px', 
          height: '85px',
          zIndex: 15 
        }}
      >
        <VscsStaticButton 
          className="bg-cyan-400 cursor-pointer w-full h-full"
          onClick={() => {/* TODO: Implement button 4 */}}
        >
          🡅
        </VscsStaticButton>
      </div>

      {/* Row 3 */}
      <div 
        className="absolute"
        style={{ 
          left: '611px', 
          top: '297px', 
          width: '75px', 
          height: '85px',
          zIndex: 15 
        }}
      >
        <VscsStaticButton 
          className="bg-cyan-400 cursor-pointer w-full h-full"
          onClick={() => {/* TODO: Implement button 5 */}}
        >
          🡇
          SIDE TONE
        </VscsStaticButton>
      </div>
      
      <div 
        className="absolute"
        style={{ 
          left: '695px', 
          top: '297px', 
          width: '75px', 
          height: '85px',
          zIndex: 15 
        }}
      >
        <VscsStaticButton 
          className="bg-cyan-400 cursor-pointer w-full h-full"
          onClick={() => {/* TODO: Implement button 6 */}}
        >
          🡅
        </VscsStaticButton>
      </div>

      {/* Row 4 */}
      <div 
        className="absolute"
        style={{ 
          left: '611px', 
          top: '401px', 
          width: '75px', 
          height: '85px',
          zIndex: 15 
        }}
      >
        <VscsStaticButton 
          className="bg-cyan-400 cursor-pointer w-full h-full"
          onClick={() => {/* TODO: Implement button 7 */}}
        >
          ☼
        </VscsStaticButton>
      </div>
      
      <div 
        className="absolute"
        style={{ 
          left: '695px', 
          top: '401px', 
          width: '75px', 
          height: '85px',
          zIndex: 15 
        }}
      >
        <VscsStaticButton 
          className="bg-cyan-400 cursor-pointer w-full h-full"
          onClick={() => {/* TODO: Implement button 8 */}}
        >
          ☼
        </VscsStaticButton>
      </div>

      {/* UTIL Page SVG - positioned above the buttons */}
      <img 
        src="/UTIL_Page.svg" 
        alt="UTIL Page Layout" 
        className="w-full h-[auto] absolute top-0 left-0"
        style={{ transform: 'translateY(-25px)', zIndex: 10 }}
      />
      
      {/* Clickspot over LOGICAL PSN area - positioned in bottom right corner of SVG */}
      <div
        className="absolute cursor-pointer"
        style={{
          right: '1%',    // Position in bottom right corner
          bottom: '0%',  // Position in bottom right corner  
          width: '20%',   // Cover the logical PSN text area
          height: '15%',  // Cover the logical PSN text area
          zIndex: 30     // Ensure it's above all other elements
        }}
        onClick={() => setSettingModal(true)}
        title="Click to open position settings"
      >
        {/* Visible clickable area with subtle highlight */}
        <div className="w-full h-full opacity-0"></div>
      </div>

      {/* Position Text Overlay - positioned over the logical PSN area */}
      <div
        className="absolute pointer-events-none flex items-center justify-center"
        style={{
          right: '1%',    // Match the clickspot position
          top: '89%',
          width: '20%',   // Match the clickspot area
          height: '15%',  // Match the clickspot area
          zIndex: 35      // Above the clickspot
        }}
      >
        <span className="text-black text-lg bottom-0">
          {getCurrentPositionName()}
        </span>
      </div>

      {/* Settings Modal */}
      <SettingModal open={settingModal} setModal={setSettingModal} />
    </div>
  );
};