'use client';
import { useSession } from 'next-auth/react';
import { env } from 'next-runtime-env';
import { useCallback, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
// Stub SocketContext if not found
const SocketContext = { Provider: (props: any) => props.children };
// Stub NULL_CONFIGURATION and Position if not found
const NULL_CONFIGURATION = {};
type Position = any;
import SocketPage from './App';

declare global {
  interface Window {
    electron: any;
  }
}

export default function AppPage() {
  const session = useSession({
    required: true,
  });
  const hasConnected = useRef(false);
  const socket = useRef(
    io(env('NEXT_PUBLIC_SOCKET_URL')!, {
      autoConnect: false,
      transports: ['websocket'],
    }),
  );
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState('');
  const configRef = useRef<Position>(NULL_CONFIGURATION);

  const doConnect = useCallback(() => {
    console.log('do socket connect');
    socket.current.connect();
  }, []);

  // if (session.status === 'authenticated') {
  (socket.current as any).auth = {
      token: (session.data?.user as any)?.accessToken || "123",
    };
    if (!hasConnected.current) {
      console.log('first time connect');
      doConnect();
    }
  // }

  useEffect(() => {
    const socketRef = socket.current;
    socketRef.on('connect', () => {
      setConnected(true);
      hasConnected.current = true;
      console.log('connected to socket');
    });
    socketRef.on('disconnect', () => {
      setConnected(false);
      console.log('disconnected from socket');
    });

  socketRef.on('config', (config: any) => {
      configRef.current = config;
    });

  socketRef.on('error', (err: any) => {
      console.error('socket error', err);
    });

  socketRef.on('connect_error', (err: any) => {
      hasConnected.current = true;
      console.warn('socket connection error', err);
      setConnectError(err.message);
    });
    return () => {
      socketRef.off('disconnect');
      socketRef.off('on');
      socketRef.off('config');
      socketRef.off('error');
      socketRef.off('connect_error');

      socketRef.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket.current}>
      {connected ? (
        <SocketPage config={configRef.current} />
      ) : (
        <>
          {connectError !== '' ? (
            <div className=" w-4/5 text-center bg-red-500 text-white font-bold">
              Connection Error: {connectError}
            </div>
          ) : null}
          <button type="button" onClick={() => doConnect()}>
            Connect
          </button>
        </>
      )}
    </SocketContext.Provider>
  );
}
