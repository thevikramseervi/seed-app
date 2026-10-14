#!/bin/bash
set -e

echo "Building frontend..."
cd /home/test/Desktop/full-stack-app/frontend
npm run build

echo "Deploying to /var/www/html/..."
sudo cp -r /home/test/Desktop/full-stack-app/frontend/dist/* /var/www/html/
sudo chmod -R 755 /var/www/html/

echo "Done! App deployed."
