module.exports = {
  apps: [
    {
      name: 'attendease-backend',
      script: './backend/dist/main.js',
      interpreter: '/home/test/.nvm/versions/node/v20.20.1/bin/node',
      cwd: '/home/test/Desktop/full-stack-app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_file: './backend/.env',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'attendease-https',
      script: './https-server.js',
      interpreter: '/home/test/.nvm/versions/node/v20.20.1/bin/node',
      cwd: '/home/test/Desktop/full-stack-app',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};
