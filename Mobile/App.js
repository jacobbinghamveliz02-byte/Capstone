import {Text, SafeAreaView, StyleSheet, FlatList, TouchableOpacity, View, Button, TextInput } from 'react-native';
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

export default function App() {
  const [thermostatPowerStatus, setThermostatPowerStatus] = useState("on");
  const [currentTemp, setCurrentTemp] = useState("");
  const [thermostatMode, setThermostatMode] = useState("");
  const [currentBattery, setCurrentBattery] = useState("");
  const [lightLevel, setLightLevel] = useState("");
  const [client, setClient] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");

  useEffect(() => {
    var options = {
      host: "57cb3b2fa5314c20af5ed5e2001f4a4c.s1.eu.hivemq.cloud",
      port: 8884,
      protocol: "wss",
      path: "/mqtt",
      username: "Mobile",
      password: "MobilePassword1",
      clientId: 'rn_' + Math.random().toString(16).substring(2, 10),
      keepalive: 60,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
      clean: true,
      rejectUnauthorized: false
    };

    console.log('Attempting to connect with options:', JSON.stringify(options, null, 2));
    
    try {
      const connectUrl = `wss://${options.host}:${options.port}${options.path}`;
      var mqttClient = mqtt.connect(connectUrl, options);
      setClient(mqttClient);

      mqttClient.on("connect", function () {
        console.log("Connected to HiveMQ Cloud via WebSockets!");
        setConnectionStatus("connected");
        alert("SUCCESS! Connected to HiveMQ Cloud!");
        mqttClient.subscribe('home/app/#');
      });

      mqttClient.on('error', function (error) {
        console.log('MQTT Error:', error);
        setConnectionStatus("error");
        alert(`Connection Failed:\n${error.message}`);
      });

      mqttClient.on('offline', function() {
        console.log('MQTT client offline');
        setConnectionStatus("offline");
      });

      mqttClient.on('reconnect', function() {
        console.log('Reconnecting to HiveMQ Cloud...');
        setConnectionStatus("reconnecting");
      });

      mqttClient.on('message', function (topic, message) {
        const messageString = message.toString();
        
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
      
    } catch (error) {
      console.error('Failed to create MQTT client:', error);
      setConnectionStatus("failed");
    }
  }, []);

  return (
    <NavigationContainer>
      <View style={{position: 'absolute', top: 40, right: 20, zIndex: 1000}}>
        <View style={{
          backgroundColor: connectionStatus === 'connected' ? '#4CAF50' : connectionStatus === 'reconnecting' ? '#FFC107' : '#F44336', 
          padding: 8,
          borderRadius: 20, 
          paddingHorizontal: 15
        }}>
          <Text style={{color: 'white', fontWeight: 'bold'}}>
            {connectionStatus === 'connected' ? '● Connected' : 
             connectionStatus === 'reconnecting' ? '⟳ Reconnecting' : 
             connectionStatus === 'error' ? '✗ Error' : '○ Disconnected'}
          </Text>
        </View>
      </View>
      
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home">
          {props => <HomeScreen {...props} 
            client={client}
            thermostatMode={thermostatMode} 
            currentTemp={currentTemp} 
            currentBattery={currentBattery} 
            lightLevel={lightLevel} 
            thermostatPowerStatus={thermostatPowerStatus} 
          />}
        </Stack.Screen>
        <Stack.Screen name="Lights" component={LightControl} />
        <Stack.Screen name="Thermostat">
          {props => <ThermostatControl {...props} 
            client={client} 
            thermostatPowerStatus={thermostatPowerStatus} 
            setThermostatPowerStatus={setThermostatPowerStatus} 
          />}
        </Stack.Screen>
        <Stack.Screen name="TimedControl" component={TimedControl} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function HomeScreen({ navigation, client, thermostatMode, currentTemp, currentBattery, lightLevel, thermostatPowerStatus }){

  function testConnection() {
    if (client && client.connected) {
      const testTopic = "home/app/test";
      const testMessage = "ping_" + Date.now();
      client.publish(testTopic, testMessage);
      alert(`✅ Test message sent!\nTopic: ${testTopic}\nMessage: ${testMessage}\n\nCheck HiveMQ WebSocket client to verify receipt.`);
    } else {
      alert("❌ Client not connected!");
    }
  }

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
      <TouchableOpacity 
        onPress={testConnection}
        style={{
          backgroundColor: client?.connected ? '#4CAF50' : '#9E9E9E',
          padding: 15,
          margin: 20,
          borderRadius: 10,
          alignItems: 'center'
        }}
      >
        <Text style={{color: 'white', fontWeight: 'bold'}}>
          {client?.connected ? '📤 Test MQTT Publish' : '🔌 Not Connected'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function LightControl({ navigation }){
  return (
    <View>
      <Text>Light</Text>
    </View>
  )
}

function ThermostatControl({ navigation, client, thermostatPowerStatus, setThermostatPowerStatus }){
  const [temperatureInput, setTemperatureInput] = useState("");
  
  useEffect(() => {
    if (client && client.connected) {
      client.publish("home/zwave/thermostat/power/get", "request");
    }
  }, [client]);

  function handleThermostatControl(thermostatType){
    const tempNum = Number(temperatureInput);
    if(tempNum !== "" && tempNum >= 68 && tempNum <= 75){
      alert("Temperature: " + temperatureInput + " type: " + thermostatType);
      client.publish("home/zwave/thermostat/set", thermostatType + ": " + temperatureInput);
      navigation.navigate('Home');
    }else if(tempNum === ""){
      alert("Please enter a number!");
    }else if(tempNum > 75 || tempNum < 68){
      alert("Please enter a number between 68 and 75");
    }
  }

  function poweringOffFunc(){
    const newPowerState = thermostatPowerStatus === "on" ? "off" : "on";
    alert(`Turning thermostat ${newPowerState}`);
    client.publish("home/zwave/thermostat/power/set", newPowerState);
  }

  const Options = ({ thermostatType }) => (
    <TouchableOpacity onPress={() => handleThermostatControl(thermostatType)}>
      <Text>{thermostatType}</Text>
    </TouchableOpacity>
  );

  const options = [
    { btn: <Options thermostatType={"Heating"} /> },
    { btn: <Options thermostatType={"Cooling"} /> }
  ];

  const Item = ({ item }) => {
    return <View style={styles.container}>{item.btn}</View>;
  };

  return (
    <View>
      <Text>Current Power Status: {thermostatPowerStatus}</Text>
      <TextInput 
        keyboardType="numeric" 
        onChangeText={setTemperatureInput} 
        value={temperatureInput} 
        placeholder="Enter temperature (68-75)"
      />
      <FlatList data={options} renderItem={Item} numColumns={2} />
      <Button 
        title={thermostatPowerStatus === "on" ? "Power off" : "Power on"}  
        onPress={() => poweringOffFunc()}
      />
      <Button 
        title={"Timed Settings"} 
        onPress={() => navigation.navigate('TimedControl')}
      />
    </View>
  );
}

function TimedControl({ navigation }){
  const [startPeriod, setStartPeriod] = useState("AM");
  const [endPeriod, setEndPeriod] = useState("AM");
  
  const PeriodSelector = ({ period, setPeriod, label }) => (
    <View style={styles.periodContainer}>
      <Text style={styles.periodLabel}>{label}</Text>
      <View style={styles.toggleContainer}>
        <Text style={[styles.toggleText, period === 'AM' && styles.activeToggleText]}>
          AM
        </Text>
        <Switch 
          value={period === 'PM'} 
          onValueChange={(value) => setPeriod(value ? 'PM' : 'AM')} 
          trackColor={{ false: '#767577', true: '#2196F3' }} 
          thumbColor={period === 'PM' ? '#f4f3f4' : '#f4f3f4'}
        />
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
  );
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