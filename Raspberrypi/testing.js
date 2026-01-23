// get-all-nodes.js
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
    console.log('Getting all nodes on network...');
    
    // Command to get all nodes
    ws.send(JSON.stringify({
        type: 'command',
        command: 'controller.get_nodes',
        messageId: 'get-nodes'
    }));
});

ws.on('message', (data) => {
    const response = JSON.parse(data.toString());
    
    if (response.type === 'result' && response.messageId === 'get-nodes') {
        if (response.success) {
            const nodes = response.result || [];
            console.log(`\nFound ${nodes.length} nodes on network:`);
            
            nodes.forEach(nodeId => {
                console.log(`  Node ${nodeId}`);
                
                // Get node info for each node
                ws.send(JSON.stringify({
                    type: 'command',
                    command: 'node.get_info',
                    messageId: `info-${nodeId}`,
                    args: [nodeId]
                }));
            });
        } else {
            console.log('Error getting nodes:', response.errorCode);
        }
    }
    
    // Handle node info responses
    if (response.type === 'result' && response.messageId?.startsWith('info-')) {
        if (response.success && response.result) {
            const nodeId = response.messageId.split('-')[1];
            const info = response.result;
            console.log(`\nNode ${nodeId} Info:`);
            console.log(`  Status: ${info.status}`);
            console.log(`  Ready: ${info.ready}`);
            console.log(`  Manufacturer: ${info.manufacturer}`);
            console.log(`  Product: ${info.productLabel || info.productDescription}`);
            console.log(`  Type: ${info.nodeType}`);
        }
    }
});
