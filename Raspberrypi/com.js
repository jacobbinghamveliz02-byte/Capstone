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
        

        timeouts: {
            ack: 10000,
            response: 30000,
        },
        
        attempts: {
            controller: 3,
            sendData: 3,
        },
        

        features: {
            softReset: false,
        },
        

        storage: {
            cacheDir: "./zwave-cache",
            deviceConfigPriorityDir: "./zwave-configs",
        },
        
    }
);

// Error handling
driver.on("error", (error) => {
    console.error("Driver error:", error);
});

// Also listen for specific driver events
driver.on("driver ready", () => {
    console.log("Driver is ready!");
});

driver.on("all nodes ready", () => {
    console.log("All nodes ready!");
});

// Signal handling
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
        console.log(`\nReceived ${signal}, shutting down...`);
        await driver.destroy();
        process.exit(0);
    });
}

// Start with error handling
async function start() {
    try {
        console.log("Starting Z-Wave JS with HomeSeer G8...");
        console.log("Using port: /dev/serial/by-id/usb-1a86_USB_Single_Serial_5A49039988-if00");
        console.log("Initialization may take 30-60 seconds...");
        await driver.start();
    } catch (error) {
        console.error("Failed to start driver:", error);
        process.exit(1);
    }
}

start();