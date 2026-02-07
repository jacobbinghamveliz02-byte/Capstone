import serial # type: ignore 
import time

serialPort = serial.Serial("/dev/ttyACM1", 9600) #Open the serial port
serialPort.reset_input_buffer() #Clears inputs before starting

while True:
    data = serialPort.readline().decode('utf-8').rstrip() #read the data
    print(data) #print the data to the console