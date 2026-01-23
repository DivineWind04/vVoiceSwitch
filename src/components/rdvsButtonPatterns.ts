// RDVS Button color and pattern config (manual-driven)
export const rdvsButtonPatterns = {
  OVERRIDE: {
    bg: '#000000',
    fg: '#a8dbd8',
    border: '#c35c2f',
    fill: 'solid',
  },
  RING: {
    bg: '#264199',
    fg: '#fff',
    border: '#264199',
    fill: 'solid',
  },
  SHOUT: {
    bg: '#264199',
    fg: '#fff',
    border: '#264199',
    fill: 'solid',
  },
  DIAL: {
    bg: '#264199',
    fg: '#fff',
    border: '#264199',
    fill: 'solid',
  },
  MONITOR: {
    bg: '#444',
    fg: '#fff',
    border: '#888',
    fill: 'dotted',
  },
  SPECIAL: {
    bg: '#8e44ad',
    fg: '#fff',
    border: '#5e3370',
    fill: 'striped',
  },
  DEFAULT: {
    bg: '#264199',
    fg: '#fff',
    border: '#264199',
    fill: 'striped',
  },
};

// Example usage in RDVSPanel:
// import { rdvsButtonPatterns } from './rdvsButtonPatterns';
// const style = rdvsButtonPatterns[btn.type] || rdvsButtonPatterns.DEFAULT;
// <button style={{ background: style.bg, color: style.fg, borderColor: style.border }}></button>
