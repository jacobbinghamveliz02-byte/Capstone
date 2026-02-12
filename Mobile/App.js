import {Text, SafeAreaView, StyleSheet, FlatList, TouchableOpacity, View, NumButton, TextInput, Button } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState, useEffect } from 'react';
import { Switch } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

import mqtt from 'mqtt';

const Stack = createNativeStackNavigator();

let lightLevel;
let thermostatMode;
let currentTemp;
let currentBattery;
let powerStatus;


// Note to self constantly check messages but only publish message when a state changes
  // Menu: On home page show status of thermostat and Light
  // Menu: Create text boxes to show current status of the thermostat
  // Menu: Create either number or text boxes to show current status of the tempature
    // Thermostat: Create button to change heating or cooling when pressed goes back to menu
    // Thermostat: Create dropdown menu to change heating/cooling with current setting in () when submitted if outside the current time constraint says "completed successfully" or if in current time constraint says "can't complete due to time constraint"
                              // Note to self make limits with limits being 68 - 75 for both cooling and heating
                              // EX /Heating (x)\ [<input>]
                              // or (/\ = dropdown, [] = text/number box)
                              // EX /Cooling (y)\ [<input>]
                              //Submit
    // Light: Add either yellow and black square to resemble off/on or add text box that says on or off 
    // Light: Create button when pressed turns on or off light and takes you back to the home page

export default function App() {
  const [thermostatPowerStatus, setThermostatPowerStatus] = useState("on");
  const [currentTemp, setCurrentTemp] = useState("");
  const [thermostatMode, setThermostatMode] = useState("");
  const [currentBattery, setCurrentBattery] = useState("");
  const [lightLevel, setLightLevel] = useState("");
  const [client, setClient] = useState(null);

  useEffect(() => {
    var options = {
      host: "57cb3b2fa5314c20af5ed5e2001f4a4c.s1.eu.hivemq.cloud",
      port: 8884,  // WebSockets port - CORRECT for React Native
      protocol: "mqtts",
      username: "Mobile",
      password: "MobilePassword1",
      clientId: 'mobile_' + Math.random().toString(16).substr(2, 8),
      // Add these options for better compatibility
      rejectUnauthorized: false,  // For self-signed certificates
      path: '/mqtt'  // Some brokers need this
    };

    var mqttClient = mqtt.connect(options);
    setClient(mqttClient);

    mqttClient.on("connect", function () {
      console.log("Connected to MQTT broker");
      mqttClient.subscribe('home/app/#');
    });

    mqttClient.on('error', function (error) {
      console.log(error);
    });

    mqttClient.on('message', function (topic, message) {
      const messageString = message.toString();
      alert(`Received: ${topic} - ${messageString}`);
      
      if (topic === 'home/app/thermostat/current/power') {
        console.log(`Updating thermostat power to: ${messageString}`);
        setThermostatPowerStatus(messageString);
      }
      else if (topic === 'home/app/thermostat/current') {
        setThermostatMode(messageString);
      }
      else if (topic === 'home/app/thermostat/current/temperature') {
        setCurrentTemp(messageString);
      }
      else if (topic === 'home/app/thermostat/battery') {
        const batteryValue = messageString.replace('%', '');
        setCurrentBattery(batteryValue);
      }
      else if (topic === 'home/app/light/current') {
        setLightLevel(messageString === '99' ? 'On' : 'Off');
      }
    });

    return () => {
      if (mqttClient) {
        mqttClient.end();
      }
    };
  }, []);



  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home">
          {props => <HomeScreen {...props} thermostatMode={thermostatMode} currentTemp={currentTemp} currentBattery={currentBattery} lightLevel={lightLevel} thermostatPowerStatus={thermostatPowerStatus} />}
        </Stack.Screen>
        <Stack.Screen name="Lights" component={LightControl} />
        <Stack.Screen name="Thermostat">
          {props => <ThermostatControl {...props} client={client} thermostatPowerStatus={thermostatPowerStatus} setThermostatPowerStatus={setThermostatPowerStatus} />}
        </Stack.Screen>
        <Stack.Screen name="TimedControl" component={timedControl} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}


function HomeScreen({ navigation, thermostatMode, currentTemp, currentBattery, lightLevel, thermostatPowerStatus }){

  function checkingWhichScreen(differentOption) {
    if (differentOption == 'Lights') {
      navigation.navigate('Lights');
    } else if (differentOption == 'Thermostat') {
      navigation.navigate('Thermostat');
    }
  }

    const Item = ({ item }) => {
    return <View style={styles.container}>{item.btn}</View>;
  };

  const textItem = ({ item }) => {
    return <View style={styles.container}> {item.txt}</View>
  }

   const Options = ({ differentOption }) => (
    <TouchableOpacity onPress={() => checkingWhichScreen(differentOption)}>
      <Text>{differentOption}</Text>
    </TouchableOpacity>
  );


  const options = [
    { btn: <Options differentOption={'Lights'} /> },
    { btn: <Options differentOption={'Thermostat'} /> },
  ];

  const currentData = [
    { txt: <Text>Thermostat: {thermostatMode} {currentTemp}°F (Power: {thermostatPowerStatus})</Text> },
    { txt: <Text>Light: {lightLevel} </Text> },
    { txt: <Text>Thermostat battery: {currentBattery}% </Text> } 
  ];

  return(  
    <View>
      <FlatList data={options} renderItem={Item} numColumns={2} />
      <FlatList data={currentData} renderItem={textItem} numColumns={3} />
    </View>
  )
}

function LightControl({ navigation }){
  return (
    <View>
    Light
    </View>
  )
}

function ThermostatControl({ navigation, client, thermostatPowerStatus, setThermostatPowerStatus }){
  const [temperatureInput, setTemperatureInput] = useState("");
  useEffect(() => {
    client.publish("home/zwave/thermostat/power/get", "request");
  }, []);

  function handleThermostatControl(thermostatType){
    const tempNum = Number(temperatureInput);
    if(tempNum != "" && tempNum >= 68 && tempNum <= 75){
      alert("Temperature: " + temperatureInput + " type: " + thermostatType)
      client.publish("home/zwave/thermostat/set", thermostatType + ": " + temperatureInput)
      navigation.navigate('Home');
    }else if(tempNum == ""){
      alert("Please enter a number!")
    }else if(tempNum > 75 || tempNum < 68){
      alert("Please enter a number between 68 and 75")
    }
  }

  function poweringOffFunc(){
    const newPowerState = thermostatPowerStatus === "on" ? "off" : "on";
    const statusText = newPowerState;
    alert(`Turning thermostat ${statusText}`);
    client.publish("home/zwave/thermostat/power/set", statusText);
  }

  const Options = ({ thermostatType }) => (
    <TouchableOpacity onPress={() => handleThermostatControl(thermostatType)}>
      <Text>{thermostatType}</Text>
    </TouchableOpacity>
  )

  const options = [
    { btn: <Options thermostatType={"Heating"} /> },
    { btn: <Options thermostatType={"Cooling"} /> }
  ]

  const Item = ({ item }) => {
    return <View style={styles.container}>{item.btn}</View>;
  };

  return (
    <View>
      <Text>Current Power Status: {thermostatPowerStatus}</Text>
      <TextInput keyboardType="numeric" onChangeText={setTemperatureInput} value={temperatureInput} placeholder="Enter temperature (68-75)"/>
      <FlatList data={options} renderItem={Item} numColumns={2} />
      <Button 
        title={thermostatPowerStatus === "on" ? "Power off" : "Power on"}  
        onPress={() => poweringOffFunc()}
      />
      <Button title={"Timed Settings"} onPress={() => navigation.navigate('TimedControl')}/>
    </View>
  )
}

function timedControl({ navigation }){
    const [startPeriod, setStartPeriod] = useState("AM");
    const [endPeriod, setEndPeriod] = useState("AM");
    const PeriodSelector = ({ period, setPeriod, label }) => (
      <View style={styles.periodContainer}>
        <Text style={styles.periodLabel}>{label}</Text>
        <View style={styles.toggleContainer}>
          <Text style={[styles.toggleText, period === 'AM' && styles.activeToggleText]}>
            AM
          </Text>
          <Switch value={period === 'PM'} onValueChange={(value) => setPeriod(value ? 'PM' : 'AM')} trackColor={{ false: '#767577', true: '#2196F3' }} thumbColor={period === 'PM' ? '#f4f3f4' : '#f4f3f4'}/>
          <Text style={[styles.toggleText, period === 'PM' && styles.activeToggleText]}>
            PM
          </Text>
        </View>
      </View>
    );
    return (
      <View>
        <PeriodSelector period={startPeriod} setPeriod={setStartPeriod} label="Start Time (AM/PM)"/>
        <PeriodSelector period={endPeriod} setPeriod={setEndPeriod} label="End Time (AM/PM)"/>
      </View>
    )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: '28%',
    padding: 10,
    backgroundColor: '#ffe9d2',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodContainer: {
    marginBottom: 20,
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  toggleText: {
    fontSize: 16,
    color: '#adb5bd',
    fontWeight: '500',
  },
  activeToggleText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
});



