const LedMatrix = require("easybotics-rpi-rgb-led-matrix");
const Canvas = require('canvas')
const fs = require('fs')
const path = require('path')
const request = require('request');
const moonPhase = require('./moonphase');

function fontFile (name) {
    return path.join(__dirname, '/fonts/', name)
}

Canvas.registerFont(fontFile('Lato-Regular.ttf'), { family: 'lato' })
Canvas.registerFont(fontFile('RobotoMono-Light.ttf'), { family: 'Roboto'})
Canvas.registerFont(fontFile('Montserrat-SemiBoldItalic.ttf'), { family: 'Montserrat'})

function padNumber(number) {
    return number.toString().padStart(2, '0');
}

function formatHours(hour) {
    return (hour > 12) ? hour -12 : hour;
}

function addDays(date, days) {
    var result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

class Main {
    constructor() {
        this.tideDataUrl = () => { 
            const now = new Date();
            const tomorrow = addDays(now, 1);
            const start = now.getFullYear() + '' + (now.getMonth() + 1) + '' + padNumber(now.getDate());
            const end = tomorrow.getFullYear() + '' + padNumber(tomorrow.getMonth() + 1) + '' + padNumber(tomorrow.getDate()+1);
            return `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=NOS.COOPS.TAC.WL&begin_date=${start}&end_date=${end}&datum=MLLW&station=${this.stationId}&time_zone=lst_ldt&units=english&interval=hilo&format=json`;
        };
        this.airTempDataUrl = () => {
            const now = new Date();
            const tomorrow = addDays(now, 1);
            const start = now.getFullYear() + '' + (now.getMonth() + 1) + '' + padNumber(now.getDate());
            const end = tomorrow.getFullYear() + '' + padNumber(tomorrow.getMonth() + 1) + '' + padNumber(tomorrow.getDate()+1);
            return `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=air_temperature&application=NOS.COOPS.TAC.MET&begin_date=${start}&end_date=${end}&station=${this.stationId}&time_zone=lst_ldt&units=english&interval=h&format=json`;
        }
        this.waterTempDataUrl = () => {
            const now = new Date();
            const tomorrow = addDays(now, 1);
            const start = now.getFullYear() + '' + (now.getMonth() + 1) + '' + padNumber(now.getDate());
            const end = tomorrow.getFullYear() + '' + padNumber(tomorrow.getMonth() + 1) + '' + padNumber(tomorrow.getDate()+1);
            return `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_temperature&application=NOS.COOPS.TAC.PHYSOCEAN&begin_date=${start}&end_date=${end}&station=${this.stationId}&time_zone=lst_ldt&units=english&interval=h&format=json`;
        }
        this.windDataUrl = () => {
            const now = new Date();
            const tomorrow = addDays(now, 1);
            const start = now.getFullYear() + '' + (now.getMonth() + 1) + '' + padNumber(now.getDate());
            const end = tomorrow.getFullYear() + '' + padNumber(tomorrow.getMonth() + 1) + '' + padNumber(tomorrow.getDate()+1);
            return `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=wind&application=NOS.COOPS.TAC.MET&begin_date=${start}&end_date=${end}&station=${this.stationId}&time_zone=lst_ldt&units=english&interval=h&format=json`;
        }
        this.mainLoopTimeout = null;
        this.matrix = null;
        this.frameWidth = 128;
        this.config = {
            "width": 64,
            "height": 64,
            "panelType": "rpi-rgb-led-matrix",
            "chained": 1,
            "parallel": 2,
            "brightness": 5,
            "hardwareMapping": "adafruit-hat-pwm",
            "rgbSequence": "RGB",
            "cmdLineArgs": ["--led-multiplexing=0","--led-row-addr-type=4"]
        }
        this.ledPixels = [];
        this.canvas = null;
        this.canvasContext = null;
        this.lingrad = null;
        this.moonImage = null;
        this.backgroundImage = null;
        this.tideData = [];
        this.airTempData = [];
        this.waterTempData = [];
        this.windData = [];
        this.currentTick = 0;
        this.stationName = "Loading";

        this.stationIdList = [9410230, 9410170, 9410840, 9411340, 9410230, 9413450, 9414290, 1612340, 9410230, 1612480, 9497645, 9455920]
        this.stationIdIndex = 0;
        this.stationId = 0;

        this.showDebug = false;
        this.sleepHourStart = 7;
        this.sleepHourEnd = 20;
        


        this.console = {
            info(msg) {
                if(this.showDebug) {
                    console.info(msg);
                }
            },
            error(msg) {
                if(this.showDebug) {
                    console.error(msg);
                }
            }
        }
    
        
    }

    start() {
        this.canvas = Canvas.createCanvas(this.config.width*2, this.config.height);
        this.canvasContext = this.canvas.getContext('2d');
        this.matrix = new LedMatrix(this.config.width, this.config.height, this.config.chained, this.config.parallel, this.config.brightness, this.config.hardwareMapping, this.config.rgbSequence, this.config.cmdLineArgs);

        this.lingrad = this.canvasContext.createLinearGradient(0, 0, 0, 64)
        this.lingrad.addColorStop(0, '#00ABEB')
        this.lingrad.addColorStop(0.5, '#fff')
        this.lingrad.addColorStop(0.5, '#ffff00')
        this.lingrad.addColorStop(1, '#fff')        

        this.canvasContext.textDrawingMode = 'glyph';
        this.canvasContext.quality = 'best';
        this.canvasContext.patternQuality = 'best';

        this.loadData();

        Canvas.loadImage(`led-background-no-title.jpg`).then((image) => {
            this.backgroundImage = image;
            this.render();
            this.mainLoopTimeout = setInterval(this.loadData.bind(this), 1000 * 60 * 0.5);
    
        });
        
    }
    


    loadData() {
        this.stationId = this.stationIdList[this.stationIdIndex];
        this.stationIdIndex++;
        if(this.stationIdIndex >= this.stationIdList.length) {
            this.stationIdIndex = 0;
        }

        this.tideData = [];
        this.airTempData = null;
        this.waterTempData = null;
        this.windData = null;
        this.stationName = "Loading...";

        const currDate = new Date();
        const tempMoonImg = moonPhase.moonPhase()(currDate.getFullYear(), currDate.getMonth()+1, currDate.getDate()).image;
        Canvas.loadImage(tempMoonImg).then((image) => {
            this.moonImage = image;
            this.render();
        })

        request(this.tideDataUrl(), { json: true }, (err, res, body) => {
            this.console.info('tide url', this.tideDataUrl());
            if (err) { return this.console.error(err); }
            this.console.info('tide', body);
            if(body.predictions) {
                this.tideData = body.predictions;
                this.render();
            } else {
                this.console.info('tide data error', body, this.tideDataUrl());
            }
        });  

        request(this.airTempDataUrl(), { json: true }, (err, res, body) => {
            if (err) { return this.console.error(err); }
            this.console.info('air', body)
            if(body.data) {
                this.airTempData = body.data;
                const metaData = body.metadata;
                if(metaData && metaData.name) {
                    this.stationName = metaData.name;
                }                
                this.render();
            } else {
                this.console.info('air data error', body, this.airTempDataUrl());
            }
        });  

        request(this.waterTempDataUrl(), { json: true }, (err, res, body) => {
            if (err) { return this.console.error(err); }
            this.console.info('water', body)
            if(body.data) {
                this.waterTempData = body.data;
                const metaData = body.metadata;
                if(metaData && metaData.name) {
                    this.stationName = metaData.name;
                }

                this.render();
            } else {
                this.console.info('water data error', body, this.waterTempDataUrl());
            }
        });  

        request(this.windDataUrl(), { json: true }, (err, res, body) => {
            if (err) { return this.console.error(err); }
            this.console.info('wind', body)
            if(body.data) {
                this.windData = body.data;
                this.render();
            } else {
                this.console.info('wind data error', body, this.windDataUrl());
            }
        });  
        
    }

    render() {

        const now = new Date();

        if(now.getHours() >= this.sleepHourStart && now.getHours() < this.sleepHourEnd) {
            this.matrix.brightness(100);
        } else {
            this.matrix.brightness(5);
        }

        //clear canvas
        this.canvasContext.fillStyle = "#000";
        this.canvasContext.rect(0, 0, 128, 64);
        this.canvasContext.fill('nonzero');

        // draw background
        if(this.backgroundImage) {
            this.canvasContext.drawImage(this.backgroundImage, 0, 0, 128, 64);
        }

        // draw moon
        if(this.moonImage) {
            this.canvasContext.drawImage(this.moonImage, 90, 12, 38, 38);
        }

        //title
        this.canvasContext.fillStyle = "rgba(0,0,0,0.3)";
        this.canvasContext.font = 'normal 12px Montserrat';
        this.canvasContext.fillText(`${this.stationName.split(',')[0]} ${(this.showDebug) ? this.stationId : ''}`, 5, 12);

        this.canvasContext.fillStyle = "rgba(255,255,255,0.7";
        this.canvasContext.font = 'normal 12px Montserrat';
        this.canvasContext.fillText(`${this.stationName.split(',')[0]} ${(this.showDebug) ? this.stationId : ''}`, 6, 10);

        // draw high/low tides text
        // this.canvasContext.fillStyle = this.lingrad;
        this.canvasContext.font = 'normal 10px Roboto';
        let totalRows = 0;
        if(this.tideData) {
            for(let i=0; i<this.tideData.length; i=i+1) {
                if(totalRows < 4) {
                    const currData = this.tideData[i];
                    const rowDate = new Date(currData.t);
                    if((rowDate.getTime() + (1000*60*60*4)) > now.getTime()) {
                        if(rowDate.getHours() <= 12) {
                            this.canvasContext.fillStyle = "rgb(220,220,255)";
                        } else {
                            this.canvasContext.fillStyle = "rgb(255,255,0)";
                        }
                        this.canvasContext.font = 'normal 8px Roboto';
                        this.canvasContext.fillText(`${currData.type}`, 2, ((totalRows+1)*10+9));
                        this.canvasContext.font = 'normal 10px Roboto';
                        const ampm = (rowDate.getHours() <= 12) ? 'a' : 'p';
                        this.canvasContext.fillText(`${padNumber(formatHours(rowDate.getHours()))}:${padNumber(rowDate.getMinutes())}${ampm}`, 9, ((totalRows+1)*10+10));
                        const finalLeft = (currData.v < 0 || currData.v > 9) ? 48 : 54;
                        this.canvasContext.fillText(`${parseFloat(currData.v).toFixed(2)}ft`, finalLeft, ((totalRows+1)*10+10));
                        totalRows++;
                    }
                    
                }
            }
        } else {
            this.canvasContext.fillText(`No tide data`, 2, ((2+1)*10+9));
        }
        this.canvasContext.fillStyle = "#ACC196";
        this.canvasContext.font = 'normal 8px lato';
        // date & time
        // const dateString = `${padNumber(now.getMonth()+1)}/${padNumber(now.getDate())}`;
        // const timeString = `${padNumber(formatHours(now.getHours()))}:${padNumber(now.getMinutes())}:${padNumber(now.getSeconds())}`;
        // this.canvasContext.fillText(`${dateString} ${timeString}`, 1, 62);

        // water temp
        let waterTempString = '';
        if(this.waterTempData && this.waterTempData.length > 0) {
            waterTempString = Math.round(this.waterTempData[this.waterTempData.length-1].v) + '°';//   
            this.canvasContext.fillText(`${waterTempString}`, 9, 62);
        }

        // wind
        let windString = '';
        if(this.windData && this.windData.length > 0) {
            const currWindData = this.windData[this.windData.length-1];
            windString = `${currWindData.dr} ${Math.round(currWindData.s*1.15078)}mph`;
            this.canvasContext.fillText(`${windString}`, 45, 62);
        } else {
            // date & time
            this.canvasContext.font = 'normal 7px lato';
            const dateString = `${padNumber(now.getMonth()+1)}/${padNumber(now.getDate())}`;
            const timeString = `${padNumber(formatHours(now.getHours()))}:${padNumber(now.getMinutes())}`;
            this.canvasContext.fillText(`${dateString} ${timeString}`, 45, 62);    
        }

        // air temp
        this.canvasContext.font = 'normal 13px lato';
        if(this.airTempData && this.airTempData.length > 0) {
            const temp = this.airTempData[this.airTempData.length-1].v; //   * 9/5 + 32
            this.canvasContext.fillText(`${temp}°`, 95, 62);
        } 

        // draw canvas to matrix
        const imageData = this.canvasContext.getImageData(0, 0, 128, 64).data;
        this.ledPixels = new Array();
        for(let i=0; i<imageData.length; i=i+4) {
            this.ledPixels.push([imageData[i], imageData[i+1], imageData[i+2]])
        }

        // update led
        this.drawCurrentPixelIndexes();
        this.matrix.update();

        // for future debugging
        if(this.currentTick === 100) {
            this.currentTick = 0
        } else {
            this.currentTick++;
        }

    }

    drawCurrentPixelIndexes() {
        let currX = 0;
        let currY = 0;

        // make sure we have pixel data to work with
        if(this.ledPixels) {

            // for each pixel in ledPixelIndexes
            for(let i=0; i<this.ledPixels.length; i++) {
                this.tempPixel = this.ledPixels[i];
                
                // make sure we have a pixel color and hardware to talk to
                if(this.tempPixel && this.matrix) {
                    this.matrix.setPixel(currX, currY, this.tempPixel[0], this.tempPixel[1], this.tempPixel[2]);
                    
                }
    
                // do some math to keep track of the X & Y position of the current pixel inside the final image.
                if(i%this.frameWidth===(this.frameWidth-1)) {
                    currY++;
                    currX = 0;
                } else {
                    currX++;
                }
                
            }
        }
        
    }    

}

const app = new Main();
app.start();




