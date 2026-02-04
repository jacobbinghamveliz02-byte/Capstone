// @ts-nocheck
// import fs from "fs";
import { Driver } from "zwave-js";
import temaptureValueId from 'ThermostatValueId.json' assert { type: "json" };
import lightValueId from 'light1.json' assert { type: "json" };
import mqtt from "mqtt";

const LIGHTOFF = 0;
const LIGHTON = 99;

// [5-67-0-setpoint-1] Setpoint (Heating) 

const TEMPATURE = temaptureValueId[0];

const HEATINGVALUEID = temaptureValueId[6];

const COOLINGVALUEID = temaptureValueId[7];

const LIGHTLEVELVALUEID = lightValueId[1];

const LIGHTTARGETVALUEID = lightValueId[3];

const THERMID = 5; // Node ID of the thermostat
const LIGHTID = [6]; // Node IDs of the lights          NEED TO CHANGE IF ADDING MORE LIGHTS

const CHANGEMEWHENFINISHED = false; // Set to true to enable change detection and MQTT publishing. currently turned off to limit messages

let currentLightValue;
let heatingSetpoint;
let coolingSetpoint;
let oldHeatingSetpoint;
let oldCoolingSetpoint;
let startHour;
let endHour;
let currentTime;

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
// Format of message: "Time: Heating/cooling: x: StartHour: EndHour"

client.on('message', async function (topic, message) {
    let stringMessage = String(message);
    let messageArray = stringMessage.split(": ");
    const ThermostatNode = driver.controller.nodes.get(THERMID);
    const lightNode1 = driver.controller.nodes.get(LIGHTID[0]);
    if(stringMessage.includes("Light")){
        let pingLight = await pingingNode(lightNode1);
        if(pingLight){
            if(stringMessage.includes("on")){
                changeLight(lightNode1, LIGHTON);
            }else{
                changeLight(lightNode1, LIGHTOFF);
            }
        }else{
            client.publish(`home/zwave/light/current`, `Light node not found`);
        }
    }else if(stringMessage.includes("Thermostat")){
        mainThermostat(stringMessage);
    }else if(stringMessage.includes("Time")){
        let pingThermostat = await pingingNode(ThermostatNode);
        let timedTemp = messageArray.splice(1, 2)
        startHour = parseInt(messageArray[3]);
        endHour = parseInt(messageArray[4]);
        mainThermostat(stringMessage, messageArray);
    }
});


async function main() {
}

async function mainThermostat(stringMessage, messageArray){
    let pingThermostat = await pingingNode(ThermostatNode);
    if(pingThermostat){
        if(messageArray[2] == "heating"){
            heatingSetpoint = parseInt(messageArray[3]);
            await thermostat(ThermostatNode, heatingSetpoint, true);
        }else if(messageArray[2] == "cooling"){
            coolingSetpoint = parseInt(messageArray[3]);
            await thermostat(ThermostatNode, coolingSetpoint, false);
        }
    }else{
            client.publish(`home/zwave/thermostat/current`, `Thermostat node not found`);
    }
}
// reasoning for currentTime limits is to avoid heating running at night and the morining hours
// 23 = 11pm, 11 = 11am
// Jean keeps balcony door open at night
async function thermostat(node, setpoint, shouldHeat){
    currentTime = new Date().getHours();
    if(currentTime < 11 || currentTime > 23){
        if(setpoint != null && setpoint != undefined){
        if(shouldHeat && oldHeatingSetpoint != setpoint){
            await node.setValue(HEATINGVALUEID, setpoint);
            oldHeatingSetpoint = setpoint;
            client.publish(`home/zwave/thermostat/current`, `Heating set to ${setpoint}`);
        }
        if(!shouldHeat && oldCoolingSetpoint != setpoint){
            await node.setValue(COOLINGVALUEID, setpoint);
            oldCoolingSetpoint = setpoint;
            client.publish(`home/zwave/thermostat/current`, `Cooling set to ${setpoint}`);
        }
    }else{
        client.publish(`home/zwave/thermostat/current`, `unable to adjust temperature outside of time window`);
    }
    }
}

async function changeLight(node, settingLightLevel){
    console.log(`Changing light ${node.id} level to ${settingLightLevel}`); 
    await node.setValue(LIGHTTARGETVALUEID, settingLightLevel);
    let currentValue = await node.getValue(LIGHTLEVELVALUEID);
    client.publish(`home/zwave/light/current`, `${currentValue}`);
}

await driver.start();
