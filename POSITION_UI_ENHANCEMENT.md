# Position-Based UI Selection Enhancement

## ✅ Completed Work

### 1. Enhanced PanelType Enum
The `PanelType` enum in `src/types/vatlines_types.ts` now includes all UI types:
```typescript
export enum PanelType {
  RDVS = 'RDVS',
  VSCS = 'VSCS',
  ETVS = 'ETVS',
  STVS = 'STVS', 
  IVSR = 'IVSR',
}
```

### 2. Enhanced Audio System
The audio system in `src/model.ts` now:
- Detects UI context from both URL path AND position data
- Automatically refreshes audio elements when position is selected
- Uses position-specific audio files based on `ui` or `panelType` field
- Supports all UI types: VSCS, RDVS, ETVS, STVS, IVSR

#### Audio Mapping:
- **VSCS**: `Ringback.wav` + `GGChime.mp3`
- **RDVS**: `Ringback.wav` + `GGChime.mp3`  
- **ETVS**: `Override_Term.wav` + `RDVS_Chime.m4a`
- **STVS**: `Override_Term.wav` + `RDVS_Chime.m4a`
- **IVSR**: `Override_Term.wav` + `RDVS_Chime.m4a`

## 🔧 Next Steps Required

### 3. Complete App.tsx Enhancement
The main rendering logic in `src/app/_components/vatlines/App.tsx` needs to be enhanced to support all UI types. Currently it only supports VSCS vs RDVS:

**Current Logic (Lines 1027+):**
```tsx
{props.config.panelType === PositionType.VSCS ? (
  <VscsComponent {...props} />
) : (
  <RdvsComponent {...props} />
)}
```

**Enhanced Logic Needed:**
```tsx
{(() => {
  switch (props.config.panelType) {
    case PositionType.VSCS:
      return <VscsComponent {...props} />;
    case PositionType.ETVS:
      return <EtvsComponent {...props} />;
    case PositionType.STVS:
      return <StvsComponent {...props} />;
    case PositionType.IVSR:
      return <IvsrComponent {...props} />;
    case PositionType.RDVS:
    default:
      return <RdvsComponent {...props} />;
  }
})()}
```

### 4. Component Imports Needed
Add these imports to App.tsx:
```tsx
import EtvsPanel from '../../../etvs-src/app/page';
import StvsBase from '../../stvs/StvsBase';
// Note: IVSR component needs to be identified/created
```

### 5. Component Wrapper Creation
Create wrapper components to ensure proper props passing:

**EtvsComponent.tsx:**
```tsx
import React from 'react';
import EtvsPanel from '../../../etvs-src/app/page';

interface EtvsComponentProps {
  // Define props that EtvsPanel expects
}

export default function EtvsComponent(props: EtvsComponentProps) {
  return <EtvsPanel />;
}
```

**StvsComponent.tsx:**
```tsx
import React from 'react';
import StvsBase from '../../stvs/StvsBase';

interface StvsComponentProps {
  // Define props that StvsBase expects
}

export default function StvsComponent(props: StvsComponentProps) {
  return <StvsBase />;
}
```

## 📋 Implementation Status

- [x] **PanelType enum** - All UI types defined
- [x] **Audio system** - Position-aware audio selection
- [ ] **App.tsx rendering** - Switch statement for all UI types
- [ ] **Component imports** - Import ETVS, STVS, IVSR components  
- [ ] **Component wrappers** - Ensure proper props interface
- [ ] **Testing** - Verify position selection triggers correct UI

## 🎯 Benefits When Complete

1. **Automatic UI Selection**: Selecting a position in settings will automatically render the correct UI
2. **Proper Audio**: Each UI will use its specific audio files automatically
3. **Centralized Logic**: One App.tsx handles all UI routing based on position data
4. **Configuration Driven**: Position JSON data drives UI selection via `ui` or `panelType` field

## 📝 Position Data Structure

The system supports position data with either field:
```json
{
  "cs": "ABC_TWR",
  "pos": "Tower",
  "ui": "etvs",        // From JSON files
  "panelType": "ETVS"  // From database
}
```

The enhanced audio system will automatically detect and use the appropriate audio files based on the selected position's UI type.