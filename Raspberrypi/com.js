// @ts-nocheck
// import fs from "fs";
import { Driver } from "zwave-js";
const thermId = 5; // Node ID of the thermostat
const lightId = [2, 4]; // Node IDs of the lights

// const currentDir = process.cwd();


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

const coolingValueId = {
    commandClass: 67,
    endpoint: 0,
    property: 'setpoint',
    propertyKey: 2,
    propertyName: 'setpoint',
    propertyKeyName: 'Cooling'
};

const lightTargetLevelValueId = {
    commandClassName: "Multilevel Switch",
    commandClass: 38,
    endpoint: 0,
    property: "targetValue",
    propertyName: "targetValue"
}

const lightLevelValueId = {
    commandClassName: "Multilevel Switch",
    commandClass: 38,
    endpoint: 0,
    property: "currentValue",
    propertyName: "currentValue" 
}



async function main() {
    // const node = driver.controller.nodes.get(2);
    // const allValueIds = node.getDefinedValueIDs();
    // console.log(allValueIds);
    // fs.writeFileSync(`${currentDir}/light2.json`, JSON.stringify(allValueIds, null, 2));
    // thermostat();
    //lightControl();
    controlNode4Workaround();
}

async function thermostat() {
    const node = driver.controller.nodes.get(thermId);
        if (!node) {
            console.log(`Node ${thermId} not found`);
            return;
        }
    await node.ping();
    await changeHeat(node);
    await changeCool(node);
}

async function lightControl() {
    const node = driver.controller.nodes.get(lightId[0]);
    const node2 = driver.controller.nodes.get(lightId[1]);
    changeLight(node, lightId[0]);
    changeLight(node2, lightId[1]);
}

async function changeLight(node, id){
    await node.ping();
    if(!node){
        console.log(`Node ${id} not found`);
        return;
    }
    await node.setValue(lightTargetLevelValueId, 0);
    const currentValue = await node.getValue(lightLevelValueId);
    console.log(`Current light level: ${currentValue}`);
    
}

// @ts-ignore
async function changeHeat(node){
    await node.setValue(heatingValueId, 68);
}
// @ts-ignore
async function changeCool(node){
    await node.setValue(coolingValueId, 69);
}


async function controlNode4Workaround() {
    const node = driver.controller.nodes.get(4);
    
    console.log("=== Controlling Node 4 (Workaround) ===");
    
    // Method 1: Try using Basic CC instead
    console.log("\nMethod 1: Using Basic CC (Command Class 32)...");
    try {
        // First check if Basic CC is supported
        const basicCC = node.commandClasses[32]; // 32 = Basic
        if (basicCC && basicCC.isSupported && basicCC.isSupported()) {
            console.log("Basic CC is supported");
            
            // Turn OFF
            await basicCC.set(0);
            console.log("Sent Basic.set(0) - should turn OFF");
            
            return;
        } else {
            console.log("Basic CC not supported or not available");
        }
    } catch (error) {
        console.log(`Basic CC failed: ${error.message}`);
    }
    
    // Method 2: Try different endpoint
    console.log("\nMethod 2: Trying different endpoints...");
    const endpoints = node.getAllEndpoints();
    
    for (const endpoint of endpoints) {
        const endpointIndex = endpoint.index;
        console.log(`Trying endpoint ${endpointIndex}...`);
        
        try {
            // Try with endpoint
            await node.setValue({
                commandClass: 38,
                endpoint: endpointIndex,
                property: "targetValue"
            }, 50);
            console.log(`Success with endpoint ${endpointIndex}`);
            return;
        } catch (error) {
            console.log(`Endpoint ${endpointIndex} failed: ${error.message}`);
        }
    }
    
    // Method 3: Try direct command
    console.log("\nMethod 3: Sending raw command...");
    try {
        // Get the Multilevel Switch API
        const ccAPI = node.commandClasses[38];
        if (ccAPI) {
            // Try to call set method directly
            await ccAPI.set(0);
            console.log("Direct ccAPI.set(0) succeeded");
            return;
        }
    } catch (error) {
        console.log(`Direct API failed: ${error.message}`);
    }
    
    console.log("\nAll methods failed for Node 4");
}


// Start the driver
await driver.start();
