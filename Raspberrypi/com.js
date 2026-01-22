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
    endpoint: 0,
    commandClass: 67,
    property: "setpoint",
    propertyKey: 1
};

async function main() {
    try {
        const node = driver.controller.nodes.get(5);
        const thermostatAPI = node.commandClasses["Thermostat Setpoint"];
        
        // Get supported setpoint types first
        const supportedTypes = await thermostatAPI.getSupportedSetpointTypes();
        console.log("Supported setpoint types:", supportedTypes);
        
        // Set using the API (this is the easiest way!)
        await thermostatAPI.set(1, 75);  // 1 = Heating
        console.log("Heating set to 75°F");
        
        await thermostatAPI.set(2, 78);  // 2 = Cooling
        console.log("Cooling set to 78°F");
        
        // Or using string names if supported
        await thermostatAPI.set("Heating", 75);
        
    } catch (error) {
        console.error("Error:", error);
    }
}
// Start the driver
await driver.start();