const dgram = require('node:dgram');
const { WebSocketServer } = require("ws");

const TOKEN = "eHheQM9vCGSqjIuhZYiz3DgoZp31HMXOOMFmmBoUw7gXoFlQfnN69MH";

let udpServer = dgram.createSocket('udp4');
let wsServer = new WebSocketServer({
    port: 3500,
    path: "/bolt"
});

let authUsers = {};
let notifQ = {};

let rooms = {
    '89g': ['89', '87']
};

let users = {
    '89': {
        'rooms': ['89g'],
        'active': '89g',
    },
    '87': {
        'rooms': ['89g'],
        'active': '89g',
    }
};

function getActiveRoom(uid) {
    return users[uid].active;
}

function getCurrentRoommates(sign, voip = null) {
    let uid = getUserID(sign);
    let roomId = getActiveRoom(uid);
    return getRoommates(roomId, voip, true);
}

function getUserID(sign) {
    for(let key of Object.keys(authUsers)) {
        if(key === sign) return authUsers[key].id;
    }
    return null;
}

function addNotifQueue(users, friend) {
    for(let uid of users) {
        if(Object.keys(notifQ).includes(uid)) {
            notifQ[uid].push(friend);
        } else {
            notifQ[uid] = [friend];
        }
    }
}

function removeNotifQueue(user) {
    for(let uid of Object.keys(notifQ)) {
        notifQ[uid] = notifQ[uid].filter(fr => fr !== user); 
    }
}

function progressNotifQueue(user, ws) {
    if(Object.keys(notifQ).includes(user)) {
        ws.send(JSON.stringify({'type': 1, 'friends': notifQ[user], 'cycling': 1}))
        delete notifQ[user];
    }
}

function getRoommates(roomID, voip = null, online = true) {
    let info = [];
    if(!online)
        return rooms[roomID].filter(uid => !(Object.keys(authUsers).filter(auser => authUsers[auser].auth).includes(uid)));
    for(let key of Object.keys(authUsers)) {
        if(authUsers[key].auth && rooms[roomID].includes(authUsers[key].id)) {
            if(voip === null)
                info.push([key, authUsers[key].id, authUsers[key].ws]);
            else if (authUsers[key].voip === voip) 
                info.push([key, authUsers[key].id, authUsers[key].ws]);
        }
    }
    return info;
}

udpServer.on('listening', () => {
    console.log("VoIP Server Active");
});

udpServer.on('message', (data, rinfo) => {
    Object.keys(authUsers).forEach(sign => {
        if(authUsers[sign].auth && sign === '::ffff:' + rinfo.address + "?" + rinfo.port) {
            for(let [key, ..._] of getCurrentRoommates(sign, true)) {
                if(key !== sign) {
                    let [addr, port] = key.split("?");
                    udpServer.send(data, Number.parseInt(port), addr.split(':').slice(-1)[0]);
                };
            }
        }
    })
});

wsServer.on("connection", (ws, req) => {
    const sign = req.socket.remoteAddress + "?" + req.socket.remotePort;
    let uid = null;
    console.log("Connected", sign);
    authUsers[sign] = {
        authTimer: setTimeout(
            () => {
                if(req.socket.readyState !== 'closed') {
                    ws.close();
                    delete authUsers[sign];
                }
            }, 20000),
        auth: false,
    };

    ws.on("message", (data, isBinary) => {
        let jData = JSON.parse([...data].map(code => String.fromCharCode(code)).join(""));
        if(!authUsers[sign].auth) {
            if(jData.type === 0 && jData.auth === TOKEN) {
                clearTimeout(authUsers[sign].authTimer);
                uid = jData.id;
                authUsers[sign].auth = true;
                authUsers[sign].id = jData.id;
                authUsers[sign].ws = ws;
                authUsers[sign].voip = false;
                progressNotifQueue(uid, ws);
            } 
        } else {
            switch (jData.type) 
            {
            case 2: {
                if(jData.action === 1) {
                    authUsers[sign].voip = true;
                    for(let [key, id, uws] of getCurrentRoommates(sign)) {
                        if(key !== sign) {
                            uws.send(JSON.stringify({'type': 2, 'status': 1, 'id': uid}));
                        };
                    }
                } else if (jData.action === 0) {
                    authUsers[sign].voip = false;
                    for(let [key, id, uws] of getCurrentRoommates(sign)) {
                        if(key !== sign) {
                            uws.send(JSON.stringify({'type': 2, 'status': 0, 'id': uid}));
                        };
                    }
                }
                break;
            };
            case 1: {
                if(jData.action === 1) {
                    for(let [key, id, uws] of getCurrentRoommates(sign)) {
                        if(key !== sign) {
                            uws.send(JSON.stringify({'type': 1, 'friends': [uid], 'cycling': 1}))
                        }
                    }
                    addNotifQueue(getRoommates(getActiveRoom(uid), null, false), uid);
                } else if (jData.action === 0) {
                    for(let [key, id, uws] of getCurrentRoommates(sign)) {
                        if(key !== sign) {
                            uws.send(JSON.stringify({'type': 1, 'friends': [uid], 'cycling': 0}))
                        }
                    }
                    removeNotifQueue(uid);
                }
                break;
            }
            default: {
                break;
            }
            };
        }
    })

    ws.on("close", () => {
        console.log('Disconnected', sign)
        if(uid) {
            for(let [key, id, uws] of getCurrentRoommates(sign)) {
                if(key !== sign) {
                    uws.send(JSON.stringify({'type': 0, 'status': 0, 'id': uid}));
                };
            }
        };
        delete authUsers[sign];
    })
})

wsServer.on("listening", () => {
    console.log("ws://:::3500/bolt is active");
})

udpServer.bind(3500);