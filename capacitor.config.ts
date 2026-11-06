import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fluxora.flowpeople",
  appName: "FlowPeople",
  webDir: "dist/client",
  server: {
    androidScheme: "https",
    iosScheme: "https",
  },
  plugins: {
    Geolocation: {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav",
    },
    Device: {},
  },
};

export default config;

