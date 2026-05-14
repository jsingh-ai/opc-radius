export const config = {
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || "127.0.0.1",
  shopfloor: {
    baseUrl: process.env.SHOPFLOOR_API_BASE_URL || "https://fsmradiusapi.fivestar.com",
    apiKey: process.env.SHOPFLOOR_API_KEY || "",
    kco: process.env.SHOPFLOOR_KCO || "2",
    plantCode: process.env.SHOPFLOOR_PLANT_CODE || "2",
    machPrefix: process.env.SHOPFLOOR_MACH_PREFIX || "2",
    includeEventDetails: process.env.SHOPFLOOR_INCLUDE_EVENT_DETAILS || "false"
  },
  postgres: {
    url: process.env.DATABASE_URL || "",
    sslMode: process.env.DATABASE_SSL_MODE || "prefer"
  }
};
