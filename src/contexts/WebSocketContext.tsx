"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { WebSocketService } from '~/lib/websocket';

type ChannelStatus = {
  freq: number;
  call: string;
  status: string;
  t: boolean; // TX status
  r: boolean; // RX status
};

type WebSocketContextType = {
  service: WebSocketService | null;
  connectionStatus: string;
  channelStatuses: ChannelStatus[];
  currentCallsign: string;
  pttStatus: string;
};

const WebSocketContext = createContext<WebSocketContextType>({
  service: null,
  connectionStatus: 'Disconnected',
  channelStatuses: [],
  currentCallsign: '',
  pttStatus: 'PTT: Closed',
});

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [service, setService] = useState<WebSocketService | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [channelStatuses, setChannelStatuses] = useState<ChannelStatus[]>([]);
  const [currentCallsign, setCurrentCallsign] = useState('');
  const [pttStatus, setPttStatus] = useState('PTT: Closed');

  useEffect(() => {
    const wsService = new WebSocketService();

    wsService.onStatus((status) => {
      setConnectionStatus(status);
    });

    wsService.onMessage((data) => {
      switch (data.type) {
        case 'channel_status':
          setChannelStatuses(data.data || []);
          break;
        case 'call_sign':
          setCurrentCallsign(data.cmd1 || '');
          break;
        case 'message':
          if (data.cmd1 === 'PttOpen') {
            setPttStatus('PTT: Open');
          } else if (data.cmd1 === 'PttClosed') {
            setPttStatus('PTT: Closed');
          }
          break;
      }
    });

    setService(wsService);

    return () => {
      wsService.disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{
      service,
      connectionStatus,
      channelStatuses,
      currentCallsign,
      pttStatus,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};