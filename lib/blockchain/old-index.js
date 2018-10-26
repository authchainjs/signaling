/**
 * @copyright Copyright (c) 2018 Lauro Moraes - [https://github.com/subversivo58]
 * @license The MIT License (MIT)             - [https://github.com/authchainjs/signaling/blob/master/LICENSE]
 * @version 0.1.0 [development stage]         - [https://github.com/authchainjs/signaling/blob/master/VERSIONING.md]
 */

const EventEmitter = require('events')
const BlockStore = require('../blockstore/')
const UTILS = require('../utils/')
const Store = require('../store/')
const SHA256 = require('../sha256/')

const Storage = new Store({
    path: './security/',
    fileName: 'blockchain',
    defaults: []
})


/**
 *
 */
class Block {
    constructor(i = '0000000000000', p = "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7"/*"0"*/, d = 'AuthChainJS Genesis Block [By Subversivo58 - https://subversivo58.github.io]', l = 2, restartedBackBone = false) {
        if ( restartedBackBone ) {
            let lastBlock = restartedBackBone[restartedBackBone.length -1]
            //console.log(lastBlock)
            this.i = (lastBlock.i.length === 13) ? lastBlock.i : new Error('Failed "block index length"') // check index.length === 13
            this.p = lastBlock.h
            this.d = lastBlock.d
            this.t = (this.i === '0000000000000') ? new Date(1465154705) : new Date()
            this.l = lastBlock.l
            this.n = (lastBlock.n.length === 5) ? lastBlock.n : new Error('Failed "block nonce length"')
            this.h = lastBlock.h
        } else {
            this.i = String(i).padStart(13, 0)
            this.p = p
            this.d = d
            this.t = (this.i === '0000000000000') ? new Date(1465154705) : new Date()
            this.l = l
            this.n = String('0').padStart(5, 0)
            this.mine()
        }
    }

    generateHash() {
        return SHA256.hash(this.i + this.p + JSON.stringify(this.d) + this.t + this.n)
    }

    mine() {
        this.h = this.generateHash()

        while (!(/^0*$/.test(this.h.substring(0, this.l)))) {
            this.n++
            this.n = String(this.n).padStart(5, 0)
            this.h = this.generateHash()
        }
    }
}


class Blockchain {
    constructor(storedchain = false, l = 2) {
        this.blocks = [new Block()]
        this.i = String(1).padStart(13, 0)
        this.l = l

        if ( storedchain && this.replaceChain(storedchain) ) {
            this.i = String(this.getLastBlock().i +1).padStart(13, 0)
        }
    }

    getLastBlock() {
        return this.blocks[this.blocks.length - 1]
    }

    getChain() {
        return this.blocks
    }

    getBlockByIndex(index) {
        return this.getChain()[index]
    }

    replaceChain(newBlockchain) {
        if ( newBlockchain.length <= this.blocks.length ) {
            console.log('new chain is minor or equal actual blocks length')
            return false
        }
        if ( this.checkChain(newBlockchain) ) {
            console.log('new chain is valid')
            this.blocks = [new Block(false, false, false, false, newBlockchain)]
            return true
        }
        console.log('new chain is invalid')
        return false
    }

    checkChain(blockchainToValidate) {
        if ( JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(this.blocks[0]) ) {
            return false
        }
        // @todo -> check block-by-block
        return true
    }

    addBlock(data) {
        const index = this.i
        const level = this.l
        const previousHash = this.getLastBlock().h
        const block = new Block(index, previousHash, data, level)
        this.i++
        this.i = String(this.i).padStart(13, 0)
        this.blocks.push(block)
        // add to fixed chain
        Storage.set(block)
        return this.getLastBlock()
    }

    isValid() {
        for (let i = 1; i < this.blocks.length; i++) {
            const currentBlock = this.blocks[i]
            const previousBlock = this.blocks[i - 1]

            if (currentBlock.h !== currentBlock.generateHash()) {
                return false
            }

            if (currentBlock.i !== String(previousBlock.i + 1).padStart(13, 0)) {
                return false
            }

            if (currentBlock.p !== previousBlock.h) {
                return false
            }
        }
        return true
    }
}


const HandlerDefinitionOnStartup = () => {
    if ( Store.length() === 0 ) {
        let HandlerInitiator = new Blockchain(false, 2)
        // add Genesis Block to `master-chain.json` file
        Storage.set(HandlerInitiator.getChain()[0])
        // istance
        return HandlerInitiator
    } else {
        // case server refresh (restarted) load `master-chain.json` file to replace memory chain
        return new Blockchain(Storage.getAll(), 2)
    }
}


// initialize handler (gerate "Genesis Block")
module.exports = HandlerDefinitionOnStartup()