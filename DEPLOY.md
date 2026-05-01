# Deploy Instructions for College Server

## The Problem
The site shows a blank page because only static files are being served.
The Node.js backend (server.js) is NOT running on the server.

## Fix — 3 Steps

### Step 1: Upload the project to the server
Upload the entire video-portal folder to the server (e.g. /var/www/video-portal)
Make sure these folders exist on the server:
- /var/www/video-portal/data/        (for the database)
- /var/www/video-portal/uploads/     (for uploaded videos)

### Step 2: Install dependencies and start the server with PM2
Run these commands on the college server (SSH in first):

```bash
cd /var/www/video-portal
npm install
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup     # makes it auto-start on reboot
pm2 save
pm2 status      # should show "online"
```

### Step 3: Configure Nginx
Replace the current nginx config with the one in nginx.conf:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/drive.hkbkce.in
sudo nginx -t          # test config
sudo systemctl reload nginx
```

## Verify it's working
```bash
pm2 status                          # should show "online"
curl http://localhost:5500/api/counts   # should return JSON not HTML
```

## If you see JSON from the curl above — it's working!
Open https://drive.hkbkce.in in browser.
