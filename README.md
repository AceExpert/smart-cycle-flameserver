# Flame Server
### VoIP Server

This is the repository for the code base of Flame Server, this server facilitates the constant Voice connected groups for owners of the Smart Cycle

## Servers
### WebSocket

This is used for signaling mechanism, message exchange and joining / unjoining VoIP groups or the voice server.

### UDP Server

This does the relaying of audio to correct destination from authorized users.

## Setup

```bash
git clone https://github.com/AceExpert/smart-cycle-flameserver.git
cd flameserver
npm install
node index.js
```