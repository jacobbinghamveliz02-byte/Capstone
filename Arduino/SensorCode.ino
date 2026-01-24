int light_sensor = A3;
int temp_sensor = A2;
int previousLightLevel = -1;
float previousTemp = -999;

void setup() {
  Serial.begin(9600);
}

void loop() {
  // light stuff
  int raw_light = analogRead(light_sensor);
  int light = map(raw_light, 0, 1023, 0, 100);

  // temp stuff
  int raw_temp = analogRead(temp_sensor);  
  float voltage = raw_temp * (5.0 / 1023.0);
  float fahrenheit = ((voltage * 10) * 9.0 / 5.0) + 32.0;

  // Check if temperature changed
  if(fahrenheit != previousTemp) {
    Serial.print("Temperature: ");
    Serial.print(fahrenheit);
    Serial.println("°F  ");
  }
  
  // Check if light level changed
  if(previousLightLevel != light) {
    Serial.print("Light level: ");
    Serial.println(light);
  }
  // Update previous values
  previousTemp = fahrenheit;
  previousLightLevel = light;

  delay(1000);
}
