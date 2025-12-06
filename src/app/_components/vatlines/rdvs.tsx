import Image from 'next/image';
import { useEffect, useState, useMemo } from 'react';
// TODO: Import or define ActiveLandline, CALL_TYPE, Configuration, IncomingLandline as needed
import { Button, ButtonType, CALL_TYPE, Configuration, ActiveLandline, IncomingLandline } from './types';
type RadioButton = {
  variant: 'radio';
  radioSize: 'short' | 'long';
  label: string;
  value?: string;
  checked?: boolean;
  onChange?: (value: string) => void;
  bgColor?: string;
  textColor?: string;
  labelColor?: string;
  indicatorColor?: string;
  indicatorBg?: string;
};
type ButtonConfig = Button | RadioButton;
interface ButtonLayout {
  order: number;
  button: ButtonConfig;
}
import Controls from './controls';
import RdvsButtonComponent from './rdvs_button';

interface RdvsProps {
  activeLandlines: ActiveLandline[];
  incomingLandlines: IncomingLandline[];
  outgoingLandlines: ActiveLandline[];
  heldLandlines: string[];
  config: Configuration;
  buttonPress: (id: string, type: CALL_TYPE) => void;
  holdBtn: () => void;
  releaseBtn: () => void;
  toggleGg: () => void;
  toggleOver: () => void;
  ggLoud: boolean;
  overrideLoud: boolean;
  settingsEdit: (val: boolean) => void;
  volume: {
    volume: number;
    setVolume: (val: number) => void;
  };
  playError: () => void;
  metadata: {
    position: string;
    sector: string;
    facilityId: string;
  };
}

export default function RdvsComponent(props: RdvsProps) {
  // TED (Telephone Exchange Device) Layout Implementation
  // Based on TI 6650.58 specifications:
  // - 10x10 matrix of cells total
  // - Header row (top): brightness controls, activity display, page controls, IA/OVR/CA
  // - 8x10 interior matrix (80 cells): grouped into 4 quadrants of 5x4 cells each
  // - Footer row (bottom): overflow DA buttons, radio status, HS/LS indicators
  // - Optional page tabs below footer
  
  const [page, setCurrentPage] = useState(1);
  
  const btns: ButtonLayout[] = useMemo(() => {
    return props.config?.layouts || [];
  }, [props.config?.layouts]);
  
  // TED has 80 interior cells (8 rows x 10 columns) per page
  const maxPageMath = Math.ceil(
    (btns.length > 0 ? btns.sort((a, b) => b.order - a.order)[0]?.order || 0 : 0) / 80,
  );
  const maxPage = isNaN(maxPageMath) ? 1 : maxPageMath < 1 ? 1 : maxPageMath;
  // const [func, setFunc] = useState('PRI');
  const [buttons, setButtons] = useState<ButtonConfig[]>(btns.map((l) => l.button));
  const testFunc = (a: string, b: ButtonType) => {
    props.buttonPress(a, CALL_TYPE[b]);
  };

  const playError = () => {
    props.playError();
  };

  const setPage = (val: number) => {
    if (val < 1) {
      setCurrentPage(1);
      playError();
    } else if (val > maxPage) {
      setCurrentPage(maxPage);
      playError();
    } else {
      setCurrentPage(val);
    }
  };

  useEffect(() => {
    // TED layout: 80 interior cells arranged in 8 rows x 10 columns
    const pageButtons = btns.filter(
      (l) => l.order < page * 80 && l.order >= (page - 1) * 80,
    );

    const slice: ButtonConfig[] = [];
    for (let i = (page - 1) * 80; i < page * 80; i++) {
      const found = pageButtons.find((l) => Number(l.order) === i);
      if (found) {
        slice.push(found.button);
      } else {
        // Default to a standard button (shared Button type)
        slice.push({
          id: `empty-${i}`,
          label: '',
          shortName: '',
          longName: '',
          target: '',
          type: ButtonType.NONE,
          dialCode: '',
          layouts: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    setButtons(slice);
  }, [page, btns]);

  useEffect(() => {
    props.outgoingLandlines.forEach((line) => {
      document
        .querySelectorAll(`.${line.target}.${line.type}`)
        .forEach((el) => el.classList.toggle('rdvs-active-call', true));
    });

    let incomingSlow = setInterval(() => {
      props.incomingLandlines.forEach((line) => {
        // document
        //     .querySelectorAll(`.${line.target}.${line.type}`)
        //     .forEach((el) => el.classList.toggle('rdvs-active-call'));
        document
          .querySelectorAll(`.${line.from}.${line.type}`)
          .forEach((el) => el.classList.toggle('rdvs-active-call'));
      });
    }, 750);

    let activeFast = setInterval(() => {
      props.activeLandlines.forEach((line) => {
        if (props.heldLandlines.includes(line.id)) {
          document
            .querySelectorAll(`.${line.target}.${line.type}`)
            .forEach((el) => el.classList.toggle('rdvs-held', true));
          document
            .querySelectorAll(`.${line.from}.${line.type}`)
            .forEach((el) => el.classList.toggle('rdvs-held', true));
        } else {
          document
            .querySelectorAll(`.${line.target}.${line.type}`)
            .forEach((el) => el.classList.toggle('rdvs-active-call'));
          document
            .querySelectorAll(`.${line.from}.${line.type}`)
            .forEach((el) => el.classList.toggle('rdvs-active-call'));
        }
      });
    }, 250);
    return () => {
      clearInterval(incomingSlow);
      clearInterval(activeFast);
      document.querySelectorAll('.rdvs-button').forEach((el) => {
        el.classList.toggle('rdvs-active-call', false);
        el.classList.toggle('rdvs-held', false);
      });
    };
  }, [
    props.activeLandlines,
    props.heldLandlines,
    props.incomingLandlines,
    props.outgoingLandlines,
  ]);

  return (
    <>
      <div className="rdvs-panel select-none p-2 text-[#008000] bg-black">
        <div className="top-row grid grid-cols-4 mb-2">
          <div className="brightness flex">
            <div className="bright w-16 text-center flex flex-col items-center" onClick={playError}>
              <span>Bright</span>
              <span className="inline-block w-8 h-8 rounded-full border-2 border-white bg-black mt-0.5"></span>
            </div>
            <div id="brightness" className="px-2 pt-8">
              100%
            </div>
            <div className="dim w-8 text-center flex flex-col items-center" onClick={playError}>
              <span>Dim</span>
              <span className="inline-block w-8 h-8 rounded-full border-2 border-white bg-black mt-0.5"></span>
            </div>
          </div>
          <div className="top-page grid grid-rows-3 leading-none">
            <div className="current-page flex-initial pl-8">Page {page}</div>
            <div className="flex">
              <div
                className="cursor-pointer mr-3"
                onClick={() => setPage(page - 1)}
              >
                <Image
                  src="/rdvs/prev-arrow.svg"
                  width={75}
                  height={75}
                  alt="Prev"
                  style={{ width: '75px', height: '40px' }}
                />
              </div>
              <div className="cursor-pointer" onClick={() => setPage(page + 1)}>
                <Image
                  src="/rdvs/next-arrow.svg"
                  width={75}
                  height={75}
                  alt="Next"
                  style={{ width: '75px', height: '40px' }}
                />
              </div>
            </div>
            <div className="total-pages flex-initial pl-10">of {maxPage}</div>
          </div>
          <div className="ia-ovr-ca flex text-center">
            <div className="ia w-10">
              IA
              <br />
              <span className="border">&nbsp;&nbsp;</span>
            </div>
            <div className="ovr w-10">
              OVR <br />
              <span className="mx-auto border border-[#008000]">&nbsp;</span>
            </div>
            <div className="ca w-10">
              CA <br />
              <span className="border">&nbsp;&nbsp;</span>
            </div>
          </div>
          <div className="messages border"></div>
        </div>
        
        {/* TED Interior Matrix - 8 rows x 10 columns = 80 cells, with radio buttons in top right quadrant */}
        <div className="grid grid-cols-10 gap-x-2 gap-y-2">
          {(() => {
            const radioBtns = buttons.filter(btn => btn.variant === 'radio');
            const nonRadioBtns = buttons.filter(btn => btn.variant !== 'radio');
            // Place radio buttons in the top row, rightmost columns
            const cells = [];
            for (let i = 0; i < 80; i++) {
              // Top row: i = 0..9
              if (i >= 7 && i < 7 + radioBtns.length) {
                // Place radio buttons in columns 7, 8, 9
                const radioBtn = radioBtns[i - 7] as RadioButton;
                cells.push(
                  <div key={`radio-cell-${i}`} className="mr-2">
                    <RdvsButtonComponent
                      variant="radio"
                      label={radioBtn.label}
                      value={radioBtn.value || ''}
                      checked={radioBtn.checked || false}
                      onChange={radioBtn.onChange || (() => {})}
                      radioSize={radioBtn.radioSize}
                      bgColor={radioBtn.bgColor}
                      textColor={radioBtn.textColor}
                      labelColor={radioBtn.labelColor}
                      indicatorColor={radioBtn.indicatorColor}
                      indicatorBg={radioBtn.indicatorBg}
                    />
                  </div>
                );
              } else {
                // Fill with non-radio buttons in order
                const stdBtn = nonRadioBtns.shift() as Button | undefined;
                
                // Check if this is a spacer (empty label, id, and type)
                const isSpacer = stdBtn && 
                  (!stdBtn.label || stdBtn.label.trim() === '') && 
                  (!stdBtn.id || stdBtn.id.trim() === '') && 
                  (stdBtn.type === '' || stdBtn.type === ButtonType.NONE || !stdBtn.type);
                
                if (isSpacer) {
                  // Render a spacer div with the same dimensions as a button
                  cells.push(
                    <div key={`spacer-${i}`} className="w-[70px] h-[50px]"></div>
                  );
                } else if (stdBtn && typeof stdBtn.type !== 'undefined') {
                  cells.push(
                    <RdvsButtonComponent
                      key={`std-${i}`}
                      config={stdBtn}
                      typeString={stdBtn.type ? stdBtn.type.toString().substring(0, 1) : ''}
                      callback={testFunc}
                      className={`${stdBtn.target} ${stdBtn.type} rdvs-button ${
                        stdBtn.type === ButtonType.OVERRIDE ? 'rdvs-red' : 'rdvs-green'
                      } ${
                        stdBtn.type !== ButtonType.NONE
                          ? 'cursor-pointer'
                          : 'cursor-not-allowed invisible'
                      }`}
                    />
                  );
                } else {
                  // Render an empty cell if no button is available
                  cells.push(<div key={`empty-${i}`}></div>);
                }
              }
            }
            return cells;
          })()}
        </div>
        <div className="bottom-bar flex tracking-tight">
          <div className="pages flex mt-auto px-2">
            {[...Array(maxPage)].map((_x, i) => (
              <div
                key={i}
                className="cursor-pointer flex items-center justify-center"
                onClick={() => setPage(i + 1)}
                style={{ width: 80, height: 36 }}
              >
                <Image
                  src={`/rdvs/Page${i + 1}.svg`}
                  alt={`Page ${i + 1}`}
                  width={80}
                  height={36}
                  style={{ width: '80px', height: '36px' }}
                />
              </div>
            ))}
          </div>
          <div className="flex-grow"></div>
          <div className="hsls">
            <div className="hs text-red-600">
              <span className="border border-[#008000] text-white mr-1">
                HS
              </span>
              &#9675;
            </div>
            <div className="ls text-red-600">
              <span className="border border-[#008000] text-white mr-1">
                LS
              </span>
              &#9675;
            </div>
          </div>
        </div>
        <Controls
          handleClick={props.settingsEdit}
          volume={props.volume.volume}
          setVolume={props.volume.setVolume}
          metadata={props.metadata}
        />
      </div>
    </>
  );
}
