// @ts-check

import { Driver } from "zwave-js";
// removing this once I get the ouptput I want
import fs from 'fs';

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
    commandClass: 67,
    endpoint: 0,
    property: 'setpoint',
    propertyKey: 1,
    propertyName: 'setpoint',
    propertyKeyName: 'Heating'
};

async function main() {
const thermId = 5;
        const node = driver.controller.nodes.get(thermId);
        
        if (!node) {
            console.log(`Node ${thermId} not found`);
            return;
        }
        const allValueIds = node.getDefinedValueIDs();
        // This shows all the value IDs for the node USE THIS WHEN GETTING ERRORS ABOUT VALUE IDS
        console.log = function(...args) {
        fs.appendFileSync('thermostatValueIds.js', args.join(' ') + '\n', 'utf8');
        };
        console.log("All value IDs:" , allValueIds);
        console.log(`Node ${thermId} found: ${node.deviceConfig?.label}`);
        
        // console.log(`Setting to 75°F...`);
        const result = await node.setValue(heatingValueId, 75);
        // console.log("Result:", result);
        
}
// Start the driver
await driver.start();