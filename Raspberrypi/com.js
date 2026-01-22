// @ts-check

import { commandClass, Driver, Endpoint } from "zwave-js";

const driver = new Driver(
    // Tell the driver which serial port to use
    "/dev/serial/by-id/usb-1a86_USB_Single_Serial_5A49039988-if00",
    // and configure options like security keys
    {
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
    },
);


for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
        await driver.destroy();
        process.exit(0);
    });
}


// Listen for the driver ready event before doing anything with the driver
async function main() {
    try {
        const thermId = 5;
        const node = driver.controller.nodes.get(thermId);
        
        if (!node) {
            console.log(`Node ${thermId} not found`);
            // Let's see what nodes ARE available
            console.log("Available nodes:", Array.from(driver.controller.nodes.keys()));
            return;
        }
        
        console.log(`Node ${thermId} found: ${node.deviceConfig?.label}`);
        console.log(`Node ready status: ${node.ready}`);
        
        // Wait if node isn't ready yet
        if (!node.ready) {
            console.log("Waiting for node to be ready...");
            await new Promise(resolve => node.once("ready", resolve));
        }
        
        // Let's see what command classes the node supports
        console.log("Supported command classes:", 
            Array.from(node.commandClasses.keys())
                .filter(cc => node.commandClasses.get(cc)?.isSupported())
                .map(cc => `CC ${cc}`)
        );
        
        // Check if Thermostat Setpoint CC (67) is supported
        const thermostatCC = node.commandClasses.get(67);
        if (!thermostatCC || !thermostatCC.isSupported()) {
            console.error("Thermostat Setpoint CC not supported!");
            return;
        }
        
        console.log("Thermostat Setpoint CC is supported");
        
        // Try setting the value
        console.log(`Setting heating to 75°F...`);
        const result = await node.setValue(heatingValueId, 75);
        console.log(`SetValue result:`, result);
        
        // Wait a moment and check if value changed
        setTimeout(async () => {
            const currentValue = await node.getValue(heatingValueId);
            console.log(`Current heating value: ${currentValue}°F`);
        }, 3000);
        
    } catch (error) {
        console.error("Error in main:", error);
    }
}
// Start the driver
await driver.start();