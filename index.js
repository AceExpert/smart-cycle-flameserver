const dgram = require('node:dgram');

let udpServer = dgram.createSocket('udp4');

udpServer.on('listening', () => {
    console.log("VoIP Server Active");
});

udpServer.on('message', (data, rinfo) => {

});

udpServer.bind(3009);