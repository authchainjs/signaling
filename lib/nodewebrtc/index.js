/**
 * @copyright Copyright (c) 2018 Lauro Moraes - [https://github.com/subversivo58]
 * @license The MIT License (MIT)             - [https://github.com/authchainjs/signaling/blob/master/LICENSE]
 * @version 0.1.0 [development stage]         - [https://github.com/authchainjs/signaling/blob/master/VERSIONING.md]
 */

const EventEmitter = require('events')
const UTILS = require('../utils/')
const WebRTC = require('wrtc')

const TextSender = {
    send(config) {
        let initialText = config.text,
            packetSize = 13000,
            textToTransfer = '',
            isobject = false

        if ( typeof initialText !== 'string' ) {
            isobject = true
            initialText = JSON.stringify(initialText)
        }

        // uuid is used to uniquely identify sending instance
        let uuid = UTILS.uuid(true),
            sendingTime = new Date().getTime()

        const sendText = (textMessage, text) => {
            let data = {
                type: 'text',
                uuid: uuid,
                sendingTime: sendingTime
            }

            if ( textMessage ) {
                text = textMessage
                data.packets = parseInt(text.length / packetSize)
            }

            if ( text.length > packetSize ) {
                data.message = text.slice(0, packetSize)
            } else {
                data.message = text
                data.last = true
                data.isobject = isobject
            }

            config.channel.send(JSON.stringify(data))

            textToTransfer = text.slice(data.message.length)

            if ( textToTransfer.length ) {
                setTimeout(() => {
                    sendText(null, textToTransfer)
                }, 100)
            }
        }
        sendText(initialText)
    }
}

const TextReceiver = function() {
    let content = {}
    return {
        receive(data, onmessage, userid) {
            // uuid is used to uniquely identify sending instance
            let uuid = data.uuid
            if ( !content[uuid] ) {
                content[uuid] = []
            }

            content[uuid].push(data.message)
            if ( data.last ) {
                let message = content[uuid].join('')
                if ( data.isobject ) {
                    message = JSON.parse(message)
                }

                // latency detection
                let receivingTime = new Date().getTime(),
                    latency = receivingTime - data.sendingTime
                onmessage(message, userid, latency)

                delete content[uuid]
            }
        }
    }
}

const Message = new TextReceiver()

class NodeWebRTC extends EventEmitter {
    constructor(credential, fingerprint, configuration) {
        super()
        this.credential  = credential
        this.fingerprint = fingerprint
        this.iceServers  = configuration.iceServers
        this.constraints = configuration.constraints
        this.peers = {}
        this.channels = {}
        this.sdps = {}
        this.ices = {}
    }

    createOffer(roomToken, remote, sdpreturn, icereturn) {
        // pre-store icecandidate counter reference
        this.ices[remote] = 1

        this.peers[remote] = new WebRTC.RTCPeerConnection({
            iceservers: {
                iceServers: this.iceServers
            }
        }, {
            optional: this.constraints.optional
        })

        this.peers[remote].onicecandidate = event => {
            if ( !event.candidate ) {
                return
            } else if ( this.ices[remote] === 2 ) {
               icereturn(event.candidate)
            } else {
               this.ices[remote] += 1
            }
        }

        this.peers[remote].ondatachannel = event => {
            // define binaryType (default is blob)
            event.channel.binaryType = 'arraybuffer'

            this.emit('ondatachannel', message => {
                TextSender.send({
                    text: message,
                    channel: event.channel
                })
            })
        }

        //...
        this.channels[remote] = this.peers[remote].createDataChannel(JSON.stringify({
            channel: roomToken,
            userid: remote,
            mode: 'server', // server (server is auth), guest, auth
            credential: this.credential,
            fingerprint: this.fingerprint,
            avatar: '🤖' // non standard
        }), {/*RTCDataChannelInit*/})

        this.channels[remote].onopen = event => {
            //console.log('open', event)
        }

        this.channels[remote].onclose = event => {
            //console.log('close', event)
        }

        this.channels[remote].onmessage = event => {
            try {
                let data = JSON.parse(event.data)
                if ( data.type === 'text' ) {
                    Message.receive(data, message => {
                        this.emit('onmessage', message)
                    }, remote)
                } else {
                    throw('Invalid data "type" ... only standard "text"')
                }
            } catch(e) {
                //console.error(e)
            }
        }

        this.channels[remote].onerror = event => {
            //console.log(event)
        }

        //...
        this.peers[remote].createOffer(this.constraints.mandatory).then(sdp => {
            this.sdps[remote] = sdp
            return this.peers[remote].setLocalDescription(sdp)
        }).then(() => {
            //console.log('setLocalDescription')
            sdpreturn(this.sdps[remote])
        })

    }

    addAnswerSdp(remote, sdp) {
        //console.log('addAnswerSdp')
        this.peers[remote].setRemoteDescription(sdp)
    }

    addIceCandidate(remote, icecandidate) {
        //console.log('addIceCandidate')
        this.peers[remote].addIceCandidate(new WebRTC.RTCIceCandidate(icecandidate))
    }

    getSdp(remote) {
        console.log('getSdp', remote, this.sdps)
        return this.sdps[remote]
    }

    clearOffer(remote) {
        if ( this.channels[remote] ) {
            this.channels[remote].close()
            this.channels[remote] = null
            delete this.channels[remote]
        }
        if ( this.peers[remote] ) {
            this.peers[remote].close()
            this.peers[remote] = null
            delete this.peers[remote]
        }
        if ( this.sdps[remote] ) {
            this.sdps[remote] = null
            delete this.sdps[remote]
        }
        if ( this.ices[remote] ) {
            this.ices[remote] = null
            delete this.ices[remote]
        }
    }
}

module.exports = NodeWebRTC