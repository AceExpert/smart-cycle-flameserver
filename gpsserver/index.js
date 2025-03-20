const net = require("net");

let tokenMap = {
    'hMrXDM0x6G': {addr: 'FF:FF:FF:FF:FF:FF', to_alert: false, to_gps: false}
}

function sendData(token, data) {
    if(tokenMap[token].phone) {
        if(!tokenMap[token].phone.closed) {
            tokenMap[token].phone.write(data)
            return true;
        }
    }
    return false;
}

let server = net.createServer(socket => {
    console.log("Connected", `${socket.remoteAddress}:${socket.remotePort}`)
    let authToken = null;
    let devType = null;
    let hbInterv = null;
    let authTimer = null;
    let hbTimer = null;
    let endConnection = () => {
        socket.end();
        socket.destroy();
    };
    authTimer = setTimeout(endConnection, 20000);
    socket.on("data", d => {
        let data = [...d].map(code => String.fromCharCode(code)).join("");
        let args = data.split(' ');
        if(!authToken && args[0] !== '$auth') endConnection();
        switch (args[0]) {
            case '$auth': {
                for(let token of Object.keys(tokenMap)) {
                    if((token === args[3] && tokenMap[token].addr === args[2] && args[1] === 'cycle') || (token === args[2] && tokenMap[token].addr === args[3] && args[1] === 'phone')) {
                        clearTimeout(authTimer);
                        console.log("Authorized");
                        authToken = token;
                        devType = args[1]
                        tokenMap[token][args[1]] = socket;
                        hbInterv = setInterval(() => {
                            if(!socket.closed && tokenMap[token][args[1]]) {
                                socket.write(".hb\n")
                            };
                        }, 45000)
                        hbTimer = setTimeout(endConnection, 60000);
                        if(args[1] === 'phone') {
                            if(tokenMap[token].to_gps) {
                                tokenMap[token].to_gps = false;
                                sendData(token, tokenMap[token].location);
                            }
                            if(tokenMap[token].to_alert) {
                                tokenMap[token].to_alert = false;
                                sendData(token, '$alert\n');
                            }
                        }
                    } else {
                    }
                    break;
                }
                break;
            }

            case '.hb': {
                clearTimeout(hbTimer);
                hbTimer = setTimeout(endConnection, 60000);
                break;
            }

            case '$gps': {
                clearTimeout(hbTimer);
                hbTimer = setTimeout(endConnection, 60000);

                for(let token of Object.keys(tokenMap)) {
                    if(token === args[1]) {
                        tokenMap[token].location = args.slice(2).join(' ')
                        if(!sendData(token, tokenMap[token].location)) {
                            tokenMap[token].to_gps = true;
                        };
                    }
                    break
                }
                break;
            }
            case '$alert': {
                clearTimeout(hbTimer);
                hbTimer = setTimeout(endConnection, 60000);
                
                for(let token of Object.keys(tokenMap)) {
                    if(token === args[1]) {
                        if(!sendData(token, "$alert\n")) {
                            tokenMap[token].to_alert = true;
                        };
                    }
                    break
                }
                break;
            }
        }
    })
    let clearRecord = () => {
        console.log("End of", `${socket.remoteAddress}:${socket.remotePort}`);
        if(hbInterv) {
            clearInterval(hbInterv);
        };
        if(authToken)
            tokenMap[authToken][devType] = undefined;
    };
    socket.on("end", clearRecord);
    socket.on("close", clearRecord);
});

server.listen(3100, "0.0.0.0", () => {
    console.log("GPS Server up");
});