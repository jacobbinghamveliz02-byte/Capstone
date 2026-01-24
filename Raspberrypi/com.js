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
    lightControl();
    // testTargetValue();
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


async function diagnoseNode4() {
    const node = driver.controller.nodes.get(4);
    
    if (!node) {
        console.log("Node 4 not found");
        return;
    }
    
    console.log("=== Diagnosing Node 4 ===");
    console.log(`Status: ${node.status}`);
    console.log(`Ready: ${node.ready}`);
    console.log(`Manufacturer: ${node.manufacturer}`);
    console.log(`Product: ${node.productLabel}`);
    console.log(`Device class: ${node.deviceClass?.generic?.label} - ${node.deviceClass?.specific?.label}`);
    
    // List all command classes
    console.log("\nCommand Classes:");
    const ccs = Array.from(node.commandClasses.entries());
    
    if (ccs.length === 0) {
        console.log("No command classes found - node may not be properly interviewed");
    } else {
        ccs.forEach(([cc, api]) => {
            console.log(`  - ${cc} (v${api.version}): supported=${api.isSupported()}`);
        });
    }
    
    // Check specifically for Multilevel Switch
    console.log("\nMultilevel Switch details:");
    const multilevelSwitch = node.commandClasses["Multilevel Switch"];
    if (multilevelSwitch) {
        console.log(`  Exists in API: Yes`);
        console.log(`  Version: v${multilevelSwitch.version}`);
        console.log(`  Supported: ${multilevelSwitch.isSupported()}`);
        console.log(`  Controlled: ${multilevelSwitch.isControlled()}`);
        
        // Try to get the value ID directly
        try {
            const valueId = multilevelSwitch.getValueId("currentValue");
            console.log(`  Value ID for currentValue:`, valueId);
        } catch (err) {
            console.log(`  Cannot get value ID: ${err.message}`);
        }
    }, 2000);
}


// Start the driver
await driver.start();
