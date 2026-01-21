// get-nodes.js
const WebSocket = require('ws');

// 1. Connect to Z-Wave JS UI WebSocket
const ws = new WebSocket('ws://localhost:3000');

// 2. Wait for connection
ws.on('open', () => {
    console.log('Connected to Z-Wave JS UI');
    
    // 3. Start listening to the Z-Wave network
    ws.send(JSON.stringify({
        messageId: 'start-listening',
        command: 'start_listening'
    }));
});

// 4. Handle responses
ws.on('message', (data) => {
    const message = JSON.parse(data);
    
    if (message.type === 'result') {
        console.log('Result received');
    } 
    else if (message.type === 'event') {
        const event = message.event;
        
        // 5. When driver is ready, request all nodes
        if (event.type === 'driver ready') {
            console.log('Driver is ready, requesting nodes...');
            
            // Send command to get all nodes
            ws.send(JSON.stringify({
                messageId: 'get-nodes',
                command: 'driver.get_all_nodes'
            }));
        }
        // 6. When all nodes are ready, request nodes again to be sure
        else if (event.type === 'all nodes ready') {
            console.log('All nodes are ready');
            
            ws.send(JSON.stringify({
                messageId: 'get-all-nodes',
                command: 'driver.get_all_nodes'
            }));
        }
    }
    // 7. Handle the nodes response
    else if (message.messageId === 'get-nodes' || message.messageId === 'get-all-nodes') {
        const nodes = message.result;
        console.log(`\n✅ Found ${nodes.length} nodes:\n`);
        
        nodes.forEach((node, index) => {
            console.log(`Node ${index + 1}:`);
            console.log(`  ID: ${node.id}`);
            console.log(`  Status: ${node.status}`);
            console.log(`  Ready: ${node.ready}`);
            console.log(`  Device: ${node.deviceClass?.basic?.label || 'Unknown'}`);
            console.log(`  Manufacturer: ${node.manufacturer || 'Unknown'}`);
            console.log(`  Product: ${node.productDescription || 'Unknown'}`);
            console.log('---');
        });
        
        // Close connection when done
        setTimeout(() => {
            ws.close();
            process.exit(0);
        }, 1000);
    }
});

ws.on('error', (error) => {
    console.error('Error:', error);
});