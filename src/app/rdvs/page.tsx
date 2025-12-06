'use client';
import RdvsComponent from '../_components/vatlines/rdvs';
import { type Configuration } from '../_components/vatlines/App';
import { useEffect, useState } from 'react';

// Mock configuration as fallback
const mockConfiguration: Configuration = {
  id: 'mock-config',
  name: 'Mock RDVS Configuration',
  layouts: [
    {
      order: 0,
      button: {
        shortName: 'LC1',
        longName: 'Local Control 1',
        target: 'LC1',
        type: 'OVERRIDE' as any,
        dialCode: '5001'
      }
    },
    {
      order: 1,
      button: {
        shortName: 'LC2',
        longName: 'Local Control 2',
        target: 'LC2',
        type: 'OVERRIDE' as any,
        dialCode: '5002'
      }
    },
    {
      order: 2,
      button: {
        shortName: 'TWR',
        longName: 'Tower',
        target: 'TWR_CONTROL',
        type: 'SHOUT' as any,
        dialCode: '101'
      }
    },
    {
      order: 10,
      button: {
        shortName: 'GND',
        longName: 'Ground Control',
        target: 'GND_CONTROL',
        type: 'SHOUT' as any,
        dialCode: '102'
      }
    },
    {
      order: 11,
      button: {
        shortName: 'EMER',
        longName: 'Emergency',
        target: 'EMERGENCY',
        type: 'OVERRIDE' as any,
        dialCode: '911'
      }
    }
  ]
};

// Simple TED configuration loader
const loadTedConfiguration = async (): Promise<Configuration | null> => {
  try {
    const response = await fetch('/ted-layout-config.json');
    if (!response.ok) {
      console.warn('TED configuration not found, using mock configuration');
      return mockConfiguration;
    }
    
    const tedConfig = await response.json();
    
    // Apply color scheme to CSS variables
    if (tedConfig.colorScheme && tedConfig.availableColors) {
      const root = document.documentElement;
      const { colorScheme, availableColors } = tedConfig;

      // Apply screen colors
      const screenTextColor = availableColors.colors[colorScheme.screenColors.text];
      const screenBgColor = availableColors.colors[colorScheme.screenColors.background];
      
      if (screenTextColor) root.style.setProperty('--ted-screen-text', screenTextColor);
      if (screenBgColor) root.style.setProperty('--ted-screen-background', screenBgColor);

      // Apply button color sets
      const colorSets = ['normal', 'significantDA', 'utility', 'significantRadio'];
      colorSets.forEach((setName, index) => {
        const setNumber = index + 1;
        const colorSet = colorScheme.buttonColorSets[setName];
        if (colorSet) {
          const textColor = availableColors.colors[colorSet.text];
          const bgColor = availableColors.colors[colorSet.background];
          
          if (textColor) root.style.setProperty(`--ted-color${setNumber}-text`, textColor);
          if (bgColor) root.style.setProperty(`--ted-color${setNumber}-background`, bgColor);
        }
      });
    }
    
    // Convert TED configuration to legacy format
    const layouts: any[] = [];
    if (tedConfig.buttonLayout?.pages) {
      tedConfig.buttonLayout.pages.forEach((page: any) => {
        page.buttons.forEach(({ position, buttonConfig }: any) => {
          layouts.push({
            order: position + (page.pageNumber - 1) * 80,
            button: buttonConfig
          });
        });
      });
    }

    return {
      id: 'ted-config',
      name: tedConfig.metadata?.description || 'TED Configuration',
      layouts
    };
  } catch (error) {
    console.error('Error loading TED configuration:', error);
    return mockConfiguration;
  }
};

export default function RdvsPage() {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const loadedConfig = await loadTedConfiguration();
        setConfig(loadedConfig || mockConfiguration);
      } catch (error) {
        console.error('Error loading configuration:', error);
        setConfig(mockConfiguration);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-green-500">
        <div>Loading TED Configuration...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-red-500">
        <div>Failed to load configuration</div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-black p-4">
      <RdvsComponent
        activeLandlines={[]}
        incomingLandlines={[]}
        outgoingLandlines={[]}
        heldLandlines={[]}
        config={config}
        buttonPress={() => {}}
        toggleGg={() => {}}
        ggRoute={false}
        toggleOver={() => {}}
        overrideRoute={false}
        holdBtn={() => {}}
        releaseBtn={() => {}}
        settingsEdit={() => {}}
        volume={{
          volume: 50,
          setVolume: () => {},
        }}
        playError={() => {}}
        metadata={{
          position: 'RDVS Demo',
          sector: 'DEMO',
          facilityId: 'TEST',
        }}
      />
    </div>
  );
}