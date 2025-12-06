"use client";

import React, { useState, useEffect } from 'react';
import { useCoreStore } from '~/model';

interface DialInterfaceProps {
  onClose: () => void;
  availableTrunks: Array<{
    id: string;
    name: string;
    type: 'ring' | 'override' | 'direct';
  }>;
}

export default function DialInterface({ onClose, availableTrunks }: DialInterfaceProps) {
  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const gg_status = useCoreStore((s: any) => s.gg_status);
  const [selectedTrunk, setSelectedTrunk] = useState<string | null>(null);
  const [dialedNumber, setDialedNumber] = useState<string>('');
  const [callState, setCallState] = useState<'trunk_select' | 'dialing' | 'calling' | 'connected' | 'busy' | 'no_answer'>('trunk_select');
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);

  // Monitor WebSocket for dial call status changes
  useEffect(() => {
    if (currentCallId && gg_status) {
      const dialCall = gg_status.find((call: any) => 
        call.call === currentCallId || call.call?.includes(dialedNumber)
      );
      
      if (dialCall) {
        switch (dialCall.status) {
          case 'ringback':
            setCallState('calling');
            break;
          case 'connected':
          case 'ok':
          case 'active':
            setCallState('connected');
            break;
          case 'busy':
            setCallState('busy');
            break;
          case 'no_answer':
            setCallState('no_answer');
            break;
        }
      }
    }
  }, [gg_status, currentCallId, dialedNumber]);

  const keypadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'], 
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

  const handleTrunkSelect = (trunkId: string) => {
    setSelectedTrunk(trunkId);
    setCallState('dialing');
    
    // Send trunk selection to WebSocket
    sendMsg({ 
      type: 'trunk_select', 
      cmd1: trunkId, 
      dbl1: availableTrunks.find(t => t.id === trunkId)?.type === 'ring' ? 1 : 
           availableTrunks.find(t => t.id === trunkId)?.type === 'override' ? 0 : 2
    });
  };

  const handleDigitPress = (digit: string) => {
    if (callState === 'dialing') {
      setDialedNumber(prev => prev + digit);
    }
  };

  const handleCallButton = () => {
    if (selectedTrunk && dialedNumber && callState === 'dialing') {
      const callId = `DIAL_${selectedTrunk}_${dialedNumber}`;
      setCurrentCallId(callId);
      setCallState('calling');
      
      // Send dial command to WebSocket
      sendMsg({
        type: 'dial',
        cmd1: dialedNumber,
        dbl1: parseInt(selectedTrunk.replace('trunk_', '')) || 0
      });
    }
  };

  const handleHangupButton = () => {
    if (callState === 'calling' || callState === 'connected') {
      // Send hangup command
      sendMsg({
        type: 'stop',
        cmd1: currentCallId || `DIAL_${selectedTrunk}_${dialedNumber}`,
        dbl1: availableTrunks.find(t => t.id === selectedTrunk)?.type === 'ring' ? 1 : 2
      });
    }
    
    // Reset state
    setSelectedTrunk(null);
    setDialedNumber('');
    setCallState('trunk_select');
    setCurrentCallId(null);
  };

  const handleClear = () => {
    if (callState === 'dialing') {
      setDialedNumber('');
    }
  };

  const handleBackspace = () => {
    if (callState === 'dialing') {
      setDialedNumber(prev => prev.slice(0, -1));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border-2 border-cyan-300 p-6 rounded-lg min-w-[400px]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-cyan-300 text-lg font-bold">Dial Call</h2>
          <button 
            onClick={onClose}
            className="text-cyan-300 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        {/* Trunk Selection */}
        {callState === 'trunk_select' && (
          <div>
            <h3 className="text-cyan-300 mb-3">Select Trunk:</h3>
            <div className="space-y-2">
              {availableTrunks.map((trunk) => (
                <button
                  key={trunk.id}
                  onClick={() => handleTrunkSelect(trunk.id)}
                  className="w-full p-3 bg-gray-800 text-cyan-300 border border-cyan-300 hover:bg-cyan-300 hover:text-black rounded"
                >
                  {trunk.name} ({trunk.type.toUpperCase()})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dialing Interface */}
        {(callState === 'dialing' || callState === 'calling' || callState === 'connected' || callState === 'busy' || callState === 'no_answer') && (
          <div>
            <div className="mb-4">
              <div className="text-cyan-300 text-sm">Trunk: {availableTrunks.find(t => t.id === selectedTrunk)?.name}</div>
              <div className={`text-sm ${
                callState === 'connected' ? 'text-green-400' :
                callState === 'calling' ? 'text-yellow-400' :
                callState === 'busy' || callState === 'no_answer' ? 'text-red-400' :
                'text-cyan-300'
              }`}>
                Status: {
                  callState === 'calling' ? 'CALLING (Ring-back)' :
                  callState === 'connected' ? 'CONNECTED' :
                  callState === 'busy' ? 'BUSY' :
                  callState === 'no_answer' ? 'NO ANSWER' :
                  callState.toUpperCase()
                }
              </div>
            </div>

            {/* Number Display */}
            <div className="mb-4">
              <input
                type="text"
                value={dialedNumber}
                readOnly
                className="w-full p-3 bg-gray-900 text-cyan-300 border border-cyan-300 text-center text-xl font-mono"
                placeholder="Enter number..."
              />
            </div>

            {/* Keypad */}
            {callState === 'dialing' && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {keypadButtons.flat().map((digit) => (
                  <button
                    key={digit}
                    onClick={() => handleDigitPress(digit)}
                    className="p-3 bg-gray-800 text-cyan-300 border border-cyan-300 hover:bg-cyan-300 hover:text-black rounded font-bold text-lg"
                  >
                    {digit}
                  </button>
                ))}
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex space-x-2">
              {callState === 'dialing' && (
                <>
                  <button
                    onClick={handleCallButton}
                    disabled={!dialedNumber}
                    className="flex-1 p-3 bg-green-600 text-white border border-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:border-gray-600 rounded"
                  >
                    CALL
                  </button>
                  <button
                    onClick={handleBackspace}
                    className="p-3 bg-yellow-600 text-white border border-yellow-600 hover:bg-yellow-700 rounded"
                  >
                    ⌫
                  </button>
                  <button
                    onClick={handleClear}
                    className="p-3 bg-orange-600 text-white border border-orange-600 hover:bg-orange-700 rounded"
                  >
                    CLR
                  </button>
                </>
              )}
              
              {(callState === 'calling' || callState === 'connected' || callState === 'busy' || callState === 'no_answer') && (
                <button
                  onClick={handleHangupButton}
                  className="flex-1 p-3 bg-red-600 text-white border border-red-600 hover:bg-red-700 rounded"
                >
                  HANGUP
                </button>
              )}
              
              {(callState === 'busy' || callState === 'no_answer') && (
                <button
                  onClick={() => {
                    setCallState('dialing');
                    setCurrentCallId(null);
                  }}
                  className="p-3 bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 rounded"
                >
                  RETRY
                </button>
              )}
              
              <button
                onClick={onClose}
                className="p-3 bg-gray-600 text-white border border-gray-600 hover:bg-gray-700 rounded"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}