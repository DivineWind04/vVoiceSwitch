import { useState } from 'react';
import VscsButtonComponent from './vscs_button';
import VscsStaticButton from './vscs_static_button';
import { ButtonType } from './App';
import SettingModal from './SettingModal';

interface VscsUtilProps {
  sendMsg: (data: any) => void;
}

export default function VscsUtil({ sendMsg }: VscsUtilProps) {
  const [settingModal, setSettingModal] = useState(false);

  return (
    <div className="vscs-panel relative w-full h-full">
      {/* 4x2 Grid of Cyan Buttons - positioned beneath SVG but above background */}
      {/* Row 1 */}
      <div 
        className="absolute"
        style={{ 
          left: '619px', 
          top: '93px', 
          width: '80px', 
          height: '50px',
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
          left: '706px', 
          top: '93px', 
          width: '80px', 
          height: '50px',
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
          left: '619px', 
          top: '197px', 
          width: '80px', 
          height: '50px',
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
          left: '706px', 
          top: '197px', 
          width: '80px', 
          height: '50px',
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
          left: '619px', 
          top: '301px', 
          width: '80px', 
          height: '50px',
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
          left: '706px', 
          top: '301px', 
          width: '80px', 
          height: '50px',
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
          left: '619px', 
          top: '407px', 
          width: '80px', 
          height: '50px',
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
          left: '706px', 
          top: '407px', 
          width: '80px', 
          height: '50px',
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
        <div className="w-full h-full opacity-0 hover:opacity-20 hover:bg-blue-500 transition-opacity rounded border-2 border-transparent hover:border-blue-300"></div>
      </div>

      {/* Settings Modal */}
      <SettingModal open={settingModal} setModal={setSettingModal} />
    </div>
  );
};