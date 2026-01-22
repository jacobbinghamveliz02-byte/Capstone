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
driver.once("driver ready", () => {
    console.log("Driver is ready");
    driver.on("all nodes ready", main);
});

// [5-67-0-setpoint-1] Setpoint (Heating) 

const heatingValueId = {
    endpoint: 5,
    commandClass: 67,
    property: "setpoint-1",
    propertyKey: 0
};

async function main() {
    try {
        const thermId = 5;
        const node = driver.controller.nodes.get(thermId);
        
        if (!node) {
            console.log(`Node ${thermId} not found`);
            console.log("Available node IDs:", Array.from(driver.controller.nodes.keys()));
            return;
        }
        
        console.log(`Node ${thermId} found: ${node.deviceConfig?.label}`);
        
        // Get all defined value IDs (this shows everything the node supports)
        console.log("\n=== All Value IDs on Node ===");
        const allValueIds = node.getDefinedValueIDs();
        
        // Filter for thermostat setpoints (command class 67)
        const thermostatValues = allValueIds.filter(v => v.commandClass === 67);
        
        if (thermostatValues.length === 0) {
            console.log("No thermostat setpoint values found!");
            
            // Show ALL values to see what's available
            console.log("\n=== All available values ===");
            allValueIds.forEach((v, i) => {
                const currentValue = node.getValue(v);
                console.log(`[${i}] [${v.endpoint}-${v.commandClass}-${v.propertyKey} ${v.property}] = ${currentValue}`);
            });
            return;
        }
        
        console.log(`Found ${thermostatValues.length} thermostat setpoint(s):`);
        thermostatValues.forEach((v, i) => {
            const currentValue = node.getValue(v);
            console.log(`[${i}] [${v.endpoint}-${v.commandClass}-${v.propertyKey} ${v.property}] = ${currentValue}`);
        });
        
        // Find the heating setpoint
        const heatingValueId = thermostatValues.find(v => 
            v.property === "setpoint-1" || 
            v.property === "Heating"
        );
        
        if (!heatingValueId) {
            console.log("No heating setpoint found. Available setpoint properties:");
            thermostatValues.forEach(v => console.log(`  - ${v.property}`));
            
            // Try the first thermostat value
            console.log("\nTrying first thermostat value...");
            const firstValueId = thermostatValues[0];
            console.log("Setting:", firstValueId);
            
            await node.setValue(firstValueId, 75);
        } else {
            console.log(`\nFound heating setpoint:`, heatingValueId);
            console.log(`Current value: ${node.getValue(heatingValueId)}`);
            
            // Try to set it
            console.log(`Setting to 75°F...`);
            const result = await node.setValue(heatingValueId, 75);
            console.log("Result:", result);
        }
        
        // Wait and check if value changed
        setTimeout(async () => {
            console.log("\n=== Checking current values after 3 seconds ===");
            thermostatValues.forEach(v => {
                const current = node.getValue(v);
                console.log(`${v.property}: ${current}°F`);
            });
        }, 3000);
        
    } catch (error) {
        console.error("Error in main:", error);
    }
}
// Start the driver
await driver.start();