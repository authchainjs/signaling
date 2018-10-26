/**
 * @copyright Copyright (c) 2018 Lauro Moraes - [https://github.com/subversivo58]
 * @license The MIT License (MIT)             - [https://github.com/authchainjs/signaling/blob/master/LICENSE]
 * @version 0.1.0 [development stage]         - [https://github.com/authchainjs/signaling/blob/master/VERSIONING.md]
 */

const BlockStore = require('../blockstore/')
const UTILS = require('../utils/')
const SHA256 = require('../sha256/')

/**
 * GenesisBlock
 * @type {String} - 244 chars
 * @description:
 *   -- base index
 *      0000000000000 [13 chars for 9999999999999 possible blocks]
 *   -- fake previous hash
 *      816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7
 *   -- data of Genesis
 *      AuthChainJS Genesis Block [By Subversivo58 - https://subversivo58.github.io]
 *   -- Unix Timestamp
 *      1970-01-01T00:00:00Z
 *   -- initial level (difficulty) [max 99]
 *      02
 *   -- nonce for this block "mining" [max 99999]
 *      00032
 *   -- this block hash (result of mining)
 *      00f58b7038feb67f4420d93bf87f6347ccacfe7d36bc0f75532d3166c04dd798
 */
const GenesisBlock = '0000000000000816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7AuthChainJS Genesis Block [By Subversivo58 - https://subversivo58.github.io]1970-01-01T00:00:00Z020082700f58b7038feb67f4420d93bf87f6347ccacfe7d36bc0f75532d3166c04dd798'

const DateAdjust = function() {
    let now = Date.now()
    return new Date(now)
}

// return RAW block
const BlockValidator = (block, last) => {
    //
    if ( UTILS.isString(block) && block.length === 258 ) {
        try {
            // check properties
            let TempBlock = {
                index: block.substr(0, 13),
                previousHash: block.substr(13, 64),
                data: [
                    block.substr(77, 43),
                    block.substr(120, 43)
                ],
                timestamp: block.substr(163, 24),
                level: block.substr(187, 2),
                nonce: block.substr(189, 5)
            }
            // compare
            if ( SHA256.hash(TempBlock) !== block.substr(-64, 64) || TempBlock.previousHash !== last.substr(13, 64) || TempBlock.level !== last.substr(187, 2) || TempBlock.timestamp < last.substr(163, 24) ) {
                return false
            }
            return block
        } catch(e) {
            return false
        }
    } else {
        return false
    }
}

class Block {

    constructor(i, p, d , l = 2) {
        this.index = String(i).padStart(13, 0)
        this.previousHash = p
        this.data = d
        this.timestamp = new DateAdjust()
        this.level = String(l).padStart(2, 0)
        this.nonce = String('0').padStart(5, 0)
        this.mine()
    }

    generateHash() {
        return SHA256.hash(this.index + this.previousHash + JSON.stringify(this.data) + this.timestamp + this.nonce)
    }

    mine() {
        this.hash = this.generateHash()

        while (!(/^0*$/.test(this.hash.substring(0, this.level)))) {
            this.nonce++
            this.nonce = String(this.nonce).padStart(5, 0)
            this.hash = this.generateHash()
        }
    }
}

class Blockchain {

    constructor(firstStart, level, StorageProvider) {
        this.level     = level
        this.genesis   = GenesisBlock
        this.provider  = StorageProvider
        this.ledgers   = []
        this.isfirst   = firstStart
    }

    getLastBlock() {
        return !(this.isfirst) ? this.provider.getLastBlock() : this.genesis
    }

    getChain(StreamOrCallback) {
        this.provider.getChain(StreamOrCallback)
    }

    getBlockByIndex(index) {
        if ( Number(index) === 0 ) {
            return GenesisBlock
        }
        return this.provider.getBlock(index)
    }

    replaceChain(newBlockchain) {
        // unused on server ???
    }

    checkChain(blockchainToValidate) {
        // unused on server???
    }

    // internall
    addBlock(data, uuid) {
        // For internal purpose ... create server Credential for WebRTC
        if ( UTILS.isArray(data) && data.length === 2 && UTILS.isString(data[0]) && UTILS.isString(data[1]) && data[0].length === 43 && data[1].length === 43 ) {
            // ...
            let previousHash = GenesisBlock.substr(-64, 64),
                targetIndex  = 1
            if ( !this.isfirst ) {
                let lastBlock = this.getLastBlock()
                previousHash = lastBlock.substr(-64, 64)
                targetIndex  = Number(lastBlock.substr(0, 13)) +1
            } else {
                this.isfirst = false
            }
            console.log(targetIndex)
            let block = new Block(targetIndex, previousHash, data, this.level)
            // normalize timestamp
            let normalizeTS = JSON.stringify(block.timestamp).replace(/"/g, '')
            // extract pure {String} of block
            let RawBlock = `${block.index+block.previousHash+data[0]+data[1]+normalizeTS+block.level+block.nonce+block.hash}`
            return this.provider.addBlock(RawBlock)
        } else if ( UTILS.isString(data) && data.length === 258 ) {
            // check if block is valid
            let isValid = BlockValidator(data, this.getLastBlock())
            if ( isValid ) {
                return this.provider.addBlock(isValid)
            } else {
                return false
            }
        } else {
            return false
        }
    }
}

const HandlerDefinitionOnStartup = function(config = Object) {
    // extend to default...
    let settings = UTILS.Extend({}, {
        path: './files/ledger/',   // path directory
        level: 2,                  // difficult
        breakpiece: 100000
    }, config)
    let isFirstStartup = true
    // check if storage non stay startup
    if ( BlockStore.BlockLength(settings.path) !== 0 ) {
        isFirstStartup = false
    }
    return new Blockchain(isFirstStartup, settings.level, new BlockStore(settings.path, {
        genesishash: GenesisBlock.substr(-64, 64),
        breakpiece: settings.breakpiece
    }))
}

// initialize handler (gerate "Genesis Block")
module.exports = HandlerDefinitionOnStartup

/**
 * 13 chars length of "index", allow you to represent "9999999999999":
 * Nine trillion, nine hundred and ninety-nine billion, nine hundred and ninety-nine million, nine hundred and ninety-nine thousand,
 * nine hundred and ninety-nine
 *
 * Fixed block chars length is 258, this represent 258 bytes of allocated space in file (or memory)
 * This measure number of blocks and current required spaces:
 *
 * 1x             -> 258 (258b)[bytes]
 * 1000x          -> 258000 (258kb)[kilobytes]
 * 1000000x       -> 258000000 (258mb)[megabytes]
 * 1000000000x    -> 258000000000 (258gb)[gigabytes]
 * 9999999999999x -> 2579999999999742 (2,579999999999742055pb)[petabytes]
 *
 * ...
 *
 * 100000 users (blocks) cost 25,8mb of space ... maybe here is a good point to divide the ledger, creating a new file on the disk and, by this measure successively
 */