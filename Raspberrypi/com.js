// @ts-nocheck
// import fs from "fs";
import { Driver } from "zwave-js";
import temaptureValueId from 'ThermostatValueId.json' assert { type: "json" };
import lightValueId from 'light1.json' assert { type: "json" };
import time from time;

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

let currentTime = new Date().getHours();

// const currentDir = process.cwd();
const pathToController = "/dev/serial/by-id/usb-1a86_USB_Single_Serial_5A49039988-if00"

var options = {
    host: "57cb3b2fa5314c20af5ed5e2001f4a4c.s1.eu.hivemq.cloud",
    port: 8883,
    protocol: "mqtts",
    username: "Raspberry",
    password: "RaspberrypiPassword1"
}

const driver = new Driver(
    // Tell the driver which serial port to use
    pathToController,
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

var client = driver.controller.mqttClient;

client.on(connect, function () {
    console.log("Connected to MQTT broker");
})

client.on(error, function (error) {
    console.log("MQTT Connection Error: ", error);
});

client.on('message', function (topic, message) {
    console.log('Received message:', topic, message.toString());
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

// assign nodes
// ping nodes
// if ping good read current values
// change values based on current values
// else log node not found

async function main() {
    const LightNode1 = driver.controller.nodes.get(LIGHTID[0]);
    const ThermostatNode = driver.controller.nodes.get(THERMID);
    // Ping nodes to check if they are available
    let pingLight = await pingingNode(LightNode1);
    let pingThermostat = await pingingNode(ThermostatNode);
    if(pingLight){
        let currentLightValue = await readLight(LightNode1, LIGHTID[0]);
        console.log(`Current Light Level: ${currentLightValue}`);
        if (currentLightValue > 0){
            await changeLight(LightNode1, LIGHTOFF);
        }else{
            await changeLight(LightNode1, LIGHTON);
        }
    }else{
        console.log("Light node not found");
    }
    if(pingThermostat){
        let temps = await readThermostat(ThermostatNode);
        console.log(`Current Heating Setpoint: ${temps[0]}`);
        console.log(`Current Cooling Setpoint: ${temps[1]}`);
        await thermostat(ThermostatNode, COLDTEMPSET, HOTTEMPSET, temps);
    }
    else{
        console.log("Thermostat node not found");
    }
}

// reasoning for currentTime limits is to avoid AC running at night and heating during the morining hours
// 23 = 11pm, 11 = 11am
// Jean keeps balcony door open at night
async function thermostat(node, coolingSetpoint, heatingSetpoint, currentTemp){
    if(currentTemp[0] < coolingSetpoint && currentTime <=  23 && currentTime >= 11){
        await node.setValue(HEATINGVALUEID, heatingSetpoint);
    }
    if(currentTemp[1] > heatingSetpoint && currentTime <=  23 && currentTime >= 11){
        await node.setValue(COOLINGVALUEID, coolingSetpoint);
    }
}

async function changeLight(node, settingLightLevel){
    console.log(`Changing light ${node.id} level to ${settingLightLevel}`); 
    await node.setValue(LIGHTTARGETVALUEID, settingLightLevel);
    let currentValue = await node.getValue(LIGHTLEVELVALUEID);
    console.log(`Current light level: ${currentValue}`);
    
}

async function readLight(node, id){
    // currently assigning Global variable currentLightValue
    let oldLightValue = currentLightValue;
    let currentLightValue = await node.getValue(lightLevelValueId);
    if (oldLightValue != currentLightValue && CHANGEMEWHENFINISHED){
        console.log(`Light ${id} level changed: ${currentLightValue}`);
        client.publish('home/zwave/light/level', `Light ${id} Level: ${currentLightValue}`);
    }
}

async function readThermostat(node){
    let heatingSetpoint = await node.getValue(heatingValueId);
    let coolingSetpoint = await node.getValue(coolingValueId);
    if(temps[0] != heatingSetpoint || temps[1] != coolingSetpoint){
        console.log(`Thermostat ${node.id} setpoints changed: Heating - ${heatingSetpoint}, Cooling - ${coolingSetpoint}`);
        client.publish('home/zwave/thermostat/setpoints', `Heating: ${heatingSetpoint}, Cooling: ${coolingSetpoint}`);
    }
    // currently assigning Global variable temps
    let temps = [heatingSetpoint, coolingSetpoint];
}

async function pingingNode(node){
    await node.ping();
    if (!node) {
        console.log(`Node not found`);
        return false;
    }else{
        return true;
    }
}

await driver.start();
