int light_sensor = A3;
int temp_sensor = A2;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw_light = analogRead(light_sensor);
  int light = map(raw_light, 0, 1023, 0, 100);
  int raw_temp = analogRead(temp_sensor);  
  float voltage = raw_temp * (5.0 / 1023.0);
  float fahrenheit = ((voltage * 10) * 9.0 / 5.0) + 32.0;

  Serial.print("Temperature: ");
  Serial.print(fahrenheit);
  Serial.println("°F)");
  Serial.print("Light leve: ");
  Serial.println(light);
  delay(60000);
}
