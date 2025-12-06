import { Col, Row } from "antd";
console.log('[VSCSPanel] Rendering VSCSPanel');
import { useCoreStore } from "./model";
import HSIcon from '../public/headphone.svg'
import LSIcon from '../public/speaker.svg'
import { useState } from "react";

function AGRow({ data }: { data: any }) {
    const ptt = useCoreStore(s => s.ptt)
    const sendMsg = useCoreStore(s => s.sendMessageNow)
    const selected_icon_border = '1px solid #fffd46'
    if (!data) {
        return <div className="ag-row empty">
            <div className="button button-rect"></div>
            <div className="button"></div>
            <div className="button"></div>
            <div className="button"></div>
            <div className="button"></div>
        </div>
    }
    return <>
        <div className="ag-row">
            <div className="button button-rect" onClick={() => {
                sendMsg({ type: 'set_hs', cmd1: "" + data.freq, dbl1: !data.h })
            }}>
                <div style={{ height: 10, position: 'absolute', top: 5, left: 2, }}>
                    <HSIcon style={{ width: 20, fill: 'white', transform: 'scale(-1,1)', border: selected_icon_border }} />
                </div>
                <div style={{ height: 10, position: 'absolute', top: 5, right: 2 }}>
                    {data.h ? <HSIcon style={{ width: 20, fill: 'white', transform: 'scale(-1,1)' }} /> :
                        <LSIcon style={{ width: 18, fill: 'white', transform: 'scale(-1,1)' }} />
                    }
                </div>
                <div style={{ height: 15 }}></div>
                <div style={{ fontSize: 22 }}>{Math.floor(data.freq / 10000) / 100}</div>
            </div>
            <div className="button" onClick={() => {
                sendMsg({ type: 'tx', cmd1: "" + data.freq, dbl1: !data.t })
            }}>
                <span className="text">TX SEL</span>
                <div className={data.t ? ptt ? "flutter active" : "steady green" : ""}>
                    <div className="ct">
                        <div className="inner">
                        </div>
                    </div>
                </div>
            </div>

            <div className={"button"} onClick={() => {
                sendMsg({ type: 'rx', cmd1: "" + data.freq, dbl1: !data.r })
            }}>
                <span className="text">RX SEL</span>
                <div className={data.r ? data.talking ? "flutter active" : "steady green" : ""}>
                    <div className="ct">
                        <div className="inner">
                        </div>
                    </div>
                </div>
            </div>

            <div className="button" onClick={() => {

            }}>
                <span className="text">TX MAIN</span>
                <div className={"steady green"}>
                    <div className="ct">
                        <div className="inner">
                        </div>
                    </div>
                </div>
            </div>
            <div className="button" onClick={() => {

            }}>
                <span className="text">RX MAIN</span>
                <div className={"steady green"}>
                    <div className="ct">
                        <div className="inner">
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </>
}

function AGPanel() {
    const ag_status = useCoreStore(s => s.ag_status)

    const ITEM_PER_PAGE = 6
    const [page, setPage] = useState(1)
    // Implement overflow logic: if there are more frequencies than can fit on page 1, 
    // automatically overflow them to page 2
    let current_slice;
    if (page === 1) {
      // Page 1: show first ITEM_PER_PAGE items
      current_slice = ag_status.slice(0, ITEM_PER_PAGE);
    } else if (page === 2) {
      // Page 2: show overflow items (items beyond ITEM_PER_PAGE)
      const slice = ag_status.slice(ITEM_PER_PAGE);
      // Limit to ITEM_PER_PAGE items
      current_slice = slice.slice(0, ITEM_PER_PAGE);
    } else {
      // For other pages, use existing logic
      current_slice = ag_status.slice((page - 1) * ITEM_PER_PAGE, (page) * ITEM_PER_PAGE - 1);
    }
    
    if (current_slice.length < ITEM_PER_PAGE) {
        current_slice.push(...new Array(ITEM_PER_PAGE - current_slice.length))
    }
    return <div className="ag-panel">
        {current_slice.map(k => <AGRow data={k} />)}
        <div className="ag-row">
            <div className="button button-rect"><span className="text">SUMM</span></div>
            {page == 1 ? <div className="button" onClick={() => setPage(2)}><span className="text">A/G2</span></div> :
                <div className="button" onClick={() => setPage(1)}><span className="text">A/G1</span></div>}
            <div className="button" onClick={() => setPage(3)}><span className="text">A/G3</span></div>
            <div className="button" onClick={() => setPage(4)}><span className="text">A/G4</span></div>
            <div className="button" onClick={() => setPage(5)}><span className="text">A/G5</span></div>
        </div>
    </div>
}

function GGButton({ data }: { data: any }) {
    // {data.status}
    const [v, setV] = useState(0)
    const sendMsg = useCoreStore(s => s.sendMessageNow)
    const ptt = useCoreStore(s => s.ptt)
    if (!data) {
        return <div className="button empty"></div>
    }
    const call_type = data?.call?.substring(0, 2)
    const call_id = data.call?.substring(3)
    const d = ['steady green', 'steady red', 'flutter active', 'flutter receive', 'flutter inuse', 'flutter hold']
    let csn = ''
    let onClick = () => {
        setV(v > 4 ? 0 : v + 1)
    }
    if (call_type == 'SO') {
        if (data.status === 'idle') {
            onClick = () => {
                sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 })
            }
        } else if (data.status === 'online' || data.status === 'chime') {
            csn = 'flutter receive flashing'
            onClick = () => {
                sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 })
            }
        } else if (data.status === 'ok') {
            csn = ptt ? 'flutter active' : 'steady green'
            onClick = () => {
                sendMsg({ type: 'stop', cmd1: call_id, dbl1: 1 });
            }
        }
    } else {
        if (data.status === 'off' || data.status === '') {
            // nothing
            onClick = () => {
                sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 })
            }
        } else if (data.status === 'busy') {
            csn = 'steady red'
            onClick = () => {}
        } else if (data.status === 'hold') {
            csn = 'flutter hold'
            onClick = () => {}
        } else if (data.status === 'pending' || data.status === 'terminate') {
            onClick = () => {}
        } else if (data.status === 'ok' || data.status === 'active') {
            onClick = () => {
                sendMsg({ type: 'stop', cmd1: call_id, dbl1: 2 })
            }
            if (ptt || data.status === 'active') {
                csn = 'flutter active'
            } else {
                csn = 'steady green'
            }
        } else if (data.status === 'chime' || data.status === 'ringing') {
            csn = 'flutter receive flashing'
            onClick = () => {
                sendMsg({ type: 'stop', cmd1: call_id, dbl1: 2 })
            }
        } else {
            // csn = d[v]
        }
    }


    return <div className="button" onClick={onClick}>
        <span className="text">{data.call_name || data.call}</span>
        <div className={csn}>
            <div className="ct">
                <div className="inner">

                </div>
            </div>

        </div>
    </div>
}

function GGPanel() {
    const gg_status = useCoreStore(s => s.gg_status)
    const ITEM_PER_PAGE = 18
    const [page, setPage] = useState(1)
    // Implement overflow logic: if there are more G/G entries than can fit on page 1,
    // automatically overflow them to page 2
    let current_slice;
    if (page === 1) {
      // Page 1: show first ITEM_PER_PAGE items
      current_slice = gg_status.slice(0, ITEM_PER_PAGE);
    } else if (page === 2) {
      // Page 2: show overflow items (items beyond ITEM_PER_PAGE)
      const slice = gg_status.slice(ITEM_PER_PAGE);
      // Limit to ITEM_PER_PAGE items
      current_slice = slice.slice(0, ITEM_PER_PAGE);
    } else {
      // For other pages, use existing logic
      current_slice = gg_status.slice((page - 1) * ITEM_PER_PAGE, (page) * ITEM_PER_PAGE);
    }
    
    if (current_slice.length < ITEM_PER_PAGE) {
        current_slice.push(...new Array(ITEM_PER_PAGE - current_slice.length))
    }
    return <>
        <div className="gg-panel button-container">
            {current_slice.map(k => <GGButton data={k} />)}
            <div className="button" onClick={() => setPage(Math.max(1, page - 1))}>Page Up</div>
            <div className="button" onClick={() => setPage(Math.min(Math.ceil(gg_status.length / ITEM_PER_PAGE), page + 1))}>Page Down</div>
            <div className="button empty"></div>
        </div>

    </>
}
function Panel() {
    console.log('[VSCSPanel] Panel component called');
    try {
        return <div style={{ background: 'black', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            <div style={{ width: 800, display: 'flex', padding: '10px 10px' }}>
                <AGPanel />
                <GGPanel />
            </div>
        </div>;
    } catch (e) {
        console.error('[VSCSPanel] Error rendering Panel:', e);
        return <div style={{ color: 'red' }}>[VSCSPanel] Error rendering VSCS UI: {String(e)}</div>;
    }
}

export default Panel;