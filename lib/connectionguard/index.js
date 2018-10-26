/**
 * @copyright Copyright (c) 2018 Lauro Moraes - [https://github.com/subversivo58]
 * @license The MIT License (MIT)             - [https://github.com/authchainjs/signaling/blob/master/LICENSE]
 * @version 0.1.0 [development stage]         - [https://github.com/authchainjs/signaling/blob/master/VERSIONING.md]
 */

class ConnectionGuard {

    constructor(baseorigin, expires = 900000) {
        this.alloweds   = {}      // allowed origins
        this.denyeds    = {}      // denyed origins
        this.blokedips  = {}      // blocked ip's
        this.expires    = expires // default 15 minutes for blocked ip's
        if ( baseorigin ) {
            this.alloweds[baseorigin] = true
        }
    }

    isAllowed(target) {
        return this.alloweds[target] ? true : false
    }

    addOrigin(target) {
        this.alloweds[target] = true
    }

    denyOrigin(target) {
        this.denyeds[target] = true
    }

    blockIP(ip, expire = false) {
        let exp = expire ? expire : this.expires
        this.blokedips[ip] = exp
        setTimeout(() => {
            delete this.blokedips[ip]
        }, exp)
    }

    ipFinder(ip) {
        return this.blokedips[ip] ? this.blokedips[ip] : false
    }

    verify(info, guard, token, cb) {
        try {
            // Secure:
            let isSecure = info.secure,
                // Request:
                socketRequest = info.req,
                // Headers:
                socketHeaders = socketRequest.headers,
                // Cookies:
                socketCookies = socketHeaders.cookie,
                // User Agent:
                socketUA = socketHeaders['user-agent'],
                // Origin (unstrusted info):
                socketOrigin = info.origin || socketHeaders.origin || null,
                // Connection IP
                socketIP = socketHeaders['x-real-ip'] || socketHeaders['x-forwarded-for'] || null

            // @TODO: for security (TLS), check "isSecure"
            if ( /*!isSecure || */!guard.isAllowed(socketOrigin) ) {
                // @TODO: log here
                cb(false, 401, 'Unauthorized')
            } else if ( guard.ipFinder(socketIP) ) {
                cb(false, 429, 'Too Many Requests')
            } else {
                //
                if ( socketHeaders['sec-websocket-protocol'] ) {
                    let parts = socketHeaders['sec-websocket-protocol'].replace(/\s/, '').split(',')
                    if ( token.valid(parts[0], parts[1]) ) {
                        token.allow(parts[0], true)
                        cb(true)
                    } else {
                        cb(false, 102, 'Close Protocol Error') // generic for failure
                    }
                } else {
                    cb(true)
                }
            }
        } catch(e) {
            cb(false, 401, 'Unauthorized')
        }
    }
}

module.exports = ConnectionGuard