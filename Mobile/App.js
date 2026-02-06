import { Text, FlatList, View, TouchableOpacity, Button, StyleSheet } from 'react-native'
import mqtt from 'mqtt';

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
  stringMessage = message.toString()
    if(stringMessage.includes("Light")){
    // 
    }
    else if(stringMessage.includes("Thermostat")){
      let thermostatArray = stringMessage.split(": ");
      if(thermostatArray[1] == "heating"){
          //  
      }else{
        //  
      }
    }
});

// Note to self constantly check messages but only publish message when a state changes
  // Menu: Create a menu to access Lights and Thermostat
    // Note to self menu links will be easier to access for user stand point
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
    <View style={styles.container}>
      <Text >
        testing.
      </Text>
      <Button title="Click me" onPress={() => alert("button pressed")}/>
      <Button title="Click me1" onPress={() => alert("button pressed")}/>
    </View>
  );
}


const styles = {
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 8,
  }
};



