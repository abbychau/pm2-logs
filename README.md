# PM2 Logs Viewer

A simple HTTP server to view PM2 process logs through a web interface.

## Features

- View all PM2 processes in a clean web interface
- Access both error and output logs for each process
- View last 50, 100, 200, 500, or 1000 lines of any log file
- Auto-refresh every 10 seconds when viewing logs
- Clean, responsive design
- REST API endpoints for programmatic access

## Installation

1. Clone or download this project
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Option 1: Run with PM2 (Recommended)

1. Start with PM2:
   ```bash
   pm2 start pm2.config.json
   ```

2. Check status:
   ```bash
   pm2 status
   ```

3. View logs:
   ```bash
   pm2 logs pm2-logs-viewer
   ```

4. Stop the service:
   ```bash
   pm2 stop pm2-logs-viewer
   ```

5. Restart the service:
   ```bash
   pm2 restart pm2-logs-viewer
   ```

### Option 2: Run manually

1. Start the server:
   ```bash
   npm start
   ```

2. Open your browser and go to:
   ```
   http://localhost:3002
   ```

3. You'll see a dashboard with all your PM2 processes and their status
4. Click on "ERROR Log" or "OUT Log" buttons to view the respective log files
5. Use the dropdown to change the number of lines displayed (50-1000)

## API Endpoints

- `GET /` - Main dashboard with all processes
- `GET /logs/:processName/:logType` - View log file in browser
- `GET /api/processes` - Get all PM2 processes as JSON
- `GET /api/logs/:processName/:logType?lines=100` - Get log content as JSON

### API Example

```bash
# Get all processes
curl http://localhost:3002/api/processes

# Get last 200 lines of haserver-java error log
curl "http://localhost:3002/api/logs/haserver-java/error?lines=200"
```

## Development

Run in development mode with auto-restart:
```bash
npm run dev
```

### PM2 Management Scripts

The package.json includes convenient PM2 management scripts:

```bash
npm run pm2:start    # Start with PM2
npm run pm2:stop     # Stop the PM2 process
npm run pm2:restart  # Restart the PM2 process
npm run pm2:delete   # Delete the PM2 process
npm run pm2:logs     # View PM2 logs
```

## PM2 Configuration

The `pm2.config.json` file configures the application with the following settings:

- **Process Name**: `pm2-logs-viewer`
- **Auto-restart**: Enabled with 1-second delay
- **Memory Limit**: 500MB (restarts if exceeded)
- **Max Restarts**: 10 attempts
- **Minimum Uptime**: 10 seconds before considering stable
- **Log Management**: Separate error and output log files

## Configuration

- Default port: 3002
- PM2 logs directory: `~/.pm2/logs/`
- Default lines shown: 100
- Auto-refresh interval: 10 seconds

## Requirements

- Node.js
- PM2 installed and running
- Access to PM2 logs directory

## Features in Detail

### Process Dashboard
- Shows all PM2 processes with their status (online/stopped)
- Displays process ID, restart count, CPU usage, and memory usage
- Quick access to both error and output logs

### Log Viewer
- Dark theme for better readability
- Configurable number of lines to display
- Auto-scroll to bottom of logs
- Auto-refresh every 10 seconds
- Raw text format preserving original formatting

### Error Handling
- Graceful handling of missing log files
- Empty log file detection
- Process status updates

Enjoy monitoring your PM2 processes! 🚀
