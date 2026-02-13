import { Text, SafeAreaView, StyleSheet, FlatList, TouchableOpacity, View, Button, TextInput, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState, useEffect } from 'react';
import { Switch, Card, Title, Paragraph, Chip, ActivityIndicator } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import mqtt from 'mqtt';

const Stack = createNativeStackNavigator();

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
        mqttClient.subscribe('home/app/#');
      });

      mqttClient.on('error', function (error) {
        console.log('MQTT Error:', error);
        setConnectionStatus("error");
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
        else if (topic === 'home/app/light/current/level') {
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
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#2196F3',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Home" 
          options={({ navigation }) => ({
            title: 'Smart Home Control',
            headerRight: () => (
              <View style={styles.connectionStatus}>
                <View style={[
                  styles.statusDot,
                  { 
                    backgroundColor: connectionStatus === 'connected' ? '#4CAF50' : 
                                   connectionStatus === 'reconnecting' ? '#FFC107' : '#F44336' 
                  }
                ]} />
                <Text style={styles.statusText}>
                  {connectionStatus === 'connected' ? 'Connected' : 
                   connectionStatus === 'reconnecting' ? 'Reconnecting' : 
                   connectionStatus === 'error' ? 'Error' : 'Disconnected'}
                </Text>
              </View>
            ),
          })}
        >
          {props => <HomeScreen {...props} 
            client={client}
            thermostatMode={thermostatMode} 
            currentTemp={currentTemp} 
            currentBattery={currentBattery} 
            lightLevel={lightLevel} 
            thermostatPowerStatus={thermostatPowerStatus} 
          />}
        </Stack.Screen>
        <Stack.Screen 
          name="Lights" 
          component={LightControl}
          options={{
            title: 'Light Control',
            headerStyle: {
              backgroundColor: '#FFC107',
            },
          }}
        />
        <Stack.Screen 
          name="Thermostat"
          options={{
            title: 'Thermostat Control',
            headerStyle: {
              backgroundColor: '#4CAF50',
            },
          }}
        >
          {props => <ThermostatControl {...props} 
            client={client} 
            thermostatPowerStatus={thermostatPowerStatus} 
            setThermostatPowerStatus={setThermostatPowerStatus} 
          />}
        </Stack.Screen>
        <Stack.Screen 
          name="TimedControl" 
          component={TimedControl}
          options={{
            title: 'Timed Settings',
            headerStyle: {
              backgroundColor: '#9C27B0',
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function HomeScreen({ navigation, client, thermostatMode, currentTemp, currentBattery, lightLevel, thermostatPowerStatus }){

  const quickActions = [
    { 
      id: 'lights',
      title: 'Lights', 
      icon: 'lightbulb',
      color: '#FFC107',
      screen: 'Lights',
      status: lightLevel
    },
    { 
      id: 'thermostat',
      title: 'Thermostat', 
      icon: 'thermostat',
      color: '#4CAF50',
      screen: 'Thermostat',
      status: `${thermostatMode || 'Off'} · ${currentTemp || '--'}°F`
    },
  ];

  const getBatteryColor = (level) => {
    const numLevel = parseInt(level);
    if (numLevel > 70) return '#4CAF50';
    if (numLevel > 30) return '#FFC107';
    return '#F44336';
  };

  return (
    <ScrollView style={styles.homeContainer}>
      <View style={styles.welcomeSection}>
        <Icon name="home-automation" size={40} color="#2196F3" />
        <Text style={styles.welcomeText}>Welcome back!</Text>
        <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
      </View>

      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.quickActionCard, { backgroundColor: action.color + '20' }]}
              onPress={() => navigation.navigate(action.screen)}
            >
              <Icon name={action.icon} size={32} color={action.color} />
              <Text style={styles.quickActionTitle}>{action.title}</Text>
              <Text style={styles.quickActionStatus}>{action.status}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.currentStatusSection}>
        <Text style={styles.sectionTitle}>Current Status</Text>
        <Card style={styles.statusCard}>
          <Card.Content>
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <Icon name="thermometer" size={24} color="#4CAF50" />
                <View>
                  <Text style={styles.statusLabel}>Temperature</Text>
                  <Text style={styles.statusValue}>{currentTemp || '--'}°F</Text>
                </View>
              </View>
              <View style={styles.statusItem}>
                <Icon name="power" size={24} color={thermostatPowerStatus === 'on' ? '#4CAF50' : '#F44336'} />
                <View>
                  <Text style={styles.statusLabel}>Thermostat</Text>
                  <Text style={styles.statusValue}>{thermostatPowerStatus}</Text>
                </View>
              </View>
            </View>

            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <Icon name="lightbulb" size={24} color="#FFC107" />
                <View>
                  <Text style={styles.statusLabel}>Light</Text>
                  <Text style={styles.statusValue}>{lightLevel || 'Off'}</Text>
                </View>
              </View>
              <View style={styles.statusItem}>
                <Icon name="battery" size={24} color={getBatteryColor(currentBattery)} />
                <View>
                  <Text style={styles.statusLabel}>Battery</Text>
                  <Text style={styles.statusValue}>{currentBattery || '--'}%</Text>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>
      </View>

      <TouchableOpacity 
        style={styles.timedControlButton}
        onPress={() => navigation.navigate('TimedControl')}
      >
        <Icon name="clock-outline" size={24} color="#fff" />
        <Text style={styles.timedControlText}>Timed Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function LightControl({ navigation, client, lightLevel, setLightLevel }){

  const [isOn, setIsOn] = useState(lightLevel === "On");

  const toggleLight = () => {
    const newState = !isOn;
    setIsOn(newState);
    client.publish("home/zwave/light/set", newState ? "on" : "off");
  };

  return (
    <View style={styles.controlContainer}>
      <Card style={styles.controlCard}>
        <Card.Content style={styles.controlContent}>
          <Icon 
            name={isOn ? "lightbulb" : "lightbulb-off"} 
            size={80} 
            color={isOn ? "#FFC107" : "#9E9E9E"} 
          />
          <Text style={styles.controlTitle}>
            Lights are {isOn ? 'On' : 'Off'}
          </Text>
          
          <TouchableOpacity
            style={[styles.powerButton, isOn ? styles.powerButtonOn : styles.powerButtonOff]}
            onPress={toggleLight}
          >
            <Icon name={isOn ? "flash" : "flash-off"} size={24} color="#fff" />
            <Text style={styles.powerButtonText}>
              {isOn ? 'Turn Off' : 'Turn On'}
            </Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>
    </View>
  );
}

function ThermostatControl({ navigation, client, thermostatPowerStatus, setThermostatPowerStatus }){

  const [temperatureInput, setTemperatureInput] = useState("");
  const [isPoweredOn, setIsPoweredOn] = useState(thermostatPowerStatus === "on");
  
  useEffect(() => {
    if (client && client.connected) {
      client.publish("home/zwave/thermostat/power/get", "request");
    }
  }, [client]);

  function handleThermostatControl(thermostatType){
    const tempNum = Number(temperatureInput);
    if(tempNum !== "" && tempNum >= 68 && tempNum <= 75){
      client.publish("home/zwave/thermostat/set", thermostatType + ": " + temperatureInput);
      navigation.navigate('Home');
    }else if(tempNum === ""){
      alert("Please enter a temperature!");
    }else if(tempNum > 75 || tempNum < 68){
      alert("Temperature must be between 68°F and 75°F");
    }
  }

  function togglePower(){
    const newState = !isPoweredOn;
    setIsPoweredOn(newState);
    client.publish("home/zwave/thermostat/power/set", newState ? "on" : "off");
    navigation.navigate("Home");
  }

  const modes = [
    { type: "Heating", icon: "fire", color: "#F44336" },
    { type: "Cooling", icon: "snowflake", color: "#2196F3" }
  ];

  return (
    <ScrollView style={styles.controlContainer}>
      <Card style={styles.controlCard}>
        <Card.Content>
          <View style={styles.powerStatus}>
            <Icon name="power" size={30} color={isPoweredOn ? "#4CAF50" : "#F44336"} />
            <Text style={[styles.powerStatusText, isPoweredOn ? styles.powerOnText : styles.powerOffText]}>
              {isPoweredOn ? 'Powered On' : 'Powered Off'}
            </Text>
          </View>

          <View style={styles.temperatureInputContainer}>
            <Text style={styles.inputLabel}>Set Temperature</Text>
            <TextInput
              style={styles.temperatureInput}
              keyboardType="numeric"
              onChangeText={setTemperatureInput}
              value={temperatureInput}
              placeholder="68-75"
              placeholderTextColor="#999"
              editable={isPoweredOn}
            />
            <Text style={styles.temperatureUnit}>°F</Text>
          </View>

          <Text style={styles.modesLabel}>Select Mode</Text>
          <View style={styles.modesContainer}>
            {modes.map((mode) => (
              <TouchableOpacity
                key={mode.type}
                style={[
                  styles.modeButton,
                  { backgroundColor: mode.color + '20', borderColor: mode.color },
                  !isPoweredOn && styles.disabledButton
                ]}
                onPress={() => handleThermostatControl(mode.type)}
                disabled={!isPoweredOn}
              >
                <Icon name={mode.icon} size={32} color={mode.color} />
                <Text style={[styles.modeButtonText, { color: mode.color }]}>
                  {mode.type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.powerButton, isPoweredOn ? styles.powerButtonOn : styles.powerButtonOff]}
            onPress={togglePower}
          >
            <Icon name={isPoweredOn ? "power-off" : "power"} size={24} color="#fff" />
            <Text style={styles.powerButtonText}>
              {isPoweredOn ? 'Turn Off' : 'Turn On'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.timedButton}
            onPress={() => navigation.navigate('TimedControl')}
          >
            <Icon name="clock-outline" size={20} color="#2196F3" />
            <Text style={styles.timedButtonText}>Timed Settings</Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

function TimedControl({ navigation }){
  const [startPeriod, setStartPeriod] = useState("AM");
  const [endPeriod, setEndPeriod] = useState("AM");
  const [startHour, setStartHour] = useState("12");
  const [startMinute, setStartMinute] = useState("00");
  const [endHour, setEndHour] = useState("12");
  const [endMinute, setEndMinute] = useState("00");
  
  const PeriodSelector = ({ period, setPeriod, label, hour, setHour, minute, setMinute }) => (
    <Card style={styles.periodCard}>
      <Card.Content>
        <Text style={styles.periodLabel}>{label}</Text>
        
        <View style={styles.timeInputContainer}>
          <View style={styles.timeInput}>
            <TextInput
              style={styles.timeNumberInput}
              value={hour}
              onChangeText={setHour}
              keyboardType="numeric"
              maxLength={2}
              placeholder="HH"
            />
            <Text style={styles.timeSeparator}>:</Text>
            <TextInput
              style={styles.timeNumberInput}
              value={minute}
              onChangeText={setMinute}
              keyboardType="numeric"
              maxLength={2}
              placeholder="MM"
            />
          </View>

          <View style={styles.periodToggle}>
            <Text style={[styles.periodText, period === 'AM' && styles.activePeriodText]}>AM</Text>
            <Switch 
              value={period === 'PM'} 
              onValueChange={(value) => setPeriod(value ? 'PM' : 'AM')} 
              trackColor={{ false: '#767577', true: '#2196F3' }}
            />
            <Text style={[styles.periodText, period === 'PM' && styles.activePeriodText]}>PM</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
  
  return (
    <ScrollView style={styles.controlContainer}>
      <Text style={styles.timedTitle}>Schedule Automation</Text>
      
      <PeriodSelector 
        period={startPeriod} 
        setPeriod={setStartPeriod}
        hour={startHour}
        setHour={setStartHour}
        minute={startMinute}
        setMinute={setStartMinute}
        label="Start Time"
      />
      
      <PeriodSelector 
        period={endPeriod} 
        setPeriod={setEndPeriod}
        hour={endHour}
        setHour={setEndHour}
        minute={endMinute}
        setMinute={setEndMinute}
        label="End Time"
      />

      <TouchableOpacity style={styles.saveButton}>
        <Icon name="check" size={24} color="#fff" />
        <Text style={styles.saveButtonText}>Save Schedule</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Connection Status
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
  },

  // Home Screen
  homeContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  welcomeSection: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  quickActionsSection: {
    marginTop: 10,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    justifyContent: 'space-between',
  },
  quickActionCard: {
    flex: 1,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  quickActionStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  currentStatusSection: {
    marginTop: 20,
  },
  statusCard: {
    marginHorizontal: 20,
    borderRadius: 15,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  timedControlButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    padding: 15,
    borderRadius: 25,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  timedControlText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // Control Screens
  controlContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  controlCard: {
    borderRadius: 20,
    elevation: 5,
  },
  controlContent: {
    alignItems: 'center',
    padding: 20,
  },
  controlTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 20,
  },
  powerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
    width: '100%',
  },
  powerButtonOn: {
    backgroundColor: '#F44336',
  },
  powerButtonOff: {
    backgroundColor: '#4CAF50',
  },
  powerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  powerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  powerStatusText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  powerOnText: {
    color: '#4CAF50',
  },
  powerOffText: {
    color: '#F44336',
  },
  temperatureInputContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  temperatureInput: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    padding: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
    minWidth: 100,
  },
  temperatureUnit: {
    fontSize: 18,
    color: '#666',
    marginTop: 5,
  },
  modesLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  modesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    marginHorizontal: 5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  timedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    padding: 10,
  },
  timedButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },

  // Timed Control
  timedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  periodCard: {
    marginBottom: 20,
    borderRadius: 15,
  },
  periodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeNumberInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    width: 60,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 5,
  },
  periodToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
  },
  periodText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
    marginHorizontal: 5,
  },
  activePeriodText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 25,
    marginTop: 20,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});