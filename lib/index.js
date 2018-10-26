/**
 * @copyright Copyright (c) 2018 Lauro Moraes - [https://github.com/subversivo58]
 * @license The MIT License (MIT)             - [https://github.com/authchainjs/signaling/blob/master/LICENSE]
 * @version 0.1.0 [development stage]         - [https://github.com/authchainjs/signaling/blob/master/VERSIONING.md]
 */

const connectionguard = require('./connectionguard')
const tokenaccess     = require('./tokenaccess')
const blockchain      = require('./blockchain')
const credential      = require('./credential')
const webcrypto       = require('./webcrypto')
const webrtc          = require('./nodewebrtc')
const sha256          = require('./sha256')
const utils           = require('./utils')
const store           = require('./store')

module.exports = {
    ConnectionGuard: connectionguard,
    TokenAccess: tokenaccess,
    Blockchain: blockchain,
    WebCrypto: webcrypto,
    SHA256: sha256,
    RTC: webrtc,
    Utils: utils,
    Store: store,
    Credential: credential
}