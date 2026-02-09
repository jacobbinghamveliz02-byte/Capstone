// @ts-nocheck
// import fs from "fs";
import { Driver } from "zwave-js";
import tempetureValueId from './ThermostatValueId.json' assert { type: 'json' };
import lightValueId from './light1.json' assert { type: 'json' };
import mqtt from "mqtt";

const PATHTOCONTROLLER = "/dev/serial/by-id/usb-1a86_USB_Single_Serial_5A49039988-if00"
const LIGHTOFF = 0;
const LIGHTON = 99;
const driver = new Driver(
    // Tell the driver which serial port to use
    PATHTOCONTROLLER,
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

var options = {
    host: "57cb3b2fa5314c20af5ed5e2001f4a4c.s1.eu.hivemq.cloud",
    port: 8883,
    protocol: "mqtts",
    username: "Raspberry",
    password: "RaspberrypiPassword1"
    };

// [5-67-0-setpoint-1] Setpoint (Heating) 

const TEMPATURE = tempetureValueId[0];
const HEATINGVALUEID = tempetureValueId[6];
const COOLINGVALUEID = tempetureValueId[7];
const CURRENTTHERMOSTATMODEID = tempetureValueId[3];
const CURRENTTHERMOSTATBARRIERVALUEID = tempetureValueId[30];
const LIGHTLEVELVALUEID = lightValueId[1];
const LIGHTTARGETVALUEID = lightValueId[3];
const THERMID = 5; // Node ID of the thermostat
const LIGHTID = [6]; // Node IDs of the lights          NEED TO CHANGE IF ADDING MORE LIGHTS
var client = mqtt.connect(options);

const CHANGEMEWHENFINISHED = false; // Set to true to enable change detection and MQTT publishing. currently turned off to limit messages

let oldHeatingSetpoint;
let oldCoolingSetpoint;
let startHour;
let endHour;
let currentTime;
let timedInfo;
let timeSetTemp;
let oldTimeSetTemp;
let previouslyThermostatMode;
let batteryLevel;

let thermostatNode;
let lightNode1;

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


// Format of message: "on/off" 
// Format of message: "heating/cooling: x"
// Format of message: "heating/cooling: x: StartHour: EndHour: "
// Ex: array = ["heating/cooling", "x", startHour, "EndHour"]

// Topics:
// home/zwave/light/set
// home/zwave/thermostat/set
// home/zwave/thermostat/time/set
// home/zwave/thermostat/time/remove
// home/zwave/thermostat/power/set

// home/app/light/current
// home/app/thermostat/current
// home/app/thermostat/time/current
// home/app/thermostat/battery
// home/app/thermostat/power

async function main() {
    thermostatNode = driver.controller.nodes.get(THERMID);
    lightNode1 = driver.controller.nodes.get(LIGHTID[0]);

    client.on("connect", function () {
        console.log("Connected to MQTT broker");
    })

    client.on("error", function (error) {
        console.log("MQTT Connection Error: ", error);
    });

    client.subscribe('home/zwave/#');

    client.on('message', async function (topic, message) {
        console.log("Topic: " + topic + "Message: " + message)
        let topicString = String(topic);
        let messageString = String(message);
        console.log("(String) Topic: " + topicString + "Message: " + messageString)
        if(topicString == 'home/zwave/light/set'){
            console.log("Received light control message: " + messageString);
            let pingLight = await pingingNode(lightNode1);
            if(pingLight){
                if(messageString == 'on'){
                    await changeLight(LIGHTON);
                }else if(messageString == 'off'){
                    await changeLight(LIGHTOFF);
                }
            }else{
                client.publish(`home/app/light/current`, `Light node not found`);
            }
        }else if(topicString.startsWith('home/zwave/thermostat')){
            console.log("Received thermostat control message: " + messageString);
            let pingThermostat = await pingingNode(thermostatNode);
            if(pingThermostat){
                let messageArray = messageString.split(": ");
                if(topicString == 'home/zwave/thermostat/set'){
                    console.log("home/zwave/thermostat/set received with message: " + messageString);
                    if(messageString.startsWith('heating')){
                        console.log("Setting heating setpoint");
                        let heatingSetpoint = parseInt(messageArray[1]);
                        await betterThermostat(heatingSetpoint, true);
                    }else if(messageString.startsWith('cooling')){
                        console.log("Setting cooling setpoint");
                        let coolingSetpoint = parseInt(messageArray[1]);
                        await betterThermostat(coolingSetpoint, false);
                    }
                }else if(topicString == 'home/zwave/thermostat/time/set'){
                    timedInfo = messageArray[0];
                    timeSetTemp = parseInt(messageArray[1]);
                    startHour = parseInt(messageArray[2]);
                    endHour = parseInt(messageArray[3]);
                }else if(topicString == 'home/zwave/thermostat/time/remove'){
                    startHour = null;
                    endHour = null;
                    timeSetTemp = null;
                    timedInfo = null;
                    oldTimeSetTemp = null;
                    client.publish(`home/app/thermostat/current`, `Timed temperature control removed`);
                }else if(topicString == 'home/zwave/thermostat/power/set'){
                    if(messageString == 'on'){
                        await turnThermostatOff(1);
                    }else if(messageString == 'off'){
                        await turnThermostatOff(0);
                    }
            }else{
                client.publish(`home/app/thermostat/current`, `Thermostat node not found`);
            }
            }
        }
    }
);
    setInterval(scheduleCheck, 60000); // Check every minute
    setInterval(getBatteryLevel, 60000);
}

async function scheduleCheck(){
    currentTime = new Date().getHours();
    if(startHour != null && endHour != null){
        if(currentTime >= startHour && currentTime <= endHour){
            if(previouslyThermostatMode != null && previouslyThermostatMode != await thermostatNode.getValue(CURRENTTHERMOSTATMODEID)){
                previouslyThermostatMode = await thermostatNode.getValue(CURRENTTHERMOSTATMODEID);
            }
            if(previouslyThermostatMode == 1){ // heating mode
                oldHeatingSetpoint = await thermostatNode.getValue(HEATINGVALUEID);
            }else if(previouslyThermostatMode == 2){ // cooling mode
                oldCoolingSetpoint = await thermostatNode.getValue(COOLINGVALUEID);
            }
            if(oldTimeSetTemp != timeSetTemp && timedInfo == "heating"){
                await betterThermostat(timeSetTemp, true);
            }else if(oldTimeSetTemp != timeSetTemp && timedInfo == "cooling"){
                await betterThermostat(timeSetTemp, false);
            }
        }else{
            if(previouslyThermostatMode != null){
                if(previouslyThermostatMode == 1){ // heating mode
                    await betterThermostat(oldHeatingSetpoint, true);
                }else if(previouslyThermostatMode == 2){ // cooling mode
                    await betterThermostat(oldCoolingSetpoint, false);
                }
            }
        }
    }
}

async function getBatteryLevel(){
    oldBatteryLevel = batteryLevel; 
    batteryLevel = await thermostatNode.getValue(CURRENTTHERMOSTATBARRIERVALUEID);
    if(oldBatteryLevel != batteryLevel){
        console
        client.publish(`home/app/thermostat/battery`, `${batteryLevel}%`);
    }
}

async function turnThermostatOff(mode){
    await thermostatNode.setValue(CURRENTTHERMOSTATMODEID, mode);
    if(mode == 0){
        console.log("Turning thermostat off");
        client.publish(`home/app/thermostat/current`, `Thermostat turned off`);
    }else{
        console.log("Turning thermostat on");
        client.publish(`home/app/thermostat/current`, `Thermostat turned on`);
    }
}

// reasoning for currentTime limits is to avoid heating running at night and the morining hours
// 23 = 11pm, 11 = 11am
// Jean keeps balcony door open at night
async function betterThermostat(setpoint, shouldHeat){
    currentTime = new Date().getHours();
    console.log(`Current time: ${currentTime}, Start hour: ${startHour}, End hour: ${endHour}, Timed info: ${timedInfo}, Setpoint: ${setpoint}, Should heat: ${shouldHeat}`);
    if(currentTime >= 11 && currentTime <= 23){
        // timed temperature control
        if(setpoint != null){
            if(currentTime >= startHour && currentTime <= endHour && timedInfo != null){
                if(shouldHeat && oldTimeSetTemp != setpoint){
                    console.log("Setting timed heating setpoint");
                    await thermostatNode.setValue(HEATINGVALUEID, setpoint);
                    oldTimeSetTemp = setpoint;
                    client.publish(`home/app/thermostat/current`, `Heating set to ${setpoint}`);
                }else if(!shouldHeat && oldTimeSetTemp != setpoint){
                    console.log("Setting timed cooling setpoint");
                    await thermostatNode.setValue(COOLINGVALUEID, setpoint);
                    oldTimeSetTemp = setpoint;
                    client.publish(`home/app/thermostat/current`, `Cooling set to ${setpoint}`);
                }
            }else{
                // normal temperature control
                if(shouldHeat && oldHeatingSetpoint != setpoint){
                    console.log("Setting normal heating setpoint");
                    await thermostatNode.setValue(HEATINGVALUEID, setpoint);
                    oldHeatingSetpoint = setpoint;
                    client.publish(`home/app/thermostat/current`, `Heating set to ${setpoint}`);
                }else if(!shouldHeat && oldCoolingSetpoint != setpoint){
                    console.log("Setting normal cooling setpoint");
                    await thermostatNode.setValue(COOLINGVALUEID, setpoint);
                    oldCoolingSetpoint = setpoint;
                    client.publish(`home/app/thermostat/current`, `Cooling set to ${setpoint}`);
                }
            }
        }
    }else{
        client.publish(`home/app/thermostat/current`, `unable to adjust temperature outside of time window`);
    }
};

async function changeLight(settingLightLevel){
    console.log(`Changing light ${lightNode1.id} level to ${settingLightLevel}`); 
    await lightNode1.setValue(LIGHTTARGETVALUEID, settingLightLevel);
    let currentValue = await lightNode1.getValue(LIGHTLEVELVALUEID);
    client.publish(`home/app/light/current`, `${currentValue}`);
}

async function pingingNode(nodeToPing){
    try{
        await nodeToPing.ping();
        console.log(`Node ${nodeToPing.id} is responding`);
        return true;
    }catch(error){
        console.log(`Node ${nodeToPing.id} not responding: ${error}`);
        return false;
    }
}

await driver.start();
