// com.js
const WebSocket = require('ws');

// Default Z-Wave JS UI WebSocket port
const ws = new WebSocket('ws://192.168.0.75:8090');

ws.on('open', function open() {
    console.log('Connected to Z-Wave JS UI');
    
    // Subscribe to all events
    ws.send(JSON.stringify({
        messageId: 'subscribe-all',
        command: 'start_listening'
    }));
});

ws.on('message', function incoming(data) {
    const message = JSON.parse(data);
    
    switch (message.type) {
        case 'result':
            console.log('Result:', message.result);
            break;
        case 'event':
            handleEvent(message.event);
            break;
        case 'version':
            console.log('Server version:', message.serverVersion);
            break;
        default:
            console.log('Unknown message type:', message.type);
    }
});

function handleEvent(event) {
    switch (event.source) {
        case 'driver':
            if (event.event === 'driver ready') {
                console.log('Driver is ready!');
                getAllNodes();
            }
            break;
        case 'controller':
            console.log('Controller event:', event);
            break;
        case 'value':
            console.log('Value update:', event);
            break;
        case 'node':
            console.log('Node event:', event);
            break;
    }
}

async function getAllNodes() {
    // Request all nodes
    ws.send(JSON.stringify({
        messageId: 'get-nodes',
        command: 'driver.get_all_nodes'
    }));
}

ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
});

ws.on('close', function close() {
    console.log('WebSocket connection closed');
});