import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() || 'https://hris.rdhardware.com';

const config: CapacitorConfig = {
  appId: 'com.plmiranda.employeeportal',
  appName: 'Employee Portal',
  webDir: 'mobile-shell',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
  },
};

export default config;
