// @ts-nocheck
// import fs from "fs";
import { Driver } from "zwave-js";
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

const TEMPATURE = {
  commandClass: 49, // Multilevel Sensor command class
  endpoint: 0,
  property: "Air temperature",
  propertyKey: undefined // Not the string "undefined", but actual undefined
};

const HEATINGVALUEID = {
  commandClass: 67, // Thermostat Setpoint
  endpoint: 0,
  property: "setpoint",
  propertyKey: 1 // Heating
};

const COOLINGVALUEID = {
  commandClass: 67, // Thermostat Setpoint
  endpoint: 0,
  property: "setpoint",
  propertyKey: 2 // Cooling
};

const CURRENTTHERMOSTATMODEID =  {
    commandClassName: "Thermostat Mode",
    commandClass: 64,
    endpoint: 0,
    property: "mode",
    propertyKey: undefined,
    propertyName: "mode"
};

const CURRENTTHERMOSTATBATTERYVALUEID = {
  commandClass: 128, // Battery command class
  endpoint: 0,
  property: "level",
  propertyKey: undefined
};

const LIGHTLEVELVALUEID =  {
    commandClassName: "Multilevel Switch",
    commandClass: 38,
    endpoint: 0,
    property: "currentValue",
    propertyName: "currentValue"
};


const LIGHTTARGETVALUEID = {
    commandClassName: "Multilevel Switch",
    commandClass: 38,
    endpoint: 0,
    property: "targetValue",
    propertyName: "targetValue"
};

const THERMID = 5; // Node ID of the thermostat
const LIGHTID = [6]; // Node IDs of the lights          NEED TO CHANGE IF ADDING MORE LIGHTS
var client = mqtt.connect(options);

let oldHeatingSetpoint;
let oldCoolingSetpoint;
let startHour;
let endHour;
let currentTime;
let timedInfo;
let timeSetTemp;
let oldTimeSetTemp;
let previouslyThermostatMode;
let thermostatNode;
let lightNode1;
let oldBatteryLevel;
let oldCurrentTemp;
let oldPowerValue;
let oldLightLevel;
let oldModeValue;

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
        client.subscribe('home/zwave');
    })

    client.on("error", function (error) {
        console.log("MQTT Connection Error: ", error);
    });

    

    client.on('message', async function (topic, message) {
        console.log("Topic: " + topic + "Message: " + message)
        let topicString = String(topic);
        let messageString = String(message);
        console.log("(String) Topic: " + topicString + "Message: " + messageString)
        // light control
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
                client.publish(`home/app/light/current/power`, `Lost connection to light`);
            }
            // Thermostat control
        }else if(topicString.startsWith('home/zwave/thermostat')){
            console.log("Received thermostat control message: " + messageString);
            let pingThermostat = await pingingNode(thermostatNode);
            
            if(pingThermostat){
                let messageArray = messageString.split(": ");
                // normal temperature control
                if(topicString == 'home/zwave/thermostat/set'){
                    console.log("home/zwave/thermostat/set received with message: " + messageString);
                    if(messageString.toLowerCase().startsWith('heating')){
                        console.log("Setting heating setpoint");
                        let heatingSetpoint = parseInt(messageArray[1]);
                        await betterThermostat(heatingSetpoint, true);
                    }else if(messageString.toLowerCase().startsWith('cooling')){
                        console.log("Setting cooling setpoint");
                        let coolingSetpoint = parseInt(messageArray[1]);
                        await betterThermostat(coolingSetpoint, false);
                    }
                    // Time control
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
                        await turnThermostatOffOn(1);
                    }else if(messageString == 'off'){
                        await turnThermostatOffOn(0);
                    }
                }else if(topicString == 'home/zwave/thermostat/power/get' ){
                    let powerValue = await thermostatNode.getValue(CURRENTTHERMOSTATMODEID);
                    client.publish(`home/app/thermostat/current/power`, `${powerValue}`);
                    console.log("Received power get request, current power value: " + powerValue);
                }else if(topicString == 'home/zwave/getAll'){
                    basicChecking();
                }else{
                    client.publish(`home/app/thermostat/current/power`, `Lost connection to thermostat`);
                }
            }
        }
    });
    setInterval(basicChecking, 10000); // Check every second
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

async function getCurrentTemperature(){
    let currentTemp = await thermostatNode.getValue(TEMPATURE);
    if(oldCurrentTemp != currentTemp && currentTemp != null){
        console.log(`Current temperature: ${currentTemp}°C`);
        console.log(`Current temperature changed from ${oldCurrentTemp}°C to ${currentTemp}°C`);
        oldCurrentTemp = currentTemp;
        client.publish(`home/app/thermostat/current/temperature`, `${currentTemp}`);
    }
}

async function getBatteryLevel(){
    let batteryLevel = await thermostatNode.getValue(CURRENTTHERMOSTATBATTERYVALUEID);
    if(oldBatteryLevel != batteryLevel && batteryLevel != null){
        console.log(`Battery level changed from ${oldBatteryLevel}% to ${batteryLevel}%`);
        client.publish(`home/app/thermostat/battery`, `${batteryLevel}%`);
        oldBatteryLevel = batteryLevel; // update oldBatteryLevel to current battery level

    }
}

async function checkThermostatPower(){
    let powerValue = await thermostatNode.getValue(CURRENTTHERMOSTATMODEID);
    if(powerValue != null){
        if(powerValue != oldPowerValue){
            if(powerValue == 0){
                oldPowerValue = powerValue;
                console.log("Thermostat is off");
                client.publish(`home/app/thermostat/current/power`, `off`);
            }else{
                oldPowerValue = powerValue;
                console.log("Thermostat is on");
                client.publish(`home/app/thermostat/current/power`, `on`);
            }
        }
    }else{
        client.publish(`home/app/thermostat/current/power`, `"Lost connection to thermostat"`);
    }
}

async function checkingLight(){
    let lightPing = await pingingNode(lightNode1);
    if(!lightPing){
        client.publish(`home/app/light/current/power`, `Lost connection to light`);
        return;
    }else{
        let lightLevel = await lightNode1.getValue(LIGHTLEVELVALUEID);
        if(oldLightLevel != lightLevel && lightLevel != null){
            console.log(`Current light level: ${lightLevel}`);
            console.log(`Current light level changed from ${oldLightLevel} to ${lightLevel}`);
            client.publish(`home/app/light/current/level`, `${lightLevel}`);
            oldLightLevel = lightLevel;
        }
    }

}

async function basicChecking(){
    await getCurrentTemperature();
    await getBatteryLevel();
    await scheduleCheck();
    await checkThermostatPower();
    await checkingLight();
    // console.log("Battery: " + await thermostatNode.getValue(CURRENTTHERMOSTATBATTERYVALUEID));
    // console.log("Current temp: " + await thermostatNode.getValue(TEMPATURE));
    // console.log("Power value: " + await thermostatNode.getValue(CURRENTTHERMOSTATMODEID));
    // console.log("Heating setpoint: " + await thermostatNode.getValue(HEATINGVALUEID));
    // console.log("Cooling setpoint: " + await thermostatNode.getValue(COOLINGVALUEID));
}

async function turnThermostatOffOn(mode){
    let currentMode = await thermostatNode.getValue(CURRENTTHERMOSTATMODEID);
    oldModeValue = currentMode;
    if(mode == 0){
        console.log("Turning thermostat off");
        client.publish(`home/app/thermostat/current/power`, `off`);
        await thermostatNode.setValue(CURRENTTHERMOSTATMODEID, mode);
    }else{
        console.log("Turning thermostat on");
        client.publish(`home/app/thermostat/current/power`, `on`);
        await thermostatNode.setValue(CURRENTTHERMOSTATMODEID, oldModeValue);
        
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
                    await thermostatNode.setValue(CURRENTTHERMOSTATMODEID, 1);
                    oldTimeSetTemp = setpoint;
                    client.publish(`home/app/thermostat/current`, `Heating set to ${setpoint}`);
                }else if(!shouldHeat && oldTimeSetTemp != setpoint){
                    console.log("Setting timed cooling setpoint");
                    await thermostatNode.setValue(COOLINGVALUEID, setpoint);
                    await thermostatNode.setValue(CURRENTTHERMOSTATMODEID, 2);
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
