/**
 * @copyright Copyright (c) 2018 Lauro Moraes - [https://github.com/subversivo58]
 * @license The MIT License (MIT)             - [https://github.com/authchainjs/signaling/blob/master/LICENSE]
 * @version 0.1.0 [development stage]         - [https://github.com/authchainjs/signaling/blob/master/VERSIONING.md]
 */

//require('dotenv').config() // not required in glitch.com
const path = require('path')

//global.appRoot = path.resolve(__dirname)

const http = require('http')
const fs = require('fs')
const PORT = process.env.PORT || 3000
const WebSocketServer = require('uws').Server

const {
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder
} = require('util')

// access libraries
const {
    ConnectionGuard: ConnGuard,
    TokenAccess: SocketTokenAccess,
    SHA256: SHA256,
    Utils: UTILS,
    RTC: WebRTC,
    WebCrypto: CryptoHandler,
    Credential: Credential,
    Blockchain: ChainHandler
} = require('./lib')

const ConnectionGuard = new ConnGuard(process.env.ALLOW_ORIGIN)
const TokenAccessHandler = new SocketTokenAccess('secret')
const CredentialManager = new Credential()

// credential for WebRTC is first
CredentialManager.on('done', (credential, fingerprint, keys) => {
    SignalingInitialize(credential, fingerprint)
})


/**
 * SERVER LOGIC
 * Instance server for static files and base to WebSockets (uws)
 * @TODO: add TLS opions (with "https" module)
 */
const server = http.createServer((req, res) => {
    // @TODO: handler basic GET method requests for specific resources of AuthChainJS?
})

server.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`)
})

/**
 * SIGNALING LOGIC
 * Instance server for WebSockets (uws)
 */
const SignalingInitialize = (credential, fingerprint) => {

    // WebRTC configuration
    const WebRTCSetup = {
        iceServers: [
            {
                'urls': 'stun:stun.l.google.com:19302'
            },
            {
                'urls': 'stun:stun.services.mozilla.com'
            }
        ],
        constraints: {
            optional: [],
            mandatory: {
                OfferToReceiveAudio: false,
                OfferToReceiveVideo: false,
                iceRestart: true
            }
        }
    }

    const Signaling = {
        // list of backbones signaling servers on collaborate to this P2P network
        backnodes: [
            'ws://localhost/signaling' // localhost example
        ],
        // store channels
        channels: {},
        // store pools
        pools: {},
        // store "generic" websockets ids
        socketids: [],
        // store WRTC Peers
        wrtcpeers: {},
        // store WRTC DataChannels
        wrtcchannels: {},
        // map rooms
        rooms: {}
    }

    // create WebSocket Server (with "uws" module)
    const wss = new WebSocketServer({
        server: server,
        path: '/signaling',
        // verify
        verifyClient(info, cb) {
            ConnectionGuard.verify(info, ConnectionGuard, TokenAccessHandler, cb)
        }
    })

    // Pool list(s) creation (max 256 entires by pool)
    const PoolBuilder = {
        init(targetpool, ws) {
            let pools = Object.keys(Signaling.pools),
                pl = pools.length
            if ( pl === 0 ) {
                //console.log('Generate Pool (first Pool)')
                let poolid = UTILS.uuid()
                Signaling.pools[poolid] = [ws.id]
                ws.pool = poolid
                return poolid
            } else if ( pl >= 1 ) {
                if ( targetpool && pools.includes(targetpool) ) {
                    if ( Signaling.pools[targetpool].length < 256 ) {
                        //console.log('Current Pool have space')
                        Signaling.pools[targetpool].push(ws.id)
                        ws.pool = targetpool
                        return targetpool
                    }
                }
                for (let i = 0; i < pl; i++) {
                     if ( pools[i].length < 256 ) {
                         //console.log('Return first Pool minor 256 peers')
                         Signaling.pools[pools[i]].push(ws.id)
                         ws.pool = pools[i]
                         return pools[i]
                     } else if ( pools[i].length === 256 ) {
                         //console.log('Generate new Pool')
                         let poolid = UTILS.uuid()
                         Signaling.pools[poolid] = [ws.id]
                         ws.pool = poolid
                         return poolid
                     }
                }
            }
        },
        delete(pool, id) {
            if ( Signaling.pools[pool] && Signaling.pools[pool].includes(id) ) {
                let index = Signaling.pools[pool].indexOf(id)
                Signaling.pools[pool] = Signaling.pools[pool].splice(index, 1)
            }
        }
    }


    const onMessage = (message, websocket) => {
        try {
            if ( websocket.isAuth ) {
                if ( 'target' in message.data && (('candidate' in message.data) || ('answerSdp' in message.data) || ('sdpOffer' in message.data)) ) {
                    // check if user already taken in RoomsList
                    if ( Signaling.rooms[message.data.target] ) {
                        // iterate
                        wss.clients.forEach(ws => {
                            if ( ws.broadcaster === message.data.target && ws.isAlive ) {
                                delete message.data.target
                                ws.send(JSON.stringify(message.data))
                            }
                        })
                    }
                      // receive response to server WebRTC
                      else if ( message.data.target === websocket.id ) {
                        if ( 'answerSdp' in message.data ) {
                            //
                        } else if ( 'candidate' in message.data ) {
                            //
                        } else {
                            // @REVISE: .log here?
                            console.log('?', message.data)
                        }
                    }
                } else if ( 'createOffer' in message.data ) {
                    if ( !Signaling.rooms[message.data.broadcaster] ) {
                        websocket.broadcaster = message.data.broadcaster
                        Signaling.rooms[message.data.broadcaster] = {
                            socketid:    websocket.id,
                            roomToken:   message.data.roomToken,
                            broadcaster: message.data.broadcaster,
                            credential:  message.data.credential
                        }
                    } else {
                        return
                    }

                    let rooms = Object.keys(Signaling.rooms),
                        len   = rooms.length
                    if ( len > 1 ) {
                        wss.clients.forEach((ws, i) => {
                            if ( ws.id !== websocket.id ) {
                                // send current offer to another sockets
                                ws.send(JSON.stringify({
                                    roomToken:   Signaling.rooms[websocket.broadcaster].roomToken,
                                    broadcaster: Signaling.rooms[websocket.broadcaster].broadcaster,
                                    credential:  Signaling.rooms[websocket.broadcaster].credential,
                                    createOffer: true
                                }))
                            } else {
                                // send another offers to current socket
                                rooms.forEach(room => {
                                    if ( Signaling.rooms[room].broadcaster !== websocket.broadcaster ) {
                                        ws.send(JSON.stringify({
                                            roomToken:   Signaling.rooms[room].roomToken,
                                            broadcaster: Signaling.rooms[room].broadcaster,
                                            credential:  Signaling.rooms[room].credential,
                                            createOffer: true
                                        }))
                                    }
                                })
                            }
                        })
                    } else {
                        // create WebRTC "offer"
                    }
                } else {
                    // not allowed
                    throw('Authenticated socket send invalid message')
                }
            } else {
                // first "rate-limit" increment
                websocket.rate++
                if ( websocket.rate >= 3 ) {
                    // block this IP by default 15 minutes
                    ConnectionGuard.blockIP(websocket.ip)
                    throw('Unauthenticated socket exceded "rate-limit"')
                } else {
                    if ( message.setupconn ) {
                        websocket.send(JSON.stringify({
                            list: Signaling.backbones,
                            pool: PoolBuilder.init(message.targetpool, websocket),
                            chain: [],
                            auth: TokenAccessHandler.generate(UTILS.uuid(true)) // @REVISE - is util?
                        }))
                    } else if ( message.open && message.auth ) {
                        // verify token (token expires every 500 ms)
                        if ( TokenAccessHandler.allow(message.auth) ) {
                            websocket.isAuth = true // auth this
                            websocket.rate = 1      // restore "rate-limit"
                        } else {
                            throw('Authentication token failed')
                        }
                    } else {
                        throw('Invalid message from "unauthenticated" socket')
                    }
                }
            }
        } catch(e) {
            // @REVISE: captures to .log file this exception?
            websocket.terminate()
        }
    }
    //
    wss.on('connection', (ws, req) => {
        /**
         * Define websocket IP
         */
        if ( req.headers['x-forwarded-for'] || req.headers['x-real-ip'] ) {
            ws.ip = (req.headers['x-real-ip']) ? req.headers['x-real-ip'] : req.headers['x-forwarded-for']
        }
        // map for prevent denial atack
        ws.rate = 1
        // define generic socket.id
        ws.id = UTILS.uuid(true)
        // add to list id's
        Signaling.socketids.push(ws.id)
        // "flag" for check "heartbeat" connection
        ws.isAlive = true
        // Is the heart still pulsating? yes, still beating
        ws.on('pong', () => ws.isAlive = true)
        // message handler
        ws.on('message', message => {
            try {
                onMessage(JSON.parse(message), ws)
            } catch(e) {
                // @TODO: .log here? - not valid `JSON` ... close connection
                ws.terminate()
            }
        })
        //
        ws.on('close', function(CloseEventCode) {
            // remove socket id from list
            if ( Signaling.socketids.includes(ws.id) ) {
                let index = Signaling.socketids.indexOf(ws.id)
                Signaling.socketids.splice(index, 1)
                // remove socket from POOL
                PoolBuilder.delete(ws.pool, ws.id)
                let rooms = Object.keys(Signaling.rooms)

                rooms.filter(k => {
                    if ( Signaling.rooms[k].socketid === ws.id ) {
                        delete Signaling.rooms[k]
                        wss.clients.forEach((ws) => {
                            ws.send(JSON.stringify({
                                userLeft: k
                            }))
                        })
                    }
                })
            }
        })
    })

    // heartbeat
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if ( ws.isAlive === false ) {
                return ws.terminate()
            }
            ws.isAlive = false
            ws.ping('', false, true)
        })
    }, 30000)
}