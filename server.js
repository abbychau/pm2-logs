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
        .process-controls {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #eee;
        }
        .control-btn {
            display: inline-block;
            margin-right: 8px;
            margin-bottom: 5px;
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            transition: all 0.2s;
        }
        .control-btn:hover {
            transform: translateY(-1px);
        }
        .control-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .btn-start {
            background-color: #28a745;
            color: white;
        }
        .btn-start:hover:not(:disabled) {
            background-color: #218838;
        }
        .btn-stop {
            background-color: #dc3545;
            color: white;
        }
        .btn-stop:hover:not(:disabled) {
            background-color: #c82333;
        }
        .btn-restart {
            background-color: #ffc107;
            color: #212529;
        }
        .btn-restart:hover:not(:disabled) {
            background-color: #e0a800;
        }
        .btn-git-pull {
            background-color: #6f42c1;
            color: white;
        }
        .btn-git-pull:hover:not(:disabled) {
            background-color: #5a32a3;
        }
        .btn-npm-install {
            background-color: #ff6b35;
            color: white;
        }
        .btn-npm-install:hover:not(:disabled) {
            background-color: #e55a30;
        }
        .btn-npm-build {
            background-color: #17a2b8;
            color: white;
        }
        .btn-npm-build:hover:not(:disabled) {
            background-color: #138496;
        }
        .btn-npm-deploy {
            background-color: #20c997;
            color: white;
        }
        .btn-npm-deploy:hover:not(:disabled) {
            background-color: #1ba085;
        }
        .loading {
            opacity: 0.7;
            pointer-events: none;
        }
        .success-message, .error-message {
            padding: 8px 12px;
            border-radius: 4px;
            margin-top: 10px;
            font-size: 12px;
            display: none;
        }
        .success-message {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error-message {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
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
                    <div style="font-size: 12px; color: #888; margin-top: 5px;">Dir: ${process.pm2_env.pm_cwd}</div>
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
                <div class="process-controls">
                    <button class="control-btn btn-start" onclick="controlProcess('${process.name}', 'start')" ${status === 'online' ? 'disabled' : ''}>
                        Start
                    </button>
                    <button class="control-btn btn-stop" onclick="controlProcess('${process.name}', 'stop')" ${status !== 'online' ? 'disabled' : ''}>
                        Stop
                    </button>
                    <button class="control-btn btn-restart" onclick="controlProcess('${process.name}', 'restart')" ${status !== 'online' ? 'disabled' : ''}>
                        Restart
                    </button>
                    <button class="control-btn btn-git-pull" onclick="gitPull('${process.name}')">
                        Git Pull
                    </button>
                    <button class="control-btn btn-npm-install" onclick="npmInstall('${process.name}')">
                        NPM Install
                    </button>
                    <button class="control-btn btn-npm-build" onclick="npmBuild('${process.name}')">
                        NPM Build
                    </button>
                    <button class="control-btn btn-npm-deploy" onclick="npmDeploy('${process.name}')">
                        NPM Deploy
                    </button>
                    <div class="success-message" id="success-${process.name}"></div>
                    <div class="error-message" id="error-${process.name}"></div>
                </div>
            </div>
`;
        });

        html += `
        </div>
    </div>
    
    <script>
        async function controlProcess(processName, action) {
            const card = document.querySelector(\`[data-process="\${processName}"]\`) || 
                        document.evaluate(\`//div[contains(@class, 'process-card') and .//div[contains(@class, 'process-name') and text()='\${processName}']]\`, 
                                        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            
            const successEl = document.getElementById(\`success-\${processName}\`);
            const errorEl = document.getElementById(\`error-\${processName}\`);
            const buttons = card.querySelectorAll('.control-btn');
            
            // Clear previous messages
            successEl.style.display = 'none';
            errorEl.style.display = 'none';
            
            // Add loading state
            card.classList.add('loading');
            buttons.forEach(btn => btn.disabled = true);
            
            try {
                const response = await fetch(\`/api/processes/\${processName}/\${action}\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    successEl.textContent = result.message;
                    successEl.style.display = 'block';
                    
                    // Refresh the page after a short delay to show updated status
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    throw new Error(result.error || 'Unknown error occurred');
                }
                
            } catch (error) {
                errorEl.textContent = \`Error: \${error.message}\`;
                errorEl.style.display = 'block';
                
                // Re-enable buttons on error
                card.classList.remove('loading');
                updateButtonStates(processName, 'unknown'); // Will be corrected on next refresh
            }
        }
        
        async function gitPull(processName) {
            const card = document.querySelector(\`[data-process="\${processName}"]\`) || 
                        document.evaluate(\`//div[contains(@class, 'process-card') and .//div[contains(@class, 'process-name') and text()='\${processName}']]\`, 
                                        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            
            const successEl = document.getElementById(\`success-\${processName}\`);
            const errorEl = document.getElementById(\`error-\${processName}\`);
            const buttons = card.querySelectorAll('.control-btn');
            
            // Clear previous messages
            successEl.style.display = 'none';
            errorEl.style.display = 'none';
            
            // Add loading state
            card.classList.add('loading');
            buttons.forEach(btn => btn.disabled = true);
            
            try {
                const response = await fetch(\`/api/git-pull/\${processName}\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    successEl.innerHTML = \`<strong>Git Pull Result:</strong><br><pre style="margin: 5px 0; white-space: pre-wrap; font-size: 11px;">\${result.output}</pre>\`;
                    successEl.style.display = 'block';
                } else {
                    throw new Error(result.error || 'Unknown error occurred');
                }
                
            } catch (error) {
                errorEl.textContent = \`Git Pull Error: \${error.message}\`;
                errorEl.style.display = 'block';
            } finally {
                // Re-enable buttons
                card.classList.remove('loading');
                buttons.forEach(btn => {
                    btn.disabled = false;
                });
                // Update button states based on current status
                const statusElement = card.querySelector('.status');
                if (statusElement) {
                    updateButtonStates(processName, statusElement.textContent);
                }
            }
        }
        
        async function npmInstall(processName) {
            const card = document.querySelector(\`[data-process="\${processName}"]\`) || 
                        document.evaluate(\`//div[contains(@class, 'process-card') and .//div[contains(@class, 'process-name') and text()='\${processName}']]\`, 
                                        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            
            const successEl = document.getElementById(\`success-\${processName}\`);
            const errorEl = document.getElementById(\`error-\${processName}\`);
            const buttons = card.querySelectorAll('.control-btn');
            
            // Clear previous messages
            successEl.style.display = 'none';
            errorEl.style.display = 'none';
            
            // Add loading state
            card.classList.add('loading');
            buttons.forEach(btn => btn.disabled = true);
            
            try {
                const response = await fetch(\`/api/npm-install/\${processName}\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    successEl.innerHTML = \`<strong>NPM Install Result:</strong><br><pre style="margin: 5px 0; white-space: pre-wrap; font-size: 11px;">\${result.output}</pre>\`;
                    successEl.style.display = 'block';
                } else {
                    throw new Error(result.error || 'Unknown error occurred');
                }
                
            } catch (error) {
                errorEl.textContent = \`NPM Install Error: \${error.message}\`;
                errorEl.style.display = 'block';
            } finally {
                // Re-enable buttons
                card.classList.remove('loading');
                buttons.forEach(btn => {
                    btn.disabled = false;
                });
                // Update button states based on current status
                const statusElement = card.querySelector('.status');
                if (statusElement) {
                    updateButtonStates(processName, statusElement.textContent);
                }
            }
        }
        
        async function npmBuild(processName) {
            const card = document.querySelector(\`[data-process="\${processName}"]\`) || 
                        document.evaluate(\`//div[contains(@class, 'process-card') and .//div[contains(@class, 'process-name') and text()='\${processName}']]\`, 
                                        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            
            const successEl = document.getElementById(\`success-\${processName}\`);
            const errorEl = document.getElementById(\`error-\${processName}\`);
            const buttons = card.querySelectorAll('.control-btn');
            
            // Clear previous messages
            successEl.style.display = 'none';
            errorEl.style.display = 'none';
            
            // Add loading state
            card.classList.add('loading');
            buttons.forEach(btn => btn.disabled = true);
            
            try {
                const response = await fetch(\`/api/npm-build/\${processName}\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    successEl.innerHTML = \`<strong>NPM Build Result:</strong><br><pre style="margin: 5px 0; white-space: pre-wrap; font-size: 11px;">\${result.output}</pre>\`;
                    successEl.style.display = 'block';
                } else {
                    throw new Error(result.error || 'Unknown error occurred');
                }
                
            } catch (error) {
                errorEl.textContent = \`NPM Build Error: \${error.message}\`;
                errorEl.style.display = 'block';
            } finally {
                // Re-enable buttons
                card.classList.remove('loading');
                buttons.forEach(btn => {
                    btn.disabled = false;
                });
                // Update button states based on current status
                const statusElement = card.querySelector('.status');
                if (statusElement) {
                    updateButtonStates(processName, statusElement.textContent);
                }
            }
        }
        
        async function npmDeploy(processName) {
            const card = document.querySelector(\`[data-process="\${processName}"]\`) || 
                        document.evaluate(\`//div[contains(@class, 'process-card') and .//div[contains(@class, 'process-name') and text()='\${processName}']]\`, 
                                        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            
            const successEl = document.getElementById(\`success-\${processName}\`);
            const errorEl = document.getElementById(\`error-\${processName}\`);
            const buttons = card.querySelectorAll('.control-btn');
            
            // Clear previous messages
            successEl.style.display = 'none';
            errorEl.style.display = 'none';
            
            // Add loading state
            card.classList.add('loading');
            buttons.forEach(btn => btn.disabled = true);
            
            try {
                const response = await fetch(\`/api/npm-deploy/\${processName}\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    successEl.innerHTML = \`<strong>NPM Deploy Result:</strong><br><pre style="margin: 5px 0; white-space: pre-wrap; font-size: 11px;">\${result.output}</pre>\`;
                    successEl.style.display = 'block';
                } else {
                    throw new Error(result.error || 'Unknown error occurred');
                }
                
            } catch (error) {
                errorEl.textContent = \`NPM Deploy Error: \${error.message}\`;
                errorEl.style.display = 'block';
            } finally {
                // Re-enable buttons
                card.classList.remove('loading');
                buttons.forEach(btn => {
                    btn.disabled = false;
                });
                // Update button states based on current status
                const statusElement = card.querySelector('.status');
                if (statusElement) {
                    updateButtonStates(processName, statusElement.textContent);
                }
            }
        }
        
        function updateButtonStates(processName, status) {
            const card = document.evaluate(\`//div[contains(@class, 'process-card') and .//div[contains(@class, 'process-name') and text()='\${processName}']]\`, 
                                         document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!card) return;
            
            const startBtn = card.querySelector('.btn-start');
            const stopBtn = card.querySelector('.btn-stop');
            const restartBtn = card.querySelector('.btn-restart');
            
            if (status === 'online') {
                startBtn.disabled = true;
                stopBtn.disabled = false;
                restartBtn.disabled = false;
            } else {
                startBtn.disabled = false;
                stopBtn.disabled = true;
                restartBtn.disabled = true;
            }
        }
    </script>
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

// Route to manage PM2 processes (start, stop, restart)
app.post('/api/processes/:processName/:action', async (req, res) => {
    try {
        const { processName, action } = req.params;
        
        // Validate action
        if (!['start', 'stop', 'restart'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Use start, stop, or restart.' });
        }
        
        // Execute PM2 command
        const command = `pm2 ${action} ${processName}`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`PM2 ${action} error:`, error);
                return res.status(500).json({ 
                    error: `Failed to ${action} process ${processName}`,
                    details: error.message,
                    stderr: stderr
                });
            }
            
            res.json({
                success: true,
                action: action,
                processName: processName,
                message: `Successfully ${action}ed process ${processName}`,
                output: stdout
            });
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to perform git pull for a process
app.post('/api/git-pull/:processName', async (req, res) => {
    try {
        const { processName } = req.params;
        
        // Get all PM2 processes to find the working directory
        const processes = await getPM2Processes();
        const process = processes.find(p => p.name === processName);
        
        if (!process) {
            return res.status(404).json({ error: `Process ${processName} not found` });
        }
        
        const workingDir = process.pm2_env.pm_cwd;
        
        if (!workingDir) {
            return res.status(400).json({ error: `No working directory found for process ${processName}` });
        }
        
        // Check if directory exists
        if (!fs.existsSync(workingDir)) {
            return res.status(400).json({ error: `Working directory ${workingDir} does not exist` });
        }
        
        // Execute git pull in the process's working directory
        const command = `cd "${workingDir}" && git pull`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Git pull error for ${processName}:`, error);
                return res.json({
                    success: false,
                    error: `Git pull failed for ${processName}`,
                    details: error.message,
                    output: stderr || stdout,
                    workingDir: workingDir
                });
            }
            
            const output = stdout || 'Git pull completed successfully';
            
            res.json({
                success: true,
                processName: processName,
                workingDir: workingDir,
                output: output,
                stderr: stderr
            });
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to perform npm install for a process
app.post('/api/npm-install/:processName', async (req, res) => {
    try {
        const { processName } = req.params;
        
        // Get all PM2 processes to find the working directory
        const processes = await getPM2Processes();
        const process = processes.find(p => p.name === processName);
        
        if (!process) {
            return res.status(404).json({ error: `Process ${processName} not found` });
        }
        
        const workingDir = process.pm2_env.pm_cwd;
        
        if (!workingDir) {
            return res.status(400).json({ error: `No working directory found for process ${processName}` });
        }
        
        // Check if directory exists
        if (!fs.existsSync(workingDir)) {
            return res.status(400).json({ error: `Working directory ${workingDir} does not exist` });
        }
        
        // Check if package.json exists
        const packageJsonPath = path.join(workingDir, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            return res.status(400).json({ error: `package.json not found in ${workingDir}` });
        }
        
        // Execute npm install in the process's working directory
        const command = `cd "${workingDir}" && npm install`;
        
        exec(command, { timeout: 300000 }, (error, stdout, stderr) => { // 5 minute timeout
            if (error) {
                console.error(`NPM install error for ${processName}:`, error);
                return res.json({
                    success: false,
                    error: `NPM install failed for ${processName}`,
                    details: error.message,
                    output: stderr || stdout,
                    workingDir: workingDir
                });
            }
            
            const output = stdout || 'NPM install completed successfully';
            
            res.json({
                success: true,
                processName: processName,
                workingDir: workingDir,
                output: output,
                stderr: stderr
            });
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to perform npm run build for a process
app.post('/api/npm-build/:processName', async (req, res) => {
    try {
        const { processName } = req.params;
        
        // Get all PM2 processes to find the working directory
        const processes = await getPM2Processes();
        const process = processes.find(p => p.name === processName);
        
        if (!process) {
            return res.status(404).json({ error: `Process ${processName} not found` });
        }
        
        const workingDir = process.pm2_env.pm_cwd;
        
        if (!workingDir) {
            return res.status(400).json({ error: `No working directory found for process ${processName}` });
        }
        
        // Check if directory exists
        if (!fs.existsSync(workingDir)) {
            return res.status(400).json({ error: `Working directory ${workingDir} does not exist` });
        }
        
        // Check if package.json exists
        const packageJsonPath = path.join(workingDir, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            return res.status(400).json({ error: `package.json not found in ${workingDir}` });
        }
        
        // Check if build script exists in package.json
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (!packageJson.scripts || !packageJson.scripts.build) {
                return res.status(400).json({ error: `No build script found in package.json for ${processName}` });
            }
        } catch (parseError) {
            return res.status(400).json({ error: `Invalid package.json in ${workingDir}` });
        }
        
        // Execute npm run build in the process's working directory
        const command = `cd "${workingDir}" && npm run build`;
        
        exec(command, { timeout: 600000 }, (error, stdout, stderr) => { // 10 minute timeout
            if (error) {
                console.error(`NPM build error for ${processName}:`, error);
                return res.json({
                    success: false,
                    error: `NPM build failed for ${processName}`,
                    details: error.message,
                    output: stderr || stdout,
                    workingDir: workingDir
                });
            }
            
            const output = stdout || 'NPM build completed successfully';
            
            res.json({
                success: true,
                processName: processName,
                workingDir: workingDir,
                output: output,
                stderr: stderr
            });
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to perform npm run deploy for a process
app.post('/api/npm-deploy/:processName', async (req, res) => {
    try {
        const { processName } = req.params;
        
        // Get all PM2 processes to find the working directory
        const processes = await getPM2Processes();
        const process = processes.find(p => p.name === processName);
        
        if (!process) {
            return res.status(404).json({ error: `Process ${processName} not found` });
        }
        
        const workingDir = process.pm2_env.pm_cwd;
        
        if (!workingDir) {
            return res.status(400).json({ error: `No working directory found for process ${processName}` });
        }
        
        // Check if directory exists
        if (!fs.existsSync(workingDir)) {
            return res.status(400).json({ error: `Working directory ${workingDir} does not exist` });
        }
        
        // Check if package.json exists
        const packageJsonPath = path.join(workingDir, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            return res.status(400).json({ error: `package.json not found in ${workingDir}` });
        }
        
        // Check if deploy script exists in package.json
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (!packageJson.scripts || !packageJson.scripts.deploy) {
                return res.status(400).json({ error: `No deploy script found in package.json for ${processName}` });
            }
        } catch (parseError) {
            return res.status(400).json({ error: `Invalid package.json in ${workingDir}` });
        }
        
        // Execute npm run deploy in the process's working directory
        const command = `cd "${workingDir}" && npm run deploy`;
        
        exec(command, { timeout: 900000 }, (error, stdout, stderr) => { // 15 minute timeout
            if (error) {
                console.error(`NPM deploy error for ${processName}:`, error);
                return res.json({
                    success: false,
                    error: `NPM deploy failed for ${processName}`,
                    details: error.message,
                    output: stderr || stdout,
                    workingDir: workingDir
                });
            }
            
            const output = stdout || 'NPM deploy completed successfully';
            
            res.json({
                success: true,
                processName: processName,
                workingDir: workingDir,
                output: output,
                stderr: stderr
            });
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`PM2 Logs Viewer is running on http://localhost:${PORT}`);
    console.log(`PM2 logs directory: ${PM2_LOGS_DIR}`);
});
