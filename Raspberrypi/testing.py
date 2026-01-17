from datetime import datetime
from time import sleep

now = datetime.now()
current_time = now.strftime("%H:%M:%S")
while True:
    sleep(60)
    now = datetime.now()
    current_time = now.strftime("%H:%M:%S")
    print("Current Time =", current_time)