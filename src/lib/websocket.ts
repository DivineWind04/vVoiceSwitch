type WebSocketMessage = {
  type: 'add' | 'del' | 'tx' | 'rx' | 'call' | 'stop' | 'pick_up';
  cmd1: string;
  dbl1: number;
};

type WebSocketResponse = {
  type: 'message' | 'call' | 'channel_status' | 'call_sign';
  cmd1?: string;
  data?: any;
};

export class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private currentCallsign = '';
  private onMessageCallback?: (data: WebSocketResponse) => void;
  private onStatusCallback?: (status: string) => void;

  constructor() {
    this.connect();
    this.startReconnectTimer();
  }

  private connect() {
    try {
      this.socket = new WebSocket('ws://localhost:9002');
      
      this.socket.onopen = () => {
        this.onStatusCallback?.('Connected to AFV (CRC)');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketResponse;
          this.onMessageCallback?.(data);
          
          if (data.type === 'call_sign') {
            this.currentCallsign = data.cmd1 || '';
            this.resetWindow();
          }
        } catch {
          // Handle non-JSON messages like PttOpen/PttClosed
          this.onMessageCallback?.({ type: 'message', cmd1: event.data });
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.socket = null;
      };

      this.socket.onclose = () => {
        this.onStatusCallback?.('Not Connected to CRC');
        this.socket = null;
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }

  private startReconnectTimer() {
    this.reconnectInterval = setInterval(() => {
      if (!this.socket) {
        this.connect();
      }
    }, 1000);
  }

  private resetWindow() {
    this.sendMessage({ type: 'del', cmd1: '', dbl1: 0 });
    
    setTimeout(() => {
      // Add default calls
      this.addCall(2, '491');
      this.addCall(2, '492');
      this.addCall(2, '720');
      this.addCall(2, '891');
    }, 500);
  }

  public sendMessage(message: WebSocketMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  public addCall(callType: number, cmd1: string) {
    this.sendMessage({ type: 'add', cmd1, dbl1: callType });
  }

  public setTx(freq: number, mode: boolean) {
    this.sendMessage({ type: 'tx', cmd1: freq.toString(), dbl1: mode ? 1 : 0 });
  }

  public setRx(freq: number, mode: boolean) {
    this.sendMessage({ type: 'rx', cmd1: freq.toString(), dbl1: mode ? 1 : 0 });
  }

  public makeCall(callId: string, callType: number) {
    this.sendMessage({ type: 'call', cmd1: callId, dbl1: callType });
  }

  public stopCall(callId: string) {
    this.sendMessage({ type: 'stop', cmd1: callId, dbl1: 1 });
  }

  public pickUpCall(callId: string) {
    this.sendMessage({ type: 'pick_up', cmd1: callId, dbl1: 1 });
  }

  public onMessage(callback: (data: WebSocketResponse) => void) {
    this.onMessageCallback = callback;
  }

  public onStatus(callback: (status: string) => void) {
    this.onStatusCallback = callback;
  }

  public getCurrentCallsign() {
    return this.currentCallsign;
  }

  public disconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    this.socket?.close();
  }
}