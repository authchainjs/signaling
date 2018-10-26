/**
 * @copyright Copyright (c) 2018 Lauro Moraes - [https://github.com/subversivo58]
 * @license The MIT License (MIT)             - [https://github.com/authchainjs/signaling/blob/master/LICENSE]
 * @version 0.1.0 [development stage]         - [https://github.com/authchainjs/signaling/blob/master/VERSIONING.md]
 */

const jwt = require('jsonwebtoken')

class WebSocketTokenAccess {
    constructor(secret, expires = 500) {
        this.secret = secret
        this.expires = expires // ms
        this.tokens = {}
        this.allows = {}
    }

    // @TODO: add "audience", "issuer", ...
    generate(uuid) {
        let expires = this.expires,
            token = jwt.sign({}, this.secret, { expiresIn: expires })
        this.tokens[uuid] = token
        setTimeout(() => {
            delete this.tokens[uuid]
        }, this.expires)
        return {
            token: token,
            uuid: uuid
        }
    }

    valid(uuid, token) {
        try {
             return jwt.verify(this.tokens[uuid], this.secret)
        } catch(e) {
             // @TODO: add to .log ?
             return false
        }
    }

    allow(uuid, save = false) {
        if ( save ) {
            this.allows[uuid] = true
        } else {
            if ( this.allows[uuid] ) {
                delete this.allows[uuid]
                return true
            }
            return false
        }
    }

}

module.exports = WebSocketTokenAccess