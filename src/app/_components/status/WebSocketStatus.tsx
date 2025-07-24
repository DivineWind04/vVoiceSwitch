"use client";
import React from 'react';
import { useWebSocket } from '~/contexts/WebSocketContext';

const WebSocketStatus: React.FC = () => {
  const { connectionStatus, currentCallsign, pttStatus, channelStatuses } = useWebSocket();

  return (
    <div className="p-4 bg-customBlue text-customYellow">
      <div className="mb-2">
        <span className="font-bold">Connection: </span>
        <span className={connectionStatus.includes('Connected') ? 'text-green-400' : 'text-red-400'}>
          {connectionStatus}
        </span>
      </div>
      {currentCallsign && (
        <div className="mb-2">
          <span className="font-bold">Callsign: </span>
          <span>{currentCallsign}</span>
        </div>
      )}
      <div className="mb-2">
        <span className="font-bold">{pttStatus}</span>
      </div>
      {channelStatuses.length > 0 && (
        <div className="mt-4">
          <h3 className="font-bold mb-2">Active Channels:</h3>
          {channelStatuses.map((channel, index) => (
            <div key={index} className="text-sm mb-1">
              {channel.call === 'A/G' ? (
                <span>{channel.call} {(channel.freq / 1000000).toFixed(3)} MHz</span>
              ) : (
                <span>G/G: {channel.call} - {channel.status}</span>
              )}
              {channel.t && <span className="ml-2 text-green-400">[TX]</span>}
              {channel.r && <span className="ml-2 text-blue-400">[RX]</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebSocketStatus;