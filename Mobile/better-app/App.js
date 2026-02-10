import {Text, SafeAreaView, StyleSheet, FlatList, TouchableOpacity, View, NumButton,} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import mqtt from 'mqtt';

const Stack = createNativeStackNavigator();

let lightLevel;
let thermostatMode;
let currentTemp;
let currentBattery;
let powerStatus;

var options = {
    host: "57cb3b2fa5314c20af5ed5e2001f4a4c.s1.eu.hivemq.cloud",
    port: 8884,
    protocol: "mqtts",
    username: "Mobile",
    password: "MobilePassword1",
    clientId: 'mobile_' + Math.random().toString(16).substr(2, 8)
};

var client = mqtt.connect(options);

client.on("connect", function () {
    console.log("Connected to MQTT broker");
})

client.on('error', function (error) {
    console.log(error);
});

client.subscribe('home/zwave/#');

client.on('message', function (topic, message) {
  console.log("Topic: " + topic + "Message: " + message)
  let stringTopic = string(topic);
  let stringMessage = string(message);
  console.log("(String) Topic: " + stringTopic + "Message: " + stringMessage)
  stringMessage = message.toString()
  if(stringTopic == "home/app/light/current"){
    console.log("home/app/light/current was called")
    if(stringMessage == "99"){
      lightLevel = on;
    }else{
      lightLevel = off;
    }
  }else if(stringTopic == "home/app/thermostat/current"){
    console.log("home/app/thermostat/current")
    let messageArray = stringMessage.split(" set to ");
    thermostatMode = messageArray[0];
    currentTemp = messageArray[1];
  }else if(stringTopic == "home/app/thermostat/battery"){
    console.log("home/app/thermostat/battery")
    currentBattery == stringMessage
  }else if(stringTopic == "home/app/thermostat/power"){
    console.log("home/app/thermostat/power")
    if(stringMessage == "Thermostat turned off"){
      console.log("Thermostat turned off")
      powerStatus == stringMessage;
    }else{
      console.log("Thermostat turned on")
      powerStatus == stringMessage
    }
  }
});

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
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Home Page' }}
        />
        <Stack.Screen name="Lights" component={lightControl} />
        <Stack.Screen name="Thermostat" component={thermostatControl} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}


function HomeScreen({ navigation }){

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
    { txt: <Text>Thermostat: {thermostatMode} {currentTemp}°F</Text> },
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

function lightControl({ navigation }){
  return (
    <View>
    
    </View>
  )
}

function thermostatControl({ navigation }){
  let temperatureInput = ""
  
  function thermostatControl(thermostatType){
    if(tempatureInput !== ""){
      console.log("Temperature: " + tempatureInput + "type: " + thermostatType)
      //client.publish("home/zwave/thermostat/set",  thermostatType + ": " + tempatureInput)
    }
  }

  const Options = ({ thermostatType }) =>(
    <TouchableOpacity onPress={() => checkingType(thermostatType)}>
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
    <FlatList data={options} renderItem={Item} numColumns={2} />
      <input type="number" id="tempatureSetpoint" value={temperatureInput} name="quantity" min="68" max="75" require/> 
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
});



