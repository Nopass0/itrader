import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';

export interface ItraderConfig {
  orchestrator: {
    start_paused: boolean;
    intervals: {
      work_acceptor: number;
      ad_creator: number;
      receipt_processor: number;
      chat_processor: number;
      order_checker: number;
      chat_monitor: number;
      successer: number;
      gate_balance_setter: number;
    };
  };
  webserver: {
    port: number;
  };
  automation: {
    mode: 'auto' | 'manual';
  };
  gmail: {
    check_interval: number;
  };
  bybit: {
    polling_interval: number;
    max_retries: number;
    retry_delay: number;
  };
  gate: {
    default_balance: number;
  };
  instant_monitor: {
    enabled: boolean;
  };
}

let config: ItraderConfig | null = null;

export function loadConfig(): ItraderConfig {
  if (config) return config;

  const configPath = path.join(process.cwd(), 'config.toml');
  
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    config = toml.parse(configContent) as ItraderConfig;
    console.log('[Config] Loaded configuration from config.toml');
    return config;
  } catch (error) {
    console.warn('[Config] Failed to load config.toml, using defaults:', error);
    
    // Default configuration
    config = {
      orchestrator: {
        start_paused: false,
        intervals: {
          work_acceptor: 300,
          ad_creator: 10,
          receipt_processor: 3600,
          chat_processor: 2,
          order_checker: 3,
          chat_monitor: 1,
          successer: 300,
          gate_balance_setter: 14400,
        },
      },
      webserver: {
        port: 3002,
      },
      automation: {
        mode: 'auto',
      },
      gmail: {
        check_interval: 30,
      },
      bybit: {
        polling_interval: 10000,
        max_retries: 3,
        retry_delay: 5000,
      },
      gate: {
        default_balance: 10000000,
      },
      instant_monitor: {
        enabled: true,
      },
    };
    
    return config;
  }
}

export function getConfig(): ItraderConfig {
  if (!config) {
    return loadConfig();
  }
  return config;
}