// PM2 config — keeps the server running permanently
// Install pm2: npm install -g pm2
// Start:   pm2 start ecosystem.config.js
// Auto-start on reboot: pm2 startup && pm2 save

module.exports = {
  apps: [{
    name:        'hkbk-video-portal',
    script:      'server.js',
    cwd:         '/var/www/video-portal',   // change to actual path on server
    instances:   1,
    autorestart: true,
    watch:       false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT:     5500
    }
  }]
}
