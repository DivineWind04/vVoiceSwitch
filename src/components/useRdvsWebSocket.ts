import { useEffect } from 'react';
import { useCoreStore, RDVSButton, RDVSGroup, RDVSPage } from '../model';

// Example WebSocket RDVS data structure
// {
//   page: 1,
//   groups: [
//     { id: 1, buttons: [ { id, label, status, group, type }, ... ] },
//     ...
//   ],
//   footer: [ 'DA Overflows', ... ]
// }

export function useRdvsWebSocket() {
  const setRdvsConfig = useCoreStore((s) => s.setRdvsConfig);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080/rdvs');
    ws.onmessage = (event) => {
      try {
        const data: RDVSPage = JSON.parse(event.data);
        setRdvsConfig && setRdvsConfig(data);
      } catch (err) {
        console.error('Invalid RDVS WebSocket data:', err);
      }
    };
    ws.onerror = (err) => {
      console.error('RDVS WebSocket error:', err);
    };
    return () => {
      ws.close();
    };
  }, [setRdvsConfig]);
}
