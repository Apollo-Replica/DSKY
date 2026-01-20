/**
 * PM2 ecosystem for `next-dsky`.
 *
 * Usage:
 *   - Build once: `npm run build`
 *   - Start:      `pm2 start pm2.ecosystem.config.js`
 *   - Logs:       `pm2 logs next-dsky`
 */
module.exports = {
  apps: [
    {
      name: "next-dsky",
      cwd: __dirname,

      // Use the existing production script from package.json:
      //   "start": "cross-env NODE_ENV=production tsx server.ts"
      // This is the simplest/most reliable on Ubuntu.
      script: "npm",
      args: "run start",
      interpreter: "none",

      env: {
        NODE_ENV: "production",
        DISABLE_RESET: "1",
      },

      autorestart: true,
      watch: false,
      time: true,
      max_memory_restart: "300M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};

