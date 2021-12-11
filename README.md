# Real Time Tides and Weather Display

Simple script which uses data source from [NOAA](https://tidesandcurrents.noaa.gov/) to display current tide, air temp, ocean temp, wind speed and wind direction for a given weather station on a 128x64 pixel RGB LED display. Uses Node running on a Raspiberry Pi and Adafruit RGB Matrix HAT.

## Hardware: 
* Raspberry Pi 3, 4 or Zero W or Zero 2.
* [Adafruit RGB Matrix HAT](https://www.adafruit.com/product/2345)
* 2x 64x64 LED displays
* [5v A/C Adapter](https://www.adafruit.com/product/1466) 

## Software and Libraries 
1. Node.js
1. [Canvas.js](https://www.npmjs.com/package/canvas)
1. [Easybotics RPI RGB LED Matrix](https://github.com/hzeller/rpi-rgb-led-matrix)

## Setup
1. Install Libraries for Canvas.js 
    * `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`
2. Clone Repo:
    * `git clone https://github.com/sclarke27/led-weather-screen.git`
3. cd to app folder
    * `cd led-weather-screen`
4. Install node libraries
    * `npm install`
5. Setup service
    * `sudo systemctl enable led-weather-screen.service`
6. Setup service
    * `sudo systemctl start led-weather-screen.service`

To use another station than La Jolla, update the station ID in main.js. You can lookup station IDs from the [NOAA API Website](https://tidesandcurrents.noaa.gov/). Not all stations have all the data sources needed to drive what is shown on the display. You will also need to edit the background image since the title is baked into the image.