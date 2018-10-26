/**
 * @copyright Copyright (c) 2018 Lauro Moraes - [https://github.com/subversivo58]
 * @license The MIT License (MIT)             - [https://github.com/authchainjs/signaling/blob/master/LICENSE]
 * @version 0.1.0 [development stage]         - [https://github.com/authchainjs/signaling/blob/master/VERSIONING.md]
 */

const path = require('path')
const fs = require('fs')

const SaveData = (target, data) => {
    fs.writeFileSync(target, JSON.stringify(data, null, 4))
}

class Store {
    constructor(opts){
        this.path = path.join(('path' in opts) ? opts.path : './files/', ('fileName' in opts) ? opts.fileName + '.json' : 'generic-store.json')
        // hummm ... default to `Array`
        this.data = parseDataFile(this.path, ('defaults' in opts) ? opts.defaults : [])

        this.isArray = Array.isArray(this.data) ? true : false
    }

    get(index) {
        return this.data[index]
    }

    getAll() {
        return this.data
    }

    set(key, val = undefined) {
        if ( this.isArray ) {
            this.data.push(key) // return "length" ?
        } else {
            typeof val === 'undefined' ? this.data = key : this.data[key] = val
        }
        SaveData(this.path, this.data)
    }

    delete(index) {
        if ( this.isArray ) {
            if ( this.data[index] ) {
                this.data.splice(index, 1)
            }
        } else {
            delete this.data[index]
        }
        SaveData(this.path, this.data)
    }

    clear() {
        this.data = (this.isArray) ? [] : {}
        SaveData(this.path, this.data)
    }

    length() {
        return (this.isArray) ? this.data.length : Object.keys(this.data).length
    }
}

const parseDataFile = (filePath, defaults) => {
    try {
        return JSON.parse(fs.readFileSync(filePath))
    } catch(e) {
        return defaults
    }
}

// expose the class
module.exports = Store