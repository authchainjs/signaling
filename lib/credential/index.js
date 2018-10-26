/**
 * @copyright Copyright (c) 2018 Lauro Moraes - [https://github.com/subversivo58]
 * @license The MIT License (MIT)             - [https://github.com/authchainjs/signaling/blob/master/LICENSE]
 * @version 0.1.0 [development stage]         - [https://github.com/authchainjs/signaling/blob/master/VERSIONING.md]
 */

const EventEmitter = require('events')
const UTILS = require('../utils/')
const Store = require('../store/')
const SHA256 = require('../sha256/')
const ChainHandler = require('../blockchain/')

const fs = require('fs')

const Storage = new Store({
    path: './security/',
    fileName: 'credential',
    defaults: {}
})

const WebCrypto = require('../webcrypto/')

const GenerateKeys = passphrase => {
    return new Promise(resolve => {
        // Create Secure Remote Password (also known as Proof of Secret)
        WebCrypto.SRM(UTILS.String2ArrayBuffer( passphrase )).then(CryptoKey => {
            // generate (derive) AES-GCM key
            WebCrypto.derive({
                name: 'PBKDF2',
                salt: WebCrypto.vector(),
                iterations: 1000000, // mobile = 100.000, desktop.32bit = 1.000.000, desktop.64bit = 10.000.000
                hash: 'SHA-256'
            }, CryptoKey, {
                name: 'AES-GCM',
                length: 256
            }, true, ['encrypt','decrypt','wrapKey','unwrapKey']).then(AESGCM => {
                // create ECDSA, HMAC AND AES-OAEP keys
                ;(async () => {
                    let ECDSA     = await WebCrypto.generate.ecdsa([ 'sign', 'verify' ], true)
                    //let HMAC    = await WebCrypto.generate.hmac([ 'sign', 'verify' ], true)
                    //let RSAOAEP = await WebCrypto.generate.rsaoaep([ 'encrypt', 'decrypt', 'wrapKey', 'unwrapKey' ], true)
                    let aesgcm    = await WebCrypto.export(AESGCM)
                    let private   = await WebCrypto.export(ECDSA.privateKey)
                    let public    = await WebCrypto.export(ECDSA.publicKey)

                    //let tosign = UTILS.String2ArrayBuffer(Date.now())
                    //let signature = await WebCrypto.ecdsa.sign(ECDSA.privateKey, tosign)

                    // "your keys" is used to generate SHA256 "id"
                    let components = {
                        aesgcm: aesgcm.k, //
                        ecdsa: {
                            0: private.x, // private
                            1: private.y, // private
                            2: private.d, // private
                            3: public.x,  // public
                            4: public.y   // public
                        }
                    }
                    resolve({
                        aesgcm: AESGCM,
                        ecdsa: ECDSA,
                        jwk: components
                    })
                })();
            })
        })
    })
}

class CredentialManager extends EventEmitter {
    constructor() {
        super()
        const self = this
        // 32 chars
        this.fingerprint = process.env.FINGERPRINT || UTILS.Buffer2Hex( WebCrypto.vector(16) )
        this.aesgcm = null
        this.ecdsa  = null
        this.jwk    = null
        this.block  = null  // blockchain index reference

        // initialize
        if ( Storage.length() === 0 ) {
            GenerateKeys(this.fingerprint).then(keyring => {
                self.aesgcm = keyring.aesgcm
                self.ecdsa  = keyring.ecdsa
                self.jwk    = keyring.jwk
                //
                Storage.set(keyring.jwk)

                // mine block
                self.block = ChainHandler.addBlock([
                    self.jwk.ecdsa[3], // ecdsa public jwk "x"
                    self.jwk.ecdsa[4]  // ecdsa public jwk "y"
                ])

                self.id = self.block.h
                Storage.set('id', self.block.h)
                Storage.set('block', self.block.i)

                self.emit('done', self.credential(), self.fingerprint, self.getKeys())
            })
        } else {
            ;(async () => {
                let compound = await Storage.getAll()

                let base_jwk = {
                    kty: 'EC',
                    crv: 'P-256'
                },
                privateKey = UTILS.Extend({}, base_jwk, {
                    key_ops: ['sign'],
                    x: compound.ecdsa[0],
                    y: compound.ecdsa[1],
                    d: compound.ecdsa[2]
                }),
                publicKey = UTILS.Extend({}, base_jwk, {
                    key_ops: ['verify'],
                    x: compound.ecdsa[3],
                    y: compound.ecdsa[4]
                }),

                base_aesgcm = {
                    kty: 'oct',
                    alg: 'A256GCM',
                    key_ops: [ 'encrypt', 'decrypt', 'wrapKey', 'unwrapKey' ],
                    k: compound.aesgcm,
                    ext: true
                };

                self.aesgcm = await WebCrypto.import(
                    base_aesgcm,
                    {
                        name: 'AES-GCM'
                    },
                    false,
                    ['encrypt','decrypt','wrapKey','unwrapKey'],
                    'jwk'
                )

                self.ecdsa = {
                    privateKey: await WebCrypto.import(
                        privateKey,
                        {
                            name: "ECDSA",
                            namedCurve: "P-256",
                        },
                        false,
                        ['sign'],
                        'jwk'
                    ),
                    publicKey: await WebCrypto.import(
                        publicKey,
                        {
                            name: "ECDSA",
                            namedCurve: "P-256",
                        },
                        false,
                        ['verify'],
                        'jwk'
                    )
                }

                self.jwk = compound
                self.id  = compound.id
                self.block = compound.block

                self.emit('done', self.credential(), self.fingerprint, self.getKeys())
            })();
        }
    }

    credential() {
        return {
            id: this.id,
            block: this.block,
            publicKey: {
                kty: 'EC',
                crv: 'P-256',
                key_ops: ['verify'],
                x: this.jwk.ecdsa[3],
                y: this.jwk.ecdsa[4]
            }
        }
    }

    getKeys() {
        return {
            aesgcm: this.aesgcm,
            ecdsa: this.ecdsa
        }
    }

    get() {
        //
    }
}

module.exports = CredentialManager