/**
 * @copyright Copyright (c) 2018 Lauro Moraes - [https://github.com/subversivo58]
 * @license The MIT License (MIT)             - [https://github.com/authchainjs/signaling/blob/master/LICENSE]
 * @version 0.1.0 [development stage]         - [https://github.com/authchainjs/signaling/blob/master/VERSIONING.md]
 */

const stream = require('stream')
const Duplex = require('stream').Duplex
const {
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder
} = require('util')

// utilities
const UTILS = {
    /**
     * Queue [FIFO - First in, first out] - [call with constructor]
     */
    Queue: function() {
        this.q = []
        this.__proto__.push = item => {
            this.q.push(item)
        }
        this.__proto__.shift = () => {
            return this.q.shift() // empty array return "undefined"
        }
        this.__proto__.size = () => {
            return this.q.length
        }
    },
    /**
     * Stack [LIFO - Last in, first out] - [call with constructor]
     */
    Stack: function() {
        this.s = []
        this.__proto__.push = item => {
            this.s.push(item)
        }
        this.__proto__.shift = () => {
            return this.s.pop() // empty `Array` return "undefined"
        }
        this.__proto__.last = () => {
            return this.s[this.s.length -1]
        }
        this.__proto__.size = () => {
            return this.s.length
        }
    },
    /**
     * `Array` merge [no duplicates]
     * @param {Array} origin - original object `Array` to merge
     * @param {Array}(s) args - objects to merge
     * @return {Array} - original or merged result
     */
    Merge(origin, ...args) {
        if ( !Array.isArray(...args) ) {
            return origin
        }
        // no duplicates ordered by "sort()"
        return Array.from(
            new Set(origin.concat(...args))
        ).sort()
    },
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
    /**
     * Generate UUID [long and short] [default: long]
     * @param {Boolean} short - indicates return short UUID
     * @return {String}
     */
    uuid(short) {
        if ( short ) {
            return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        }
        let s4 = () => {
            return Math.floor(Math.random() * 0x10000).toString(16)
        }
        return s4()+s4()+'-'+s4()+'-'+s4()+'-'+s4()+'-'+s4()+s4()+s4()
    },
    /**
     * utils utility
     */
    object2String(o) {
        return Object.prototype.toString.call(o)
    },
    hasOwnProperty(obj, prop) {
        return Object.prototype.hasOwnProperty.call(obj, prop)
    },
    inArray(needle, haystack) {
        try {
            needle.includes(haystack)
        } catch(_) {
            return false
        }
    },
    String2ArrayBuffer(str) {
        let encoder = new TextEncoder('utf-8')
        return encoder.encode(str)
    },
    ArrayBuffer2String(buffer) {
        let decoder = new TextDecoder('utf-8')
        return decoder.decode(buffer)
    },
    Buffer2Hex(ArrayBuffer) {
        let view = new Uint8Array(ArrayBuffer),
            result = '',
            value
        for (let i = 0; i < view.length; i++) {
             value = view[i].toString(16)
             result += (value.length === 1 ? '0' + value : value)
        }
        return result
    },
    hex2Buffer(hex) {
      let i,
          byteLen = hex.length / 2,
          arr,
          j = 0
      if ( byteLen !== parseInt(byteLen, 10) ) {
          throw new Error(`Invalid hex length '${hex.length}'`)
      }
      arr = new Uint8Array(byteLen)
      for (i = 0; i < byteLen; i += 1) {
           arr[i] = parseInt(hex[j] + hex[j + 1], 16)
           j += 2
      }
      return arr
    },
    Buffer2Stream(buffer) {
        let stream = new Duplex()
        stream.push(buffer)
        stream.push(null)
        return stream
    },
    btoa(s) {
        return Buffer.from(s, 'binary').toString('base64')
    },
    atob(s) {
        return Buffer.from(s, 'base64').toString('binary')
    },

    /**
     * Utilities "is"
     */
    isString(str) {
        return typeof str === 'string'
    },
    isBoolean(val) {
        return typeof val === 'boolean'
    },
    isInteger(int) {
        return Number.isInteger(int)
    },
    isNumber(arg) {
        return typeof arg === 'number'
    },
    isNull(arg) {
        return arg === null
    },
    isObject(obj) {
        return typeof obj === 'object'
    },
    isElement(obj) {
        try {
            return (obj.constructor.__proto__.prototype.constructor.name) ? true : false
        } catch(_) {
            return false
        }
    },
    isNodeList(list) {
        return (!UTILS.isUndefined(list.length) && !UTILS.isUndefined(list.item))
    },
    isArray(obj) {
        return Array.isArray(obj)
    },
    isUndefined(arg) {
        return arg === void 0
    },
    isFunction(arg) {
        return typeof arg === 'function'
    },
    isPrimitive(arg) {
        return arg === null || typeof arg === 'boolean' || typeof arg === 'number' || typeof arg === 'string' || /* ES6 symbol */ typeof arg === 'symbol' || typeof arg === 'undefined'
    },
    isDate(d) {
        return UTILS.isObject(d) && UTILS.object2String(d) === '[object Date]'
    },
    isError(e) {
        return UTILS.isObject(e) && (UTILS.object2String(e) === '[object Error]' || e instanceof Error)
    },
    isRegEx(re) {
        return UTILS.isObject(re) && UTILS.object2String(re) === '[object RegExp]'
    },
    isSymbol(arg) {
        return typeof arg === 'symbol'
    },
    isJWT(str) {
        return UTILS.isString(str) && /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/.test(str)
    },
    type(obj) {
        return (obj) ? UTILS.object2String(obj).replace(/^\[object (.+)\]$/, '$1').toLowerCase() : 'undefined'
    },
    isArrayBuffer(val) {
        return val && val.buffer instanceof ArrayBuffer && val.byteLength !== undefined
    },
    isBufferObj(obj) {
        return Buffer.isBuffer(obj)
    },
    isStreamObj(obj) {
        return obj instanceof stream.Stream && typeof (obj._read === 'function') && typeof (obj._readableState === 'object')
    }
}

module.exports = UTILS