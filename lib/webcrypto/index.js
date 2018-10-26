/**
 * @copyright Copyright (c) 2018 Lauro Moraes - [https://github.com/subversivo58]
 * @license The MIT License (MIT)             - [https://github.com/authchainjs/signaling/blob/master/LICENSE]
 * @version 0.1.0 [development stage]         - [https://github.com/authchainjs/signaling/blob/master/VERSIONING.md]
 */

const WebCrypto = require('node-webcrypto-ossl')
const crypto = new WebCrypto()

const UTILS = {
    /**
     * Extend objects - simple and minimalist merge objects
     * @arguments {Object}(s) - objects to merge
     * @return {Object} - merged objects
     * @throws {Object} - empty
     */
    Extend(...args) {
        try {
            return Object.assign(...args)
        } catch(e) {
            return {}
        }
    },
    isArrayBuffer(val) {
        return val && val.buffer instanceof ArrayBuffer && val.byteLength !== undefined
    }
}

/**
 * CryptoHandler - WebCrypto API abstract excentials functions
 * @see https://www.w3.org/TR/WebCryptoAPI/
 * @type {Object}
 */
const CryptoHandler = {
    /**
     * Create Secure Remote Password (also known as Proof of Secret)
     * @param  {Object}:ArrayBuffer passphraseKey - data from user password
     * @return {Object}:Promise                   - `Promise.resolve()` return `CryptoKey`
     */
    SRM(passphraseKey) {
        return crypto.subtle.importKey(
            'raw',
            passphraseKey,
            {
                name: 'PBKDF2'
            },
            false, // PBKDF2 don't exportable
            [ 'deriveKey', 'deriveBits' ]
        )
    },
    /**
     * Generate IV (Initialization Vector) up to 2⁶⁴−1
     * @param {Number} bits - number of bits (deafult: 96 follow has NIST recomendation)
     * @return {Object} - instanceof `ArrayBuffer`
     * @note Follow NIST recomendation use 96 bits
     * -- see: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf (section: 5.2.1.1)
     */
    vector(bits = 96) {
        return crypto.getRandomValues(new Uint8Array(bits))
    },
    /**
     * SHA family digest
     * @param  {String} algo    - algorithm definion (SHA-1, SHA-256, SHA-384 or SHA-512)
     * @param  {Object} buffer  - `ArrayBuffer` of data
     * @return {Object}:Promise - `Promise.resolve()` return `ArrayBuffer`
     */
    hash(algo, buffer) {
        return crypto.subtle.digest(algo, buffer)
    },
    generate: {
        /**
         * Generate RSA-GCM key
         * @param  {Object}:Array keyUsages - indicating what can be done with the derivated key
         * @param  {Boolean} extractable    - indicating if the key can be extracted from the `CryptoKey` object at a later stage
         * @param  {Number} length          - RSA-GCM "bits" 32, 64, 96, 104, 112, 120, 128 or 256 (default: 256)
         * @return {Object}:Promise         - `Promise.resolve()` return RSA-GCM `CryptoKey`
         */
        aesgcm(keyUsages, extractable = false, length = 256) {
            return crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: length,
                },
                extractable,
                keyUsages
            )
        },
        /**
         * Generate RSA-OAEP KeyPair
         * @param  {Object}:Array keyUsages - indicating what can be done with the derivated key
         * @param  {Boolean} extractable    - indicating if the key can be extracted from the `CryptoKey` object at a later stage
         * @param  {Number} length          - RSA-OAEP "modulusLength" (bits) 1024, 2048, or 4096 (default: 2048)
         * @param  {String} hash            - RSA-OAEP family SHA definition ... 'SHA-1', 'SHA-256', 'SHA-384', or 'SHA-512' (default: SHA-256)
         * @return {Object}:Promise         - `Promise.resolve()` return `CryptoKeyPair` public and private keys
         */
        rsaoaep(keyUsages, extractable = false, length = 2048, hash = 'SHA-256') {
            return crypto.subtle.generateKey(
                {
                    name: 'RSA-OAEP',
                    modulusLength: length,
                    publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65536
                    hash: {
                        name: hash
                    }
                },
                extractable,
                keyUsages
            )
        },
        /**
         * Generate CDSA Keys - to sign and verify
         * @param  {String} curve           - can be 'P-256', 'P-384', or 'P-521' (default: P-256)
         * @param  {Boolean} extractable    - indicating if the key can be extracted from the `CryptoKey` object at a later stage (dafault: false)
         * @param  {Object}:Array keyUsages - indicating what can be done with the derivated key
         * @return {Object}:Promise         - `Promise.resolve()` return `CryptoPair` (public and private keys)
         */
        ecdsa(keyUsages, extractable = false, curve = 'P-256') {
            return crypto.subtle.generateKey(
                {
                    name: 'ECDSA',
                    namedCurve: curve, //
                },
                extractable, // whether the key is extractable (i.e. can be used in exportKey)
                keyUsages // can be any combination of "sign" and "verify"
            )
        },
        /**
         * Generate HMAC Key - to sign and verify
         * @param  {String} hash            - hash family 'SHA-1', 'SHA-256', 'SHA-384', or 'SHA-512' (default: SHA-256)
         * @param  {Number} length          - optional, if you want your key length to differ from the hash function's block length (default: 256)
         * @param  {Boolean} extractable    - indicating if the key can be extracted from the `CryptoKey` object at a later stage (dafault: false)
         * @param  {Object}:Array keyUsages - indicating what can be done with the derivated key
         * @return {Object}:Promise         - `Promise.resolve()` return `CryptoPair` (public and private keys)
         */
        hmac(keyUsages, extractable = false, length = 256, hash = 'SHA-256') {
            return crypto.subtle.generateKey(
                {
                    name: 'HMAC',
                    hash: {
                        name: hash
                    },
                    length: length
                },
                extractable,
                keyUsages
            )
        }
    },
    /**
     * Generate `CryptoKey` derived from a master key and a specific algorithm given as parameters
     * @param  {Object} algorithm          - object defining the derivation algorithm to use
     * @param  {Object} masterKey          - `CryptoKey` based derivation
     * @param  {Object} deriveKeyAlgorithm - object defining the algorithm the derived key
     * @param  {Boolean} extractable       - indicating if the key can be extracted from the `CryptoKey` object at a later stage
     * @param  {Object}:Array keyUsages    - indicating what can be done with the derivated key
     * @return {Object}:Promise            - `Promise.resolve()` return `CryptoKey`
     */
    derive(algorithm, masterKey, derivedKeyAlgorithm, extractable, keyUsages) {
        return crypto.subtle.deriveKey(algorithm, masterKey, derivedKeyAlgorithm, extractable, keyUsages)
    },
    encrypt: {
        /**
         * Encryption use AES-GCM
         * @param  {Object} opts    - "data", "key", "iv", "additionalData" (optional) and "length" (aka "dataLength")
         * @return {Object}:Promise - `Promise.resolve()` return `ArrayBuffer`
         */
        aesgcm(options) {
            opts = UTILS.Extend({}, {
                additionalData: null,
                dataLength: 256
            }, options)
            return crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    /**
                     * Don't re-use initialization vectors!
                     * Always generate a new iv every time your encrypt!
                     * Recommended to use: `crypto.getRandomValues(new Uint8Array(16))`
                     */
                    iv: opts.iv,
                    // Additional authentication data (optional)(`ArrayBuffer`)
                    additionalData: opts.additionalData,
                    // Tag length (bits) can be 32, 64, 96, 104, 112, 120, 128 or 256 (default)
                    length: opts.dataLength,
                },
                opts.key, // `CryptoKey` from generateKey or importKey above
                opts.data // `ArrayBuffer` of data you want to encrypt
            )
        },
        /**
         * Encryption use RSA-OAEP
         * @param  {Object} publickey         - `CryptoKey` RSA-OAEP publick key
         * @param  {Object}:ArrayBuffer data  - `ArrayBuffer` of data you want to encrypt
         * @param  {Object}:ArrayBuffer label - (default: false [not apply])
         * @return {Object}:Promise           - `Promise.resolve()` return `ArrayBuffer`
         */
        rsaoaep(publickey, data, label = false) {
            let algorithm = {
                name: 'RSA-OAEP'
            }
            if ( label && UTILS.isArrayBuffer(label) ) {
                algorithm.label = label
            }
            return crypto.subtle.encrypt(
                algorithm,
                publicKey,
                data
            )
        }
    },
    decrypt: {
        /**
         * Decryption use AES-GCM
         * @param  {Object} opts    - "data", "key", "iv", "additionalData" (optional) and "length" (aka "dataLength")
         * @return {Object}:Promise - `Promise.resolve()` return `ArrayBuffer`
         */
        aesgcm(options) {
            opts = UTILS.Extend({}, {
                additionalData: null,
                dataLength: 256
            }, options)
            return crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: opts.iv,                         // The iv (Initialization Vector)(ArrayBuffer) you used to encrypt
                    additionalData: opts.additionalData, // The addtionalData you used to encrypt (ArrayBuffer)(default: null)
                    length: opts.dataLength,             // The length (bits) you used to encrypt 32, 64, 96, 104, 112, 120, 128 or 256 (default: 256)
                },
                opts.key, // `CryptoKey` from generateKey or importKey above
                opts.enc  // `ArrayBuffer` of the data
            )
        },
        /**
         * Decryption use RSA-OAEP
         * @param  {Object} privateKey        - `CryptoKey` RSA-OAEP private key
         * @param  {Object}:ArrayBuffer data  - `ArrayBuffer` of data you want to decrypt
         * @param  {Object}:ArrayBuffer label - (default: false [not apply])
         * @return {Object}:Promise           - `Promise.resolve()` return `ArrayBuffer`
         */
        rsaoaep(privateKey, data, label = false) {
            let algorithm = {
                name: 'RSA-OAEP'
            }
            if ( label && UTILS.isArrayBuffer(label) ) {
                algorithm.label = label
            }
            return crypto.subtle.decrypt(
                algorithm,
                privateKey,
                data
            )
        }
    },
    /**
     * Wrap keys
     * @type {Object}
     */
    wrap: {
        /**
         * [aesgcm description]
         * @param  {String} format                     - "wrapping" format 'jwk', 'raw', 'spki', or 'pkcs8' (default: 'jwk')
         * @param  {Object} key                        - `CryptoKey` to "wrap" (AES-CTR, AES-CBC, AES-GCM, HMAC, RSASSA-PKCS1-v1_5, RSA-PSS, RSA-OAEP, ECDSA, ECDH)
         * @param  {Object} wrappingKey                - `CryptoKey` AES-GCM key with "wrapKey" usage flag
         * @param  {Object}:ArrayBuffer iv             - iv (Inicialization Vector)
         * @param  {Object}:ArrayBuffer additionalData - the addtionalData you used to encrypt (default: null)
         * @param  {Number} length                     - the length (bits) you used to encrypt 32, 64, 96, 104, 112, 120, 128 or 256 (default: 256)
         * @return {Object}:Promise                    - `Promise.resolve()` return `ArrayBuffer`
         */
        aesgcm(key, wrappingKey, iv, additionalData = null, length = 256, format = 'jwk') {
            return crypto.subtle.wrapKey(
                format,
                key,
                wrappingKey,
                {
                    name: 'AES-GCM',
                    iv: iv,
                    additionalData: additionalData,
                    length: length
                }
            )
        },
        /**
         * WrapKey using RSA-OAEP
         * @param  {Object} key       - `CryptoKey` to "wrap" ... to fit in RSA-OAEP padding (AES-CTR, AES-CBC, AES-GCM, HMAC)
         * @param  {Object} publickey - `CryptoKey` RSA-OAEP public key
         * @param  {String} hash      - RSA-OAEP family SHA definition ... 'SHA-1', 'SHA-256', 'SHA-384', or 'SHA-512' (default: SHA-256)
         * @return {Object}:Promise   - `Promise.resolve()` return `ArrayBuffer`
         */
        rsaoaep(key, publickey, hash = 'SHA-256') {
            return crypto.subtle.wrapKey(
                'raw',
                key,
                publicKey,
                {
                    name: 'RSA-OAEP',
                    hash: {
                        name: hash
                    }
                }
            )
        }
    },
    /**
     * Unwrap keys
     * @type {Object}
     */
    unwrap: {
        /**
         * UnwrapKey using RSA-GCM
         * @param  {Object}:ArrayBuffer wrapped        - the key you want to "unwrap" (AES-CTR, AES-CBC, AES-GCM, HMAC, RSASSA-PKCS1-v1_5, RSA-PSS, RSA-OAEP, ECDSA, ECDH)
         * @param  {Object} wrappingKey                - `CryptoKey` AES-GCM key with "unwrapKey" usage flag
         * @param  {Object}:ArrayBuffer iv             - iv (Inicialization Vector) used in "wrap"
         * @param  {Object} algorithm                  - algorithm definition to use in "wrapped" key
         * @param  {Object}:Array keyUsages            - indicating what can be done with the derivated key
         * @param  {Boolean} extractable               - indicating if the key can be extracted from the `CryptoKey` object at a later stage (default: false)
         * @param  {Object}:ArrayBuffer additionalData - additionalData - the addtionalData you used to encrypt (default: null)
         * @param  {Number} length                     - the length (bits) you used to encrypt 32, 64, 96, 104, 112, 120, 128 or 256 (default: 256)
         * @param  {String} format                     - format used in "wrapping" 'jwk', 'raw', 'spki', or 'pkcs8' (default: 'jwk')
         * @return {Object}:Promise                    - `Promise.resolve()` return `CryptoKey`
         */
        aesgcm(wrapped, wrappingKey, iv, algorithm, keyUsages, extractable = false, additionalData = null, length = 256, format = 'jwk') {
            return crypto.subtle.unwrapKey(
                format,
                wrapped,
                wrappingKey,
                {
                    name: 'AES-GCM',
                    iv: iv,
                    additionalData: additionalData,
                    length: length
                },
                algorithm,
                extractable,
                keyUsages
            )
        },
        /**
         * UnwrapKey using RSA-OAEP
         * @param  {Object}:ArrayBuffer wrapped - previous "wrapped" key (AES-CTR, AES-CBC, AES-GCM, HMAC)
         * @param  {Object} privatekey          - `CryptoKey` RSA-OAEP private key
         * @param  {Object} wrappedAlgorithm    - algorithm definition of previous "wrapped" key
         * @param  {Object}:Array keyUsages     - indicating what can be done with the derivated key
         * @param  {Boolean} extractable        - indicating if the key can be extracted from the `CryptoKey` object at a later stage (default: false)
         * @param  {Number} length              - RSA-OAEP "modulusLength" (bits) 1024, 2048, or 4096 (default: 2048)
         * @param  {String} hash                - RSA-OAEP family SHA definition ... 'SHA-1', 'SHA-256', 'SHA-384', or 'SHA-512' (default: SHA-256)
         * @return {Object}:Promise             - `Promise.resolve()` return `CryptoKey`
         */
        rsaoaep(wrapped, privatekey, wrappedAlgorithm, keyUsages, extractable = false, length = 2048, hash = 'SHA-256') {
            return crypto.subtle.unwrapKey(
                'raw',
                wrapped,
                privateKey,
                {
                    name: 'RSA-OAEP',
                    modulusLength: length,
                    publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65536
                    hash: {
                        name: hash
                    },
                },
                wrappedAlgorithm,
                extractable,
                keyUsages
            )
        }
    },
    /**
     * Hanlder ECDSA
     * @type {Object}
     */
    ecdsa: {
        /**
         * Sign data use ECDSA private key
         * @param  {Object} hash             - object defining the hash algorithm to use ... can be 'SHA-1', 'SHA-256', 'SHA-384', or 'SHA-512' (default: SHA-256)
         * @param  {Object} privateKey       - `CryptoKey` ECDSA private key
         * @param  {Object}:ArrayBuffer data - `ArrayBuffer` of data to sign
         * @return {Object}:Promise          - `Promise.resolve()` return `ArrayBuffer` of signature
         */
        sign(privateKey, data, hash = 'SHA-256') {
            return crypto.subtle.sign(
                {
                    name: 'ECDSA',
                    hash: {
                        name: hash
                    }
                },
                privateKey,
                data
            )
        },
        /**
         * Verify data signature use ECDSA public key
         * @param  {Object} hash                  - object defining the hash algorithm to use ... can be 'SHA-1', 'SHA-256', 'SHA-384', or 'SHA-512' (default: SHA-256)
         * @param  {Object} publicKey             - `CryptoKey` ECDSA public key
         * @param  {Object}:ArrayBuffer signature - `ArrayBuffer` of data signature
         * @param  {Object}:ArrayBuffer data      - `ArrayBuffer` of data to check signature
         * @return {Object}:Promise               - `Promise.resolve()` return `ArrayBuffer` of signature
         */
        verify(publicKey, signature, data, hash = 'SHA-256') {
            return crypto.subtle.verify(
                {
                    name: 'ECDSA',
                    hash: {
                        name: hash
                    }
                },
                publicKey,
                signature,
                data
            )
        }
    },
    /**
     * Handler HMAC
     * @type {Object}
     */
    hmac: {
        /**
         * Sign data use HMAC key
         * @param  {Object} privateKey       - `CryptoKey` HMAC key
         * @param  {Object}:ArrayBuffer data - `ArrayBuffer` of data to sign
         * @return {Object}:Promise          - `Promise.resolve()` return `ArrayBuffer` of signature
         */
        sign(key, data) {
            return crypto.subtle.sign(
                {
                    name: 'HMAC'
                },
                key,
                data
            )
        },
        /**
         * Verify data signature use HMAC key
         * @param  {Object} key                   - `CryptoKey` HMAC key
         * @param  {Object}:ArrayBuffer signature - `ArrayBuffer` of data signature
         * @param  {Object}:ArrayBuffer data      - `ArrayBuffer` of data to check signature
         * @return {Object}:Promise               - `Promise.resolve()` return a boolean on whether the signature is true or not
         */
        verify(key, signature, data) {
            return crypto.subtle.verify(
                {
                    name: 'HMAC'
                },
                key,
                signature,
                data
            )
        }
    },
    /**
     * Export `CryptoKey` to "raw" or "jwk" format (default: "jwk")
     * @param  {String} format    - "raw" or "jwk"
     * @param  {Object} masterKey - `CryptoKey` to be has exported
     * @return {Object}:Promise   - `Promise.resolve()` return {String} "jwk"
     */
    export(masterKey, format = "jwk") {
        return crypto.subtle.exportKey(format, masterKey)
    },
    /**
     * Import `CryptoKey` from "raw" or "jwk" format (default: "jwk")
     * @param  {String} format          - "raw" or "jwk"
     * @param  {String} jwk             - previous exported key
     * @param  {Object} algorithm       - key algorithm definition
     * @param  {Boolean} extractable    - whether the key is extractable (i.e. can be used in exportKey)
     * @param  {Object}:Array keyUsages - indicating what can be done with the derivated key
     * @return {Object}:Promise         - `Promise.resolve()` return `CryptoKey`
     */
    import(jwk, algorithm, extractable, keyUsages, format = "jwk") {
        return crypto.subtle.importKey(format, jwk, algorithm, extractable, keyUsages)
    }
}

module.exports = CryptoHandler