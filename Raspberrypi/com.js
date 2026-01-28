// @ts-nocheck
// import fs from "fs";
import { Driver } from "zwave-js";
import temaptureValueId from 'ThermostatValueId.json' assert { type: "json" };
import lightValueId from 'light1.json' assert { type: "json" };
import mqtt from "mqtt";

const LIGHTOFF = 0;
const LIGHTON = 99;
const HOTTEMPSET = 69; // Desired hot temperature setting
const COLDTEMPSET = 75; // Desired cold temperature setting

// [5-67-0-setpoint-1] Setpoint (Heating) 

const TEMPATURE = temaptureValueId[0];

const HEATINGVALUEID = temaptureValueId[6];

const COOLINGVALUEID = temaptureValueId[7];

const LIGHTLEVELVALUEID = lightValueId[1];

const LIGHTTARGETVALUEID = lightValueId[3];

const THERMID = 5; // Node ID of the thermostat
const LIGHTID = [6]; // Node IDs of the lights          NEED TO CHANGE IF ADDING MORE LIGHTS

const CHANGEMEWHENFINISHED = false; // Set to true to enable change detection and MQTT publishing. currently turned off to limit messages

let currentLightValue = -1;

let temps;

// const currentDir = process.cwd();
const pathToController = "/dev/serial/by-id/usb-1a86_USB_Single_Serial_5A49039988-if00"

var options = {
    host: "57cb3b2fa5314c20af5ed5e2001f4a4c.s1.eu.hivemq.cloud",
    port: 8883,
    protocol: "mqtts",
    username: "Raspberry",
    password: "RaspberrypiPassword1"
}

var client = mqtt.connect(options);

const driver = new Driver(
    // Tell the driver which serial port to use
    pathToController,
    //configure options like security keys
    //configure options like security keys
    {
        securityKeys: {
            S0_Legacy: Buffer.from("0102030405060708090a0b0c0d0e0f10", "hex"),
            S2_Unauthenticated: Buffer.from("B748B57AB628AC74AFED8BF3EC82DF35", "hex"),
            S2_AccessControl: Buffer.from("60B3ACA9F7F00FBB479AC571AE6BC727","hex"),
            S2_Authenticated: Buffer.from("076362C7BFABB1F313E44280BAF5C627","hex"),
        },
        securityKeysLongRange: {
            S2_Authenticated: Buffer.from("63F7EF53997B0DDD9AED070FC2EF3FA7", "hex"),
            S2_AccessControl: Buffer.from("22905E5323D0D42DE1D754C9E44E5B77","hex"),
        },
    },
);

client.on("connect", function () {
    console.log("Connected to MQTT broker");
})

client.on("error", function (error) {
    console.log("MQTT Connection Error: ", error);
});

client.subscribe('home/zwave/#');

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

// Format of message: "Light: on or off" 
// Format of message: "Thermostat: heating: x or cooling: y"

client.on('message', async function (topic, message) {
    stringMessage = String(message);
    if(stringMessage.includes("Light")){
        const LightNode1 = driver.controller.nodes.get(LIGHTID[0]);
        let pingLight = await pingingNode(LightNode1);
        if(pingLight){
            if(stringMessage.includes("on")){
                changeLight(driver.controller.nodes.get(LIGHTID[0]), LIGHTON);
            }else{
                changeLight(driver.controller.nodes.get(LIGHTID[0]), LIGHTOFF);
            }
        }else{
            console.log("Light node not found");
        }
    }else if(stringMessage.includes("Thermostat")){
        let thermostatArray = stringMessage.split(", ")[1];
        const ThermostatNode = driver.controller.nodes.get(THERMID);
        let pingThermostat = await pingingNode(ThermostatNode);
        if(pingThermostat){
            if(thermostatArray[2] == "heating"){
                let heatingSetpoint = parseInt(thermostatArray[3]);
                await thermostat(ThermostatNode, COLDTEMPSET, heatingSetpoint, true);
            }else if(thermostatArray[2] == "cooling"){
                let coolingSetpoint = parseInt(thermostatArray[3]);
                await thermostat(ThermostatNode, coolingSetpoint, HOTTEMPSET, false);
            }
        }
        else{
            console.log("Thermostat node not found");
        }
    }
});

// assign nodes
// ping nodes
// if ping good read current values
// change values based on current values
// else log node not found

async function main() {
}

// reasoning for currentTime limits is to avoid AC running at night and heating during the morining hours
// 23 = 11pm, 11 = 11am
// Jean keeps balcony door open at night
async function thermostat(node, coolingSetpoint, heatingSetpoint, shouldHeat){
    let currentTime = new Date().getHours();
    if(currentTime <=  23 && currentTime >= 11 && shouldHeat){
        await node.setValue(HEATINGVALUEID, heatingSetpoint);
    }
    if(currentTime <=  23 && currentTime >= 11 && !shouldHeat){
        await node.setValue(COOLINGVALUEID, coolingSetpoint);
    }
}

async function changeLight(node, settingLightLevel){
    console.log(`Changing light ${node.id} level to ${settingLightLevel}`); 
    await node.setValue(LIGHTTARGETVALUEID, settingLightLevel);
    let currentValue = await node.getValue(LIGHTLEVELVALUEID);
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
    } else {
        console.log(`  Not found in command classes`);
    }
    
    // Check if Basic CC is available as fallback
    const basicCC = node.commandClasses.Basic;
    if (basicCC && basicCC.isSupported()) {
        console.log("\nBasic CC available - can use for on/off control");
    }
}

await driver.start();
