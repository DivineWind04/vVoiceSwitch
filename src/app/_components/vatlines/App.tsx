'use client';
import { useEffect, useRef, useState } from 'react';
import RdvsComponent from './rdvs';
import './styles.css';
import VscsComponent from './vscs';

//#region Type Declarations
export interface Configuration {
  id: string;
  name: string;
  layouts: ButtonLayout[];
}

export interface ButtonLayout {
  order: number;
  button: Button;
}

export interface Button {
  shortName: string;
  longName: string;
  target: string;
  type: ButtonType;
  dialCode?: string;
}

export enum ButtonType {
  SHOUT = 'SHOUT',
  OVERRIDE = 'OVERRIDE',
  RING = 'RING',
  NONE = 'NONE',
}

export enum CALL_TYPE {
  SHOUT = 'SHOUT',
  CONVERTED_SHOUT = 'CONVERTED_SHOUT',
  OVERRIDE = 'OVERRIDE',
  RING = 'RING',
  NONE = 'NONE',
}

export interface ActiveLandline {
  id: string;
  type: CALL_TYPE;
  from: string;
  target: string;
}

export interface IncomingLandline {
  signal: any;
  from: string;
  name: string;
  type: CALL_TYPE;
  room: string;
  target: string;
}
//#endregion

export default function SocketPage(props: { config: Position }) {
  const socket = useSocketContext();

  const [editSettings, setEditSettings] = useState(false);
  const [activePeers, setActivePeers] = useState<PeerAudio[]>([]);
  const peersRef = useRef<PeerData[]>([]);

  const stream = useRef<MediaStream>();

  const [ptt, setPtt] = useState<boolean>(false);
  const [overridePtt, setOverridePtt] = useState<boolean>(false);

  const [settingsPttKey, setPttKey] = useState(
    localStorage.getItem('pttKey') ?? '|',
  );

  const [settingsHeadset, setHeadset] = useState(
    localStorage.getItem('headset') ?? '',
  );
  const [settingsLoudspeaker, setLoudspeaker] = useState(
    localStorage.getItem('loudspeaker') ?? '',
  );
  const [settingsVolume, setVolume] = useState(
    parseInt(localStorage.getItem('volume') ?? '50'),
  );
  const [settingsMic, setMic] = useState(
    localStorage.getItem('microphone') ?? '',
  );
  const [settingsOutputDevices, setOutputsDevices] = useState<
    MediaDeviceInfo[]
  >([]);
  const [settingsInputDevices, setInputDevices] = useState<MediaDeviceInfo[]>(
    [],
  );
  const [settingsConfiguration, setSettingsConfiguration] =
    useState<Configuration>(props.config.configurations[0]);

  const overrideRouteRef = useRef<string>('');
  const ggRouteRef = useRef<string>('');
  const [ggIsLoud, setGgIsLoud] = useState(false);
  const [overrideIsLoud, setOverrideIsLoud] = useState(true);

  const [activeLandlines, setActiveLandlines] = useState<ActiveLandline[]>([]);
  const [outgoingLandlines, setOutgoingLandlines] = useState<ActiveLandline[]>(
    [],
  );
  const [incomingLandlines, setIncomingLandlines] = useState<
    IncomingLandline[]
  >([]);
  const [heldLandlines, setHeldLandlines] = useState<string[]>([]);

  const rdvsIntercom = useRef<HTMLAudioElement>(null);
  const rdvsOverride = useRef<HTMLAudioElement>(null);
  const vscsIntercomOutgoing = useRef<HTMLAudioElement>(null);
  const vscsIntercomIncoming = useRef<HTMLAudioElement>(null);
  const vscsOverride = useRef<HTMLAudioElement>(null);
  const error = useRef<HTMLAudioElement>(null);

  const noPttIdRef = useRef<Id | undefined>(undefined);

  //#region PTT
  const enableAudioTrack = (track: MediaStreamTrack, enable = true) => {
    if (track.enabled === enable) return;

    track.enabled = enable;
  };

  const enableAudioTracks = (
    inputStream: MediaStream | undefined,
    enable = true,
  ) => {
    if (!inputStream) return;

    inputStream
      .getAudioTracks()
      .forEach((track: MediaStreamTrack) => enableAudioTrack(track, enable));
  };

  const disableAudioTracks = (inputStream: MediaStream | undefined) =>
    enableAudioTracks(inputStream, false);

  useEffect(() => {
    if (ptt) {
      enableAudioTracks(stream.current);
    } else if (overridePtt) {
      enableAudioTracks(stream.current);
    } else {
      disableAudioTracks(stream.current);
    }
  }, [ptt, overridePtt]);

  useEffect(() => {
    // Initial startup for Electron
    if (window.electron) {
      window.electron.onPttDown(() => {
        console.log('ptt down from electron');
        setPtt(true);
      });

      window.electron.onPttUp(() => {
        console.log('ptt up from electron');
        setPtt(false);
      });
    } else {
      toast.warning(`PTT disabled`, { autoClose: false });
      console.warn('No electron environment detected. PTT disabled');
    }
    return () => {};
  }, []);
  //#endregion

  useEffect(() => {
    console.debug('ptt key change', settingsPttKey);
    if (window.electron) {
      window.electron.setPtt(
        settingsPttKey
          .replace('|', '+')
          .replace(/^\+/, '')
          .replace(/\+$/, '')
          .replace(/^None\+/, ''),
      );
    }

    if (settingsPttKey === '|') {
      console.log('automatically showing settings');
      settingsEdit(true);

      noPttIdRef.current = toast.warning(
        'PTT not set. Open settings, to configure.',
        {
          autoClose: false,
        },
      );
    } else if (noPttIdRef.current !== undefined) {
      toast.dismiss(noPttIdRef.current);
      noPttIdRef.current = undefined;
    }
  }, [settingsPttKey]);

  useEffect(() => {
    if (typeof window !== undefined) {
      
    }
    try {
      console.log('mic is', settingsMic);

      const userMedia =
        settingsMic !== ''
          ? navigator.mediaDevices.getUserMedia({
              video: false,
              audio: {
                deviceId: settingsMic,
                autoGainControl: true,
                echoCancellation: true,
                noiseSuppression: true,
              },
            })
          : navigator.mediaDevices.getUserMedia({
              video: false,
              audio: {
                autoGainControl: true,
                echoCancellation: true,
                noiseSuppression: true,
              },
            });

      userMedia.then((micStream) => {
        stream.current = micStream;
        try {
          setMicrophone(
            micStream.getAudioTracks()[0].getCapabilities().deviceId!,
          );
        } catch (err: any) {
          console.error(err);
          toast.error(err.message);
        }
        disableAudioTracks(micStream);

        navigator.mediaDevices
          .enumerateDevices()
          .then((devices) => {
            const matches = devices.filter((d) => d.kind === 'audiooutput');
            setOutputsDevices(matches);
            setInputDevices(devices.filter((d) => d.kind === 'audioinput'));
            if (
              !settingsHeadset ||
              !matches.some((d) => d.deviceId === settingsHeadset)
            ) {
              setHeadset(matches[0].deviceId);
              console.warn('Reset headset to', matches[0].label);
            }
            if (
              !settingsLoudspeaker ||
              !matches.some((d) => d.deviceId === settingsLoudspeaker)
            ) {
              setLoudspeaker(matches[0].deviceId);
              console.warn('Reset loudspeaker to', matches[0].label);
            }
            overrideRouteRef.current = settingsLoudspeaker;
            ggRouteRef.current = settingsHeadset;
          })
          .catch((err) => {
            console.error('error getting audio', err);
            toast.error(`Error getting audio: ${err}`);
            alert(err);
          });

        if (window.electron) {
          console.debug('running echotest for electron');
          const echoPeer1 = new Peer({
            initiator: true,
            trickle: true,
            stream: stream.current,
            config: {
              iceServers: [
                {
                  urls: 'turn:sturn.vatlines.com:3478',
                  username: props.config.turn.username,
                  credential: props.config.turn.credential,
                },
              ],
            },
          });
          const echoPeer2 = new Peer({
            initiator: true,
            trickle: true,
            stream: stream.current,
            config: {
              iceServers: [
                {
                  urls: 'turn:sturn.vatlines.com:3478',
                  username: props.config.turn.username,
                  credential: props.config.turn.credential,
                },
              ],
            },
          });

          echoPeer1.on('signal', (signal: Peer.SignalData) => {
            console.debug('got signal from peer (echoPeer1)');
            echoPeer2.signal(signal);
          });

          echoPeer1.on('stream', (stream: MediaStream) => {
            console.debug('got stream peer 1');
            echoPeer1.destroy();
            echoPeer2.destroy();
          });

          echoPeer2.on('signal', (signal: Peer.SignalData) => {
            console.debug('got signal from peer (echoPeer2)');
            echoPeer1.signal(signal);
          });

          echoPeer2.on('stream', (stream: MediaStream) => {
            console.debug('got stream on peer 2');
            echoPeer1.destroy();
            echoPeer2.destroy();
          });
        }
      });
    } catch (err) {
      console.error('Error getting mic permission', err);
      toast.error(`${err}`, { autoClose: 5000 });
      alert(err);
    }

    return () => {
      console.debug('unload main');
    };
  }, []);

  useEffect(() => {
    console.debug('held landlines render', heldLandlines);
    setActivePeers((peers) =>
      peers.map((p) => {
        return { ...p, held: heldLandlines.includes(p.room) };
      }),
    );
  }, [heldLandlines]);

  //#region Peer Creation
  const createPeer = (
    toSignal: string,
    callerId: string,
    room: string,
    withAudio: boolean,
  ) => {
    console.log('create peer', stream.current);
    const peer = new Peer({
      initiator: true,
      trickle: true,
      stream: stream.current,
      config: {
        iceServers: [
          {
            urls: 'turn:sturn.vatlines.com:3478',
            username: props.config.turn.username,
            credential: props.config.turn.credential,
          },
        ],
      },
    });

    peer.on('signal', (signal: Peer.SignalData) => {
      console.info('got signal from peer (createPeer)');
      socket.emit('init-signal', {
        to: toSignal,
        signal,
        audio: withAudio,
        room,
      });
    });

    peer.on('error', (err: Error) => {
      playError();
      toast.error(`Peer error: ${err}`);
      console.error('create peer error', err);
    });

    peer.on('connect', () => {
      console.log('createPeer connected.');
    });

    return peer;
  };

  const addPeer = (incomingSignal: Peer.SignalData, callerId: string) => {
    console.log('add peer', stream.current);
    const peer = new Peer({
      initiator: false,
      trickle: true,
      stream: stream.current,
      config: {
        iceServers: [
          {
            urls: 'turn:sturn.vatlines.com:3478',
            username: props.config.turn.username,
            credential: props.config.turn.credential,
          },
        ],
      },
    });

    peer.on('signal', (signal: Peer.SignalData) => {
      console.log('got signal from peer (addPeer)');
      socket.emit('return-signal', {
        signal,
        to: callerId,
      });
    });

    peer.on('error', (err: Error) => {
      playError();
      toast.error(`Peer error: ${err}`);
      console.error('add peer error', err);
    });

    peer.on('connect', () => {
      console.log('addPeer connected.');
    });

    peer.signal(incomingSignal);

    return peer;
  };
  //#endregion

  //#region Joining/Leaving Landlines
  const initiateLandline = (target: string, type: CALL_TYPE) => {
    if (type === CALL_TYPE.NONE) return;

    socket.emit(
      'initiate-landline',
      {
        to: target,
        type,
      },
      (result: { result: string; message: string }) => {
        if (result.result === 'success') {
          console.log('landline initiated', result.message);
          setOutgoingLandlines((lines) => [
            ...lines,
            {
              id: result.message,
              type,
              target: target,
              from: `${props.config.facility.facilityId}-${props.config.sector}`,
            },
          ]);
          if (type !== CALL_TYPE.OVERRIDE && type !== CALL_TYPE.SHOUT) {
            if (props.config.panelType === PositionType.VSCS) {
              vscsIntercomOutgoing.current?.play();
            } else {
              rdvsIntercom.current?.play();
            }
          }
        } else {
          if (result.result === 'error') {
            error.current?.play();
            console.warn('Initiate landline failed', result.message);
            toast.error(result.message);
          } else {
            console.error('Unknown callback result', result);
          }
        }
      },
    );
  };

  const joinLandline = (id: string) => {
    socket.emit('join-landline', {
      target: id,
      initial: false,
    });
  };

  const leaveLandline = (id: string) => {
    disableAudioTracks(stream.current);
    socket.emit('leave-landline', id);
    setHeldLandlines((lines) => lines.filter((l) => l !== id));
  };

  const terminateLandline = (id: string) => {
    socket.emit('terminate-landline', id);
    setActivePeers((peers) => peers.filter((p) => p.room !== id));
    peersRef.current
      .filter((p) => p.room === id)
      .forEach((p) => p.peer.destroy());
    peersRef.current = peersRef.current.filter((p) => p.room !== id);
    setOverridePtt(false);
  };
  //#endregion

  //#region Socket
  useEffect(() => {
    socket.on('user-joined', (data: JoinedSignal) => {
      const match = peersRef.current.find(
        (p) => p.peerId === data.caller && p.room === data.room,
      );
      if (match) {
        console.log('got user signal, signaling back');
        match.peer.signal(data.signal);
      } else {
        console.log(data.caller, 'joined. adding peer', data);
        const peer = addPeer(data.signal, data.caller);
        peersRef.current.push({
          peer,
          peerId: data.caller,
          audio: data.withAudio,
          room: data.room,
        });

        peer.on('stream', (stream: MediaStream) => {
          console.log('user-joined stream received');
          setActivePeers((others) => [
            ...others,
            {
              peer,
              audio: data.withAudio,
              room: data.room,
              id: data.caller,
              sink:
                data.type === CALL_TYPE.OVERRIDE
                  ? overrideRouteRef.current
                  : ggRouteRef.current,
              stream,
              held: heldLandlines.includes(data.room),
            },
          ]);
        });
      }
    });

    socket.on('user-signal', (data) => {
      console.log('got signal data back from', data.id);
      const item = peersRef.current.find((p) => p.peerId === data.id);
      if (item) {
        console.log('signaling back', item.peer.destroyed);
        item.peer.signal(data.signal);
      } else {
        console.error('failed to find user to signal from user-signal');
      }
    });

    socket.on('disconnected', (id: string) => {
      setActivePeers(activePeers.filter((p) => p.id !== id));
      peersRef.current
        .filter((p) => p.peerId === id)
        .forEach((p) => p.peer.destroy());
      peersRef.current = peersRef.current.filter((p) => p.peerId === id);
    });

    socket.on('incoming-landline', (data: IncomingLandline) => {
      console.log('incoming landline', data.room, data.type);
      if (data.type === CALL_TYPE.OVERRIDE) {
        console.log('override call');
        setOverridePtt(true);
        if (props.config.panelType === PositionType.VSCS) {
          vscsOverride.current?.play();
        } else {
          rdvsOverride.current?.play();
        }
      } else if (!incomingLandlines.find((l) => l.room === data.room)) {
        setIncomingLandlines((lines) => [...lines, data]);
      }
      if (data.type !== CALL_TYPE.OVERRIDE && data.type !== CALL_TYPE.SHOUT) {
        if (props.config.panelType === PositionType.VSCS) {
          vscsIntercomIncoming.current?.play();
        } else {
          rdvsIntercom.current?.play();
        }
      }
    });

    socket.on('landline-activated', (data: JoinedData) => {
      console.log('landline activated', data);
      if (!activeLandlines.find((l) => l.id === data.id)) {
        setActiveLandlines((lines) => [
          ...lines,
          {
            id: data.id,
            type: data.type,
            from: data.from,
            target: data.target,
          },
        ]);
      }
      setIncomingLandlines((lines) => lines.filter((l) => l.room !== data.id));
      setOutgoingLandlines((lines) => lines.filter((l) => l.id !== data.id));

      if (vscsIntercomIncoming.current) {
        vscsIntercomIncoming.current.pause();
        vscsIntercomIncoming.current.currentTime = 0;
      }
      if (vscsIntercomOutgoing.current) {
        vscsIntercomOutgoing.current.pause();
        vscsIntercomOutgoing.current.currentTime = 0;
      }
      if (rdvsIntercom.current) {
        rdvsIntercom.current.pause();
        rdvsIntercom.current.currentTime = 0;
      }
    });

    socket.on('terminate-landline', (id: string) => {
      console.log('terminate landline', id);

      setActivePeers((peers) => peers.filter((p) => p.room !== id));
      peersRef.current
        .filter((p) => p.room === id)
        .forEach((p) => p.peer.destroy());
      peersRef.current = peersRef.current.filter((p) => p.room !== id);

      setActiveLandlines((lines) => lines.filter((l) => l.id !== id));
      setIncomingLandlines((lines) => lines.filter((l) => l.room !== id));
      setOutgoingLandlines((lines) => lines.filter((l) => l.id !== id));
    });

    socket.on('left-landline', (data: { id: string; who: string }) => {
      if (data.who === socket.id) {
        console.log('i am leaving landline, destroy peers');
        peersRef.current
          .filter((p) => p.room === data.id)
          .forEach((p) => p.peer.destroy());
      }
      peersRef.current
        .filter((p) => p.room == data.id && p.peerId === data.who)
        .forEach((p) => p.peer.destroy());
      peersRef.current = peersRef.current.filter(
        (p) => p.room == data.id && p.peerId === data.who,
      );

      setActivePeers((peers) =>
        peers.filter((p) => p.room == data.id && p.id === data.who),
      );

      setActiveLandlines((lines) => lines.filter((l) => l.id !== data.id));
    });

    socket.on('join-landline', (id: string) => {
      // SHOUT / OVERRIDE
      // we are being told to join, no choice.
      socket.emit('join-landline', {
        target: id,
        initial: true,
      });
    });

    socket.on('joined-landline', (data: JoinedData) => {
      console.log('joined room. create peers', data);
      setIncomingLandlines((lines) => lines.filter((l) => l.room !== data.id));

      data.users.forEach((user: string) => {
        if (user === socket.id) {
          console.log('skipping self', user);
          return;
        } else if (user.length < 10) {
          console.log('skipping room', user);
          return;
        }

        const peer = createPeer(
          user,
          socket.id!,
          data.id,
          data.type !== CALL_TYPE.SHOUT,
        );
        peersRef.current.push({
          peerId: user,
          peer,
          audio: true,
          room: data.id,
        });
        peer.on('stream', (stream: MediaStream) => {
          console.log('joined-landline stream');
          setActivePeers((others) => [
            ...others,
            {
              peer,
              audio: true,
              room: data.id,
              id: user,
              sink:
                data.type === CALL_TYPE.SHOUT
                  ? settingsLoudspeaker
                  : data.type === CALL_TYPE.OVERRIDE
                    ? overrideRouteRef.current
                    : ggRouteRef.current,
              stream,
              held: heldLandlines.includes(data.id),
            },
          ]);
        });
      });
    });

    socket.on('unmute', (target: string) => {
      peersRef.current
        .filter((p) => p.peerId === target)
        .forEach((p) => p.peer.send('unmute'));
    });

    socket.on('sound-error', () => {
      error.current?.play();
    });

    return () => {
      socket.off('disconnected');
      socket.off('terminate-landline');
      socket.off('joined-landline');
      socket.off('join-landline');
      socket.off('active-landline');
      socket.off('landline-activated');
      socket.off('denied-landline');
      socket.off('unmute');
      socket.off('left-landline');
      socket.off('mute');
      socket.off('user-joined');
      socket.off('user-signal');
      socket.off('sound-error');
    };
  }, []);
  //#endregion

  const handleButtonPress = (target: string, type: CALL_TYPE) => {
    if (type === CALL_TYPE.NONE) {
      return;
    }
    console.log(target);
    console.log(
      'outgoing',
      outgoingLandlines,
      'incoming',
      incomingLandlines,
      'active',
      activeLandlines,
    );
    const outgoing = outgoingLandlines.find(
      (l) => l.target === target && l.type === type,
    );
    const active = activeLandlines.find(
      (l) => (l.target === target || l.from === target) && l.type === type,
    );
    const incoming = incomingLandlines.find(
      (l) => l.from === target && l.type === type,
    );
    const shout = activeLandlines.find(
      (l) => l.type === CALL_TYPE.SHOUT && l.from.startsWith(`${target}-`),
    );
    if (outgoing) {
      terminateLandline(outgoing.id);
    } else if (active) {
      if (heldLandlines.includes(active.id)) {
        console.log('un-holding', active.id);
        setHeldLandlines((lines) => lines.filter((id) => id !== active.id));
        peersRef
          .current!.filter((p) => p.room === active.id)
          .forEach((p) => p.peer.send('unmute'));
        return;
      }
      if (active.type === CALL_TYPE.OVERRIDE) {
        if (
          active.from ===
          `${props.config.facility.facilityId}-${props.config.sector}`
        ) {
          socket.emit('terminate-landline', active.id);
          return;
        } else if (
          active.target ===
          `${props.config.facility.facilityId}-${props.config.sector}`
        ) {
          // Receiver of OVERRIDE cannot leave the call ever.
          toast.error('Cannot leave an incoming override');
          return;
        }
      } else if (active.type === CALL_TYPE.CONVERTED_SHOUT) {
        // Signal server it should turn back into a SHOUT
        // and we still need to leave it
        socket.emit('convert-shout', active.id);
      }
      leaveLandline(active.id);
    } else if (incoming) {
      joinLandline(incoming.room);
    } else if (shout) {
      console.log('converting shout into 1on1');
      joinLandline(shout.id);
      peersRef
        .current!.filter((p) => p.room === shout.id)
        .forEach((p) => p.peer.send('unmute'));
    } else {
      console.log('target not in any array, assuming new call');
      initiateLandline(target, type);
    }
  };

  const handleRelease = () => {
    const item = activeLandlines[0];
    console.log('release', item);

    if (item) {
      if (item.type === CALL_TYPE.OVERRIDE) {
        if (
          item.from ===
          `${props.config.facility.facilityId}-${props.config.sector}`
        ) {
          socket.emit('terminate-landline', item.id);
          return;
        } else if (
          item.target ===
          `${props.config.facility.facilityId}-${props.config.sector}`
        ) {
          toast.error(`Cannot release an incoming override`);
          // Receiver of OVERRIDE cannot leave the call ever.
          return;
        }
      } else if (item.type === CALL_TYPE.CONVERTED_SHOUT) {
        // Signal server it should turn back into a SHOUT
        // and we still need to leave it
        socket.emit('convert-shout', item.id);
      }
      leaveLandline(item.id);
    } else {
      error.current?.play();
      toast.error(`No active landline to release.`);
    }
  };

  const handleHold = () => {
    const item = activeLandlines.filter(
      (l) => !heldLandlines.includes(l.id),
    )[0];

    if (
      item &&
      item.type !== CALL_TYPE.OVERRIDE &&
      item.type !== CALL_TYPE.SHOUT
    ) {
      console.log('adding to hold', item.id);
      setHeldLandlines((lines) => [...lines, item.id]);
      peersRef
        .current!.filter((p) => p.room === item.id)
        .forEach((p) => p.peer.send('mute'));
    } else {
      toast.error('No active lineline to hold.');
      playError();
    }
  };

  const toggleGg = () => {
    if (ggRouteRef.current === settingsHeadset) {
      ggRouteRef.current = settingsLoudspeaker;
      setGgIsLoud(true);
    } else {
      ggRouteRef.current = settingsHeadset;
      setGgIsLoud(false);
    }
    console.log('toggled g/g route');
    const lines = activeLandlines
      .filter(
        (l) => l.type !== CALL_TYPE.OVERRIDE && l.type !== CALL_TYPE.SHOUT,
      )
      .map((l) => l.id);
    setActivePeers((peers) =>
      peers.map((p) => {
        if (lines.includes(p.room)) {
          return {
            ...p,
            sink: ggRouteRef.current,
          };
        }
        return p;
      }),
    );
  };

  const toggleOverride = () => {
    if (overrideRouteRef.current === settingsHeadset) {
      overrideRouteRef.current = settingsLoudspeaker;
      setOverrideIsLoud(true);
    } else {
      overrideRouteRef.current = settingsHeadset;
      setOverrideIsLoud(false);
    }
    console.log('toggled override route');
    const lines = activeLandlines
      .filter((l) => l.type === CALL_TYPE.OVERRIDE)
      .map((l) => l.id);
    setActivePeers((peers) =>
      peers.map((p) => {
        if (lines.includes(p.room)) {
          return {
            ...p,
            sink: overrideRouteRef.current,
          };
        }
        return p;
      }),
    );
  };

  const settingsEdit = (val: boolean) => {
    setEditSettings(val);
  };

  const saveSettings = (
    ptt: string,
    headset: string,
    loudspeaker: string,
    mic: string,
    volume: number,
    config: string,
  ) => {
    if (ptt) {
      localStorage.setItem('pttKey', ptt);
      setPttKey(ptt);
    }
    if (headset) {
      localStorage.setItem('headset', headset);
      setHeadset(headset);
    }
    if (loudspeaker) {
      localStorage.setItem('loudspeaker', loudspeaker);
      setLoudspeaker(loudspeaker);
    }
    if (volume) {
      localStorage.setItem('volume', volume.toString());
      setVolume(volume);
    }
    if (mic) {
      setMicrophone(mic);
    }
    if (config && props.config.configurations.some((c) => c.name === config)) {
      setSettingsConfiguration(
        props.config.configurations.find((c) => c.name === config)!,
      );
    }
  };

  const playError = () => {
    error.current?.play();
  };

  const disconnect = () => {
    console.log('disconnecting');
    socket.disconnect();
  };

  const setMicrophone = (id: string) => {
    if (id !== settingsMic) {
      localStorage.setItem('microphone', id);
      setMic(id);
      navigator.mediaDevices
        .getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
            deviceId: {
              exact: id,
            },
          },
        })
        .then((mic) => {
          stream.current = mic;
          console.log(
            'updated mic to',
            mic.getAudioTracks()[0].label,
            mic.getAudioTracks()[0].getCapabilities().deviceId,
          );
        });
    }
  };

  return (
    <>
      <SettingsDialog
        edit={editSettings}
        close={settingsEdit}
        saveSettings={saveSettings}
        settings={{
          volume: settingsVolume,
          headset: settingsHeadset,
          loudspeaker: settingsLoudspeaker,
          pttKey: settingsPttKey,
          audioDevices: settingsOutputDevices,
          micDevices: settingsInputDevices,
          mic: settingsMic,
          configurations: props.config.configurations.map((c) => c.name),
          currentConfiguration: props.config.configurations.find(
            (c) => c.name === settingsConfiguration.name,
          )
            ? settingsConfiguration.name
            : '',
        }}
        disconnect={disconnect}
      />
      <div className="app">
        <div id="audio">
          <div id="peers">
            {activePeers.map((peer, i) => (
              <AudioComponent key={i} peerData={peer} volume={settingsVolume} />
            ))}
          </div>
          <div id="sounds">
            <audio ref={rdvsIntercom} playsInline loop>
              <source src="/rdvs/IntercomCall.wav" type="audio/wav" />
            </audio>
            <audio ref={rdvsOverride} playsInline>
              <source src="/rdvs/Override.wav" type="audio/wav" />
            </audio>
            <audio ref={vscsIntercomIncoming} playsInline loop>
              <source src="/vscs/GGChime.wav" type="audio/wav" />
            </audio>
            <audio ref={vscsIntercomOutgoing} playsInline loop>
              <source src="/vscs/Ringback.wav" type="audio/wav" />
            </audio>
            <audio ref={vscsOverride} playsInline>
              <source src="/vscs/Override.mp3" type="audio/mp3" />
            </audio>
            <audio ref={error}>
              <source src="/Error.wav" type="audio/wav" />
            </audio>
          </div>
        </div>

        {props.config ? (
          props.config.panelType === PositionType.VSCS ? (
            <VscsComponent
              activeLandlines={activeLandlines}
              incomingLandlines={incomingLandlines}
              outgoingLandlines={outgoingLandlines}
              heldLandlines={heldLandlines}
              config={settingsConfiguration}
              buttonPress={handleButtonPress}
              holdBtn={handleHold}
              toggleGg={toggleGg}
              ggLoud={ggIsLoud}
              toggleOver={toggleOverride}
              overrideLoud={overrideIsLoud}
              releaseBtn={handleRelease}
              settingsEdit={settingsEdit}
              volume={{
                volume: settingsVolume,
                setVolume,
              }}
              playError={playError}
              metadata={{
                position: props.config.name,
                sector: props.config.sector,
                facilityId: props.config.facility.facilityId,
              }}
            />
          ) : (
            <RdvsComponent
              activeLandlines={activeLandlines}
              incomingLandlines={incomingLandlines}
              outgoingLandlines={outgoingLandlines}
              heldLandlines={heldLandlines}
              config={settingsConfiguration}
              buttonPress={handleButtonPress}
              toggleGg={toggleGg}
              ggRoute={ggIsLoud}
              toggleOver={toggleOverride}
              overrideRoute={overrideIsLoud}
              holdBtn={handleHold}
              releaseBtn={handleRelease}
              settingsEdit={settingsEdit}
              volume={{
                volume: settingsVolume,
                setVolume,
              }}
              playError={playError}
              metadata={{
                position: props.config.name,
                sector: props.config.sector,
                facilityId: props.config.facility.facilityId,
              }}
            />
          )
        ) : (
          <div>Loading configuration . . .</div>
        )}
      </div>
      <ToastContainer
        limit={5}
        newestOnTop={true}
        draggable={false}
        autoClose={2000}
        progressClassName="toastProgress"
        bodyClassName="toastBody"
      />
    </>
  );
}
