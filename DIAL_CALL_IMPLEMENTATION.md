# Dial Call Implementation Guide

## Overview
This implementation adds dial call functionality to the RDVS interface, following the traditional telephone system workflow: trunk selection → number dialing → call establishment.

## Implementation Components

### 1. **DialInterface Component** (`/src/app/_components/vatlines/dial_interface.tsx`)

**Features:**
- **Trunk Selection**: Choose from available trunk lines (Local, Long Distance, Emergency)
- **Number Dialing**: Standard telephone keypad with digits 0-9, *, #
- **Real-time Status**: Displays call progress (Dialing, Ring-back, Connected, Busy, No Answer)
- **WebSocket Integration**: Monitors call state changes from backend
- **Call Control**: Hangup, Retry, Clear functions

**User Workflow:**
1. Click "DIAL" button in RDVS interface
2. Select trunk type (Ring, Override, or Direct)
3. Enter telephone number using keypad
4. Press "CALL" to initiate
5. Monitor ring-back tone and call status
6. Call establishes when destination answers
7. Use "HANGUP" to terminate call

### 2. **WebSocket Message Protocol**

**New Message Types:**

```typescript
// Trunk Selection
{ type: 'trunk_select', cmd1: 'trunk_id', dbl1: call_type }

// Number Dialing  
{ type: 'dial', cmd1: 'telephone_number', dbl1: trunk_number }

// Call Hangup
{ type: 'stop', cmd1: 'DIAL_trunk_number', dbl1: trunk_type }
```

**Enhanced Channel Status:**
```typescript
{
  call: 'DIAL_trunk_01_5551234',
  status: 'dialing' | 'ringback' | 'connected' | 'busy' | 'no_answer',
  dial_number: '555-1234',
  trunk_id: 'trunk_01',
  call_type: 'DIAL'
}
```

### 3. **Integration Points**

**RDVS Interface:**
- Added "DIAL" button in bottom-right corner
- Modal overlay for dial interface
- Trunk configuration in RDVSWrapper

**Model Updates:**
- Enhanced `channel_status` processing for DIAL calls
- Audio cue handling for ring-back and busy signals
- State management for dial call lifecycle

## Technical Architecture

### Call State Flow
```
trunk_select → dialing → calling → connected
                    ↓         ↓
                   busy   no_answer
```

### WebSocket Data Flow
```
UI → trunk_select → Backend
UI → dial → Backend → ringback → UI
Backend → connected → UI
UI → stop → Backend
```

### Audio Integration
- **Ring-back**: Plays during 'ringback' status
- **Busy Signal**: Plays during 'busy' status  
- **Call Connected**: Stops all audio cues
- Uses existing audio elements from current system

## Backend Requirements

The backend needs to implement:

1. **Trunk Management**
   - Handle `trunk_select` messages
   - Route calls through appropriate trunk lines
   - Manage trunk availability/busy status

2. **Dial Processing**
   - Parse `dial` messages with telephone numbers
   - Initiate calls to external telephone system
   - Generate appropriate call IDs (`DIAL_trunk_number`)

3. **Call State Updates**
   - Send `channel_status` updates for dial calls
   - Include dial-specific statuses (ringback, busy, no_answer)
   - Handle call termination and cleanup

4. **Audio/Tone Generation**
   - Ring-back tone during call setup
   - Busy signal for busy destinations
   - Call progress tones as needed

## Usage Example

```typescript
// User selects Trunk 1 and dials 555-1234

// 1. Trunk Selection
sendMsg({ type: 'trunk_select', cmd1: 'trunk_01', dbl1: 1 })

// 2. Number Dialing
sendMsg({ type: 'dial', cmd1: '5551234', dbl1: 1 })

// 3. Backend Response
{
  call: 'DIAL_trunk_01_5551234',
  status: 'ringback',
  dial_number: '555-1234',
  trunk_id: 'trunk_01'
}

// 4. Call Connects
{
  call: 'DIAL_trunk_01_5551234', 
  status: 'connected'
}

// 5. Hangup
sendMsg({ type: 'stop', cmd1: 'DIAL_trunk_01_5551234', dbl1: 1 })
```

## Configuration

**Available Trunks** (configurable in RDVSWrapper):
```typescript
const availableTrunks = [
  { id: 'trunk_01', name: 'Trunk 1 - Local', type: 'ring' },
  { id: 'trunk_02', name: 'Trunk 2 - Long Distance', type: 'ring' },
  { id: 'trunk_03', name: 'Trunk 3 - Emergency', type: 'override' },
];
```

**Call Types:**
- `ring` (dbl1: 1) - Standard ring-down calls
- `override` (dbl1: 0) - Emergency/override calls  
- `direct` (dbl1: 2) - Direct connect calls

## Benefits

1. **Realistic Operation**: Follows actual telephone system procedures
2. **Flexible Trunking**: Supports different trunk types and routing
3. **Visual Feedback**: Clear status indicators and progress updates
4. **Audio Integration**: Ring-back and busy tones for operator awareness
5. **Error Handling**: Retry capability for failed calls
6. **WebSocket Native**: Integrates seamlessly with existing architecture

This implementation provides a complete dial call system that matches real-world telephone operations while integrating naturally with the existing RDVS interface and WebSocket communication system.