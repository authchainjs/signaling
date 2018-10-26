/**
 * @copyright Copyright (c) 2018 Lauro Moraes - [https://github.com/subversivo58]
 * @license The MIT License (MIT)             - [https://github.com/authchainjs/signaling/blob/master/LICENSE]
 * @version 0.1.0 [development stage]         - [https://github.com/authchainjs/signaling/blob/master/VERSIONING.md]
 */

const fs = require('fs')
const UTILS = require('../utils/')

class BlockStore {

    constructor(ledgerdir = false, options, restartup = false) {

        if ( !ledgerdir || !UTILS.isString(ledgerdir) ) {
            throw new Error('Failed initialize class "BlockStore" ... no have or invalid "ledger directory"')
        }
        if ( !('genesishash' in options) || !UTILS.isString(options.genesishash) || (options.genesishash.length !== 64) ) {
            throw new Error('Failed initialize class "BlockStore" ... no have or invalid "Genesis block hash"')
        }
        // ...
        this.ledgers     = []
        this.genesishash = options.genesishash
        this.ledgerdir  = ledgerdir.substr(-1, 1) === '/' ? ledgerdir : ledgerdir + '/'
        this.breakpiece  = ('breakpiece' in options && UTILS.isNumber(options.breakpiece)) ? options.breakpiece : 100000
        this.config      = null
        //this.lastBlock   = null
        this.length      = 0      // total of blocks

        if ( fs.existsSync(this.ledgerdir) && fs.statSync(this.ledgerdir).isDirectory() ) {
            // ...
            let ledgers = fs.readdirSync(this.ledgerdir, {
                withFileTypes: true,
                encoding: 'utf8'
            })
            if ( ledgers.length > 0 ) {
                ledgers.forEach((item, i, array) => {
                    if ( item.isFile() ) {
                        if ( item.name === 'config.json' ) {
                            this.config = JSON.parse(fs.readFileSync(this.ledgerdir + item.name))
                        } else if ( /\.db/.test(item.name) ) {
                            this.ledgers.push(item.name)
                        }
                    }
                    // end of loop
                    if ( i === array.length -1 ) {
                        if ( this.ledgers.length === 0 ) {
                            try {
                                fs.writeFileSync(this.ledgerdir + 'ledger-1.db', '', {
                                    encoding: 'utf8'
                                })
                                this.ledgers.push('ledger-1.db')
                            } catch(e) {
                                throw new Error(e)
                            }
                        } else {
                            let fileSize = fs.statSync(this.ledgerdir + this.ledgers[this.ledgers.length -1]).size
                            if ( this.ledgers.length === 1 ) {
                                this.length = fileSize / 258
                            } else {
                                this.length = (this.ledgers.length -1) * this.breakpiece + fileSize / 258
                            }
                            this.config.length = this.length
                            // get "lastBlock"
                            ;(async () => {
                                let startOn = fileSize - 258
                                let readStream = fs.createReadStream(this.ledgerdir + this.ledgers[this.ledgers.length -1], {
                                    start: startOn,
                                    end: fileSize,
                                    highWaterMark: 258,
                                    encoding: 'utf8'
                                })
                                // ...
                                for await (const chunk of readStream) {
                                    readStream.destroy()
                                    this.config.lastBlock = chunk
                                    fs.writeFileSync(this.ledgerdir + 'config.json', JSON.stringify(this.config, null, 4), 'utf8')
                                    //console.log(this)
                                }
                            })();
                        }
                        if ( this.config === null ) {
                            let configuration = {
                                breakpiece: this.breakpiece,
                                lastBlock: null,
                                length: this.length
                            }
                            fs.writeFileSync(this.ledgerdir + 'config.json', JSON.stringify(configuration), {
                                encoding: 'utf8'
                            })
                            this.config = configuration
                        } else {
                            // to restore "breakpiece"
                            this.breakpiece = this.config.breakpiece
                        }
                    }
                })
            } else {
                try {
                    fs.writeFileSync(this.ledgerdir + 'ledger-1.db', '', {
                        encoding: 'utf8'
                    })
                    this.ledgers.push('ledger-1.db')

                    let configuration = {
                        breakpiece: this.breakpiece,
                        lastBlock: null,
                        length: this.length
                    }
                    fs.writeFileSync(this.ledgerdir + 'config.json', JSON.stringify(configuration), {
                        encoding: 'utf8'
                    })
                    this.config = configuration
                } catch(e) {
                    throw new Error(e)
                }
            }
        } else {
            throw new Error('Failed initialize class "BlockStore" ... "ledgerdir" not exists or not is directory')
        }
    }

    async getBlock(index) {
        // get file size
        let fileSize = fs.statSync(this.ledgerdir + this.ledgers[this.ledgers.length -1]).size
        if ( fileSize > 258 ) {
            let startOn = (index * 258) - 258,
                endOn   = startOn + 258
            // ignore first 247 chars of Genesis block ... catch chunk's by 258 chars of every block
            let readStream = fs.createReadStream(this.ledgerdir + this.ledgers[this.ledgers.length -1], {
                start: startOn,
                end: endOn,
                highWaterMark: 258,
                encoding: 'utf8'
            })
            // ...
            for await (const chunk of readStream) {
                if ( Number(chunk.substr(0, 13)) === Number(index) ) {
                    readStream.destroy()
                    return chunk
                }
            }
            // prevent
            readStream.destroy()
            return false
        } else {
            return false
        }
    }

    getLastBlock() {
        return this.config.lastBlock
    }

    // @REVISE-...
    getChain(returnStreamOrCallback) {
        // ignore Genesis block ... "highWaterMark" by block chars length (258)
        let readStream = fs.createReadStream(this.ledgerdir + this.ledgers[this.ledgers.length -1], {
            start: 258,
            highWaterMark: 258,
            encoding: 'utf8'
        })
        // ...
        if ( returnStreamOrCallback && UTILS.isStreamObj(returnStreamOrCallback) ) {
            readStream.pipe(returnStreamOrCallback)
        } else if ( returnStreamOrCallback && UTILS.isFunction(returnStreamOrCallback) ) {
            let chain = ''
            readStream.on('data', chunk => {
                chain += chunk
            })
            readStream.on('end', () => {
                returnStreamOrCallback(chain)
            })
        } else {
            readStream.destroy()
        }
    }

    addBlock(block, uuid) {
        try {
            // get size of last ledger
            let fileSize = fs.statSync(this.ledgerdir + this.ledgers[this.ledgers.length -1]).size
            // check if this block + last ledger execed "breakpiece"...
            if ( ((fileSize / 258) +1) > this.breakpiece ) {
                // create new ledger
                fs.writeFileSync(this.ledgerdir + `ledger-${this.ledgers.length +1}.db`, block, {
                    encoding: 'utf8'
                })
                this.ledgers.push(`ledger-${this.ledgers.length +1}.db`)
            } else {
                // append to current "last" ledger
                fs.appendFileSync(this.ledgerdir + this.ledgers[this.ledgers.length -1], block, {
                    encoding: 'utf8'
                })
            }
            this.length = Number(block.substr(0, 13))
            this.config.lastBlock = block

            fs.writeFileSync(this.ledgerdir + 'config.json', JSON.stringify({
                breakpiece: this.breakpiece,
                lastBlock: block,
                length: this.length
            }), {
                encoding: 'utf8'
            })

            return true
        } catch(e) {
            return false
        }
    }

    static BlockLength(path) {
        try {
            return (this.length !== 0) ? this.length : JSON.parse(fs.readFileSync(path + 'config.json', 'utf8')).length
        } catch(e) {
            return 0
        }
    }
}

module.exports = BlockStore