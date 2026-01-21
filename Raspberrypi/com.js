// @ts-check
import { Driver } from "zwave-js";

const driver = new Driver(
    "/dev/serial/by-id/usb-1a86_USB_Single_Serial_5A49039988-if00",
    {
        // Security keys (keep yours)
        securityKeys: {
            S0_Legacy: Buffer.from("0102030405060708090a0b0c0d0e0f10", "hex"),
            S2_Unauthenticated: Buffer.from(
                "B748B57AB628AC74AFED8BF3EC82DF35",
                "hex",
            ),
            S2_AccessControl: Buffer.from(
                "60B3ACA9F7F00FBB479AC571AE6BC727",
                "hex",
            ),
            S2_Authenticated: Buffer.from(
                "076362C7BFABB1F313E44280BAF5C627",
                "hex",
            ),
        },
        securityKeysLongRange: {
            S2_Authenticated: Buffer.from(
                "63F7EF53997B0DDD9AED070FC2EF3FA7",
                "hex",
            ),
            S2_AccessControl: Buffer.from(
                "22905E5323D0D42DE1D754C9E44E5B77",
                "hex",
            ),
        },
        
        // CRITICAL FOR HOMESEER G8:
        timeouts: {
            ack: 6500,      // G8 needs longer ACK timeout
            response: 65000, // Much longer response timeout
        },
        
        attempts: {
            controller: 3,
            sendData: 3,
        },
        
        // Disable features that G8 might not support well
        features: {
            softReset: false,  // G8 often has issues with soft reset
        },
        
        // Compatibility settings for G8
        compatibility: {
            // These settings help with 800 series chips
            preserveEndpoints: false,
            disableStrictEntryControlDataValidation: true,
            enableSoftReset: false,
            queryOnWakeup: false,
            // Some G8 sticks need this:
            treatSetAsReport: {
                "Basic": true,
            },
        },
        
        // API settings
        api: {
            // Try forcing API version
            min: 1,
            max: 3,
        },
        
        // Logging for debugging
        logging: {
            level: "debug",
            logToFile: false,
        },
        
        // Storage settings
        storage: {
            cacheDir: "/tmp/zwave-cache",  // Use tmp for testing
            deviceConfigPriorityDir: "/tmp/zwave-configs",
        }
    }
);

driver.on("error", (error) => {
    console.error("Driver error:", error);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
        console.log(`Received ${signal}, shutting down...`);
        await driver.destroy();
        process.exit(0);
    });
}

// Event handlers
driver.once("driver ready", () => {
    console.log("SUCCESS: Driver is ready!");
    console.log("Controller type:", driver.controller.type);
    console.log("Home ID:", driver.controller.homeId?.toString(16));
    console.log("Node ID:", driver.controller.ownNodeId);
    
    driver.on("all nodes ready", () => {
        console.log("All nodes ready!");
        const nodes = driver.controller.nodes;
        console.log(`Found ${nodes.size} nodes`);
        for (const [nodeId, node] of nodes) {
            console.log(`Node ${nodeId}: ${node.getLabel() || 'Unknown'}`);
        }
    });
});

// Start with error handling
async function start() {
    try {
        console.log("Starting Z-Wave JS with HomeSeer G8...");
        console.log("This may take up to 60 seconds due to longer timeouts...");
        await driver.start();
    } catch (error) {
        console.error("Failed to start driver:", error);
        process.exit(1);
    }
}

start();