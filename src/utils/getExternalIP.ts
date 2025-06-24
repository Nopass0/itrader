import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { createLogger } from '../logger';

const execAsync = promisify(exec);
const logger = createLogger('ExternalIP');

/**
 * Get external IP address
 */
export async function getExternalIP(): Promise<string | null> {
  // First, check environment variable
  if (process.env.EXTERNAL_IP) {
    return process.env.EXTERNAL_IP;
  }

  // Try multiple methods to get external IP
  const methods = [
    // Method 1: Use curl to ipify
    async () => {
      try {
        const { stdout } = await execAsync('curl -s https://api.ipify.org');
        return stdout.trim();
      } catch (error) {
        return null;
      }
    },
    
    // Method 2: Use axios to ipify
    async () => {
      try {
        const response = await axios.get('https://api.ipify.org?format=text', {
          timeout: 5000
        });
        return response.data.trim();
      } catch (error) {
        return null;
      }
    },
    
    // Method 3: Use ifconfig.me
    async () => {
      try {
        const { stdout } = await execAsync('curl -s https://ifconfig.me');
        return stdout.trim();
      } catch (error) {
        return null;
      }
    },
    
    // Method 4: Use icanhazip.com
    async () => {
      try {
        const { stdout } = await execAsync('curl -s https://icanhazip.com');
        return stdout.trim();
      } catch (error) {
        return null;
      }
    }
  ];

  // Try each method
  for (const method of methods) {
    const ip = await method();
    if (ip && isValidIP(ip)) {
      logger.info('External IP detected', { ip });
      return ip;
    }
  }

  logger.warn('Failed to detect external IP');
  return null;
}

/**
 * Validate IP address format
 */
function isValidIP(ip: string): boolean {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

/**
 * Get server URLs for display
 */
export async function getServerURLs(port: number): Promise<{
  local: string;
  external: string | null;
}> {
  const externalIP = await getExternalIP();
  
  return {
    local: `http://localhost:${port}`,
    external: externalIP ? `http://${externalIP}:${port}` : null
  };
}