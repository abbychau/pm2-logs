const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const app = express();
const PORT = 3002;

// Serve static files (CSS, JS)
app.use(express.static('public'));

// PM2 logs directory
const PM2_LOGS_DIR = path.join(os.homedir(), '.pm2', 'logs');

// Function to get all PM2 processes
function getPM2Processes() {
    return new Promise((resolve, reject) => {
        exec('pm2 jlist', (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            try {
                const processes = JSON.parse(stdout);
                resolve(processes);
            } catch (e) {
                reject(e);
            }
        });
    });
}

// Function to get last N lines of a file
function getLastLines(filePath, lines = 100) {
    return new Promise((resolve, reject) => {
        exec(`tail -n ${lines} "${filePath}"`, (error, stdout, stderr) => {
            if (error) {
                // If file doesn't exist or is empty, return empty content
                resolve('');
                return;
            }
            resolve(stdout);
        });
    });
}

// Function to get log files for a process
function getLogFiles(processName) {
    const logFiles = [];
    const errorLogPath = path.join(PM2_LOGS_DIR, `${processName}-error.log`);
    const outLogPath = path.join(PM2_LOGS_DIR, `${processName}-out.log`);
    
    if (fs.existsSync(errorLogPath)) {
        logFiles.push({
            type: 'error',
            path: errorLogPath,
            name: `${processName}-error.log`
        });
    }
    
    if (fs.existsSync(outLogPath)) {
        logFiles.push({
            type: 'out',
            path: outLogPath,
            name: `${processName}-out.log`
        });
    }
    
    return logFiles;
}

// Route to serve the main page
app.get('/', async (req, res) => {
    try {
        const processes = await getPM2Processes();
        
        let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PM2 Logs Viewer</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #007acc;
            padding-bottom: 10px;
        }
        .process-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .process-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            background: #fafafa;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .process-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .process-name {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }
        .process-info {
            font-size: 14px;
            color: #666;
            margin-bottom: 15px;
        }
        .status {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status.online {
            background-color: #d4edda;
            color: #155724;
        }
        .status.stopped {
            background-color: #f8d7da;
            color: #721c24;
        }
        .log-links {
            margin-top: 15px;
        }
        .log-link {
            display: inline-block;
            margin-right: 10px;
            margin-bottom: 5px;
            padding: 8px 15px;
            background-color: #007acc;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 14px;
            transition: background-color 0.2s;
        }
        .log-link:hover {
            background-color: #005a9e;
        }
        .log-link.error {
            background-color: #dc3545;
        }
        .log-link.error:hover {
            background-color: #c82333;
        }
        .refresh-btn {
            display: block;
            margin: 20px auto;
            padding: 10px 20px;
            background-color: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.2s;
        }
        .refresh-btn:hover {
            background-color: #218838;
        }
        .no-logs {
            color: #999;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>PM2 Processes & Logs Viewer</h1>
        <button class="refresh-btn" onclick="window.location.reload()">Refresh</button>
        
        <div class="process-grid">
`;

        processes.forEach(process => {
            const logFiles = getLogFiles(process.name);
            const status = process.pm2_env.status;
            
            html += `
            <div class="process-card">
                <div class="process-name">${process.name}</div>
                <div class="process-info">
                    <div>ID: ${process.pm_id}</div>
                    <div>Status: <span class="status ${status}">${status}</span></div>
                    <div>Restarts: ${process.pm2_env.restart_time}</div>
                    <div>CPU: ${process.monit.cpu}%</div>
                    <div>Memory: ${Math.round(process.monit.memory / 1024 / 1024)}MB</div>
                </div>
                <div class="log-links">
`;

            if (logFiles.length > 0) {
                logFiles.forEach(logFile => {
                    html += `<a href="/logs/${process.name}/${logFile.type}" class="log-link ${logFile.type}">${logFile.type.toUpperCase()} Log</a>`;
                });
            } else {
                html += `<span class="no-logs">No log files found</span>`;
            }

            html += `
                </div>
            </div>
`;
        });

        html += `
        </div>
    </div>
</body>
</html>
`;

        res.send(html);
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

// Route to serve individual log files
app.get('/logs/:processName/:logType', async (req, res) => {
    try {
        const { processName, logType } = req.params;
        const lines = req.query.lines || 100;
        
        const logFileName = `${processName}-${logType}.log`;
        const logFilePath = path.join(PM2_LOGS_DIR, logFileName);
        
        if (!fs.existsSync(logFilePath)) {
            return res.status(404).send('Log file not found');
        }
        
        const logContent = await getLastLines(logFilePath, parseInt(lines));
        
        let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${logFileName} - PM2 Logs Viewer</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #007acc;
        }
        h1 {
            color: #333;
            margin: 0;
        }
        .controls {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .btn {
            padding: 8px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            font-size: 14px;
            transition: background-color 0.2s;
        }
        .btn-primary {
            background-color: #007acc;
            color: white;
        }
        .btn-primary:hover {
            background-color: #005a9e;
        }
        .btn-secondary {
            background-color: #6c757d;
            color: white;
        }
        .btn-secondary:hover {
            background-color: #545b62;
        }
        .log-content {
            background-color: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 70vh;
            overflow-y: auto;
        }
        .log-info {
            margin-bottom: 15px;
            padding: 10px;
            background-color: #e9ecef;
            border-radius: 4px;
            font-size: 14px;
        }
        select {
            padding: 5px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        .empty-log {
            text-align: center;
            color: #999;
            font-style: italic;
            padding: 40px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${logFileName}</h1>
            <div class="controls">
                <select id="linesSelect" onchange="changeLinesCount()">
                    <option value="50" ${lines == 50 ? 'selected' : ''}>50 lines</option>
                    <option value="100" ${lines == 100 ? 'selected' : ''}>100 lines</option>
                    <option value="200" ${lines == 200 ? 'selected' : ''}>200 lines</option>
                    <option value="500" ${lines == 500 ? 'selected' : ''}>500 lines</option>
                    <option value="1000" ${lines == 1000 ? 'selected' : ''}>1000 lines</option>
                </select>
                <button class="btn btn-primary" onclick="window.location.reload()">Refresh</button>
                <a href="/" class="btn btn-secondary">Back to Processes</a>
            </div>
        </div>
        
        <div class="log-info">
            <strong>Process:</strong> ${processName} | 
            <strong>Log Type:</strong> ${logType.toUpperCase()} | 
            <strong>Showing:</strong> Last ${lines} lines |
            <strong>File:</strong> ${logFilePath}
        </div>
        
        <div class="log-content" id="logContent">
`;

        if (logContent.trim()) {
            // Escape HTML characters
            const escapedContent = logContent
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            html += escapedContent;
        } else {
            html += '<div class="empty-log">Log file is empty or not found</div>';
        }

        html += `
        </div>
    </div>
    
    <script>
        function changeLinesCount() {
            const select = document.getElementById('linesSelect');
            const currentUrl = new URL(window.location);
            currentUrl.searchParams.set('lines', select.value);
            window.location.href = currentUrl.toString();
        }
        
        // Auto-scroll to bottom
        document.getElementById('logContent').scrollTop = document.getElementById('logContent').scrollHeight;
        
        // Auto-refresh every 10 seconds
        setInterval(() => {
            window.location.reload();
        }, 10000);
    </script>
</body>
</html>
`;

        res.send(html);
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

// Route to get raw log content (for API usage)
app.get('/api/logs/:processName/:logType', async (req, res) => {
    try {
        const { processName, logType } = req.params;
        const lines = req.query.lines || 100;
        
        const logFileName = `${processName}-${logType}.log`;
        const logFilePath = path.join(PM2_LOGS_DIR, logFileName);
        
        if (!fs.existsSync(logFilePath)) {
            return res.status(404).json({ error: 'Log file not found' });
        }
        
        const logContent = await getLastLines(logFilePath, parseInt(lines));
        
        res.json({
            processName,
            logType,
            fileName: logFileName,
            filePath: logFilePath,
            lines: parseInt(lines),
            content: logContent
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to get all processes info (API)
app.get('/api/processes', async (req, res) => {
    try {
        const processes = await getPM2Processes();
        res.json(processes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`PM2 Logs Viewer is running on http://localhost:${PORT}`);
    console.log(`PM2 logs directory: ${PM2_LOGS_DIR}`);
});
