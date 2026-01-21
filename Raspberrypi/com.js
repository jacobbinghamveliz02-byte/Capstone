import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
    ws.send(JSON.stringify({
        messageId: 'start',
        command: 'start_listening'
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (msg.type === 'event' && msg.event.type === 'all nodes ready') {
        ws.send(JSON.stringify({
            messageId: 'nodes',
            command: 'driver.get_all_nodes'
        }));
    }
    
    if (msg.messageId === 'nodes' && msg.result) {
        console.log(`Found ${msg.result.length} nodes:`);
        msg.result.forEach(node => {
            console.log(`Node ${node.id}: ${node.deviceClass?.basic?.label || 'Unknown'}`);
        });
        ws.close();
    }
});

ws.on('error', (err) => console.error(err));