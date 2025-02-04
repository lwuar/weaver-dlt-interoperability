import { GluegunCommand } from 'gluegun'
import { getNetworkConfig, commandHelp } from '../../helper/helper'
import { getContractInstance } from '../../helper/besu-functions'
const Web3 = require ("web3")
const crypto = require('crypto')

const command: GluegunCommand = {
	name: 'lock',
 	description: 'Lock assets (fungible assets for now)',

	run: async toolbox => {
		const {
			print,
			parameters: { options }
		} = toolbox
		if (options.help || options.h) {
			commandHelp(
				print,
				toolbox,
				`besu-cli asset lock --network=network1 --sender_account=1 --recipient_account=2 --amount=5 --timeout=1000`,
				'besu-cli asset lock --network=<network1|network2> --sender_account=<1|2> --recipient_account=<2|1> --amount=<lock-amount> --timeout=<lock-duration-seconds> --hash=<hashLock-optional-parameter>',
				[
					{
						name: '--network',
						description:
							'network for command. <network1|network2>'
					},
					{
						name: '--sender_account',
						description:
							'The index of the account of the sender/owner of the asset from the list obtained through web3.eth.getAccounts(). For example, we can set Alice as accounts[1] and hence value of this parameter for Alice can be 1.'
					},
					{
						name: '--recipient_account',
						description:
							'The index of the account of the recipient of the asset from the list obtained through web3.eth.getAccounts(). For example, we can set Alice as accounts[1] and hence value of this parameter for Alice can be 1.'
					},
					{
						name: '--amount',
						description:
							'The amount of fungible assets to be locked from the sender account specified on the network'
					},
					{
						name: '--timeout',
						description:
							'Time in seconds for which the asset will be locked. The asset will be locked till Date.now() + the timeout provided'
					},
					{
						name: '--hash_base64',
						description:
							'The hash value with which the asset will be locked i.e., providing its pre-image will enable unlocking the asset. This is an optional parameter. If not provided, we will generate a fresh hash pair with a randomly generated pre-image and output the corresponding pre-image.'
					}
				],
				command,
				['asset', 'lock']
			)
			return
		}
		print.info('Lock assets (fungible assets for now)')

		// Retrieving networkConfig
		if(!options.network){
			print.error('Network ID not provided.')
			return
		}
		const networkConfig = getNetworkConfig(options.network)
		const provider = new Web3.providers.HttpProvider('http://'+networkConfig.networkHost+':'+networkConfig.networkPort)
		const web3N = new Web3(provider)
		const interopContract = await getContractInstance(provider, networkConfig.interopContract).catch(function () {
			console.log("Failed getting interopContract!");
		})
		const tokenContract = await getContractInstance(provider, networkConfig.tokenContract).catch(function () {
			console.log("Failed getting tokenContract!");
		})
		const accounts = await web3N.eth.getAccounts()

		// Receving the input parameters
		if(!options.amount){
			print.error('Amount not provided.')
			return
		}
		const amount = options.amount
		var sender
		if(options.sender_account){
			sender = accounts[options.sender_account]
		}
		else{
			print.info('Sender account index not provided. Taking from networkConfig..')
			sender = accounts[networkConfig.senderAccountIndex]
		}
		var recipient
		if(options.recipient_account){
			recipient = accounts[options.recipient_account]
		}
		else{
			print.info('Recipient account index not provided. Taking from networkConfig..')
			recipient = accounts[networkConfig.recipientAccountIndex]
		}
		if(!options.timeout){
			print.error('Timeout not provided.')
			return
		}
		const timeLock = Math.floor(Date.now() / 1000) + options.timeout
		// The hash input has to be dealt with care. The smart contracts take in bytes as input. But the cli takes in strings as input. So to handle that, we take in the hash in its base64 version as input and then obtain the byte array from this. If a hash is not provided, we generate a base 64 encoding and then generate its corresponding byte array from it. This byte array will be input to generate the hash. 
		var hash
		var preimage
		var hash_base64
		var preimage_base64
		if(options.hash_base64){
			hash_base64 = options.hash_base64
		}
		else{
			// Generate a hash pair if not provided as an input parameter
			preimage_base64 = crypto.randomBytes(32).toString('base64')
			preimage = Buffer.from(preimage_base64, 'base64')
			hash_base64 = crypto.createHash('sha256').update(preimage).digest('base64')
		}
		hash = Buffer.from(hash_base64, 'base64')
		
		console.log('Parameters:')
		console.log('networkConfig', networkConfig)
		console.log('Sender', sender)
		console.log('Receiver', recipient)
		console.log('Amount', options.amount)
		console.log('Timeout', timeLock)
		console.log('Hash (base64): ', hash_base64)
		console.log('Preimage (base64): ', preimage_base64)

		// Balances of sender and receiver before locking
		console.log(`Account balances before locking`)
		var senderBalance = await tokenContract.balanceOf(sender)
		console.log(`Account balance of the sender in Network ${options.network}: ${senderBalance.toString()}`)
		var recipientBalance = await tokenContract.balanceOf(recipient)
		console.log(`Account balance of the recipient in Network ${options.network}: ${recipientBalance.toString()}`)

		// Locking the asset (works only for ERC20 at this point)
		await tokenContract.approve(interopContract.address, amount, {from: sender}).catch(function () {
			console.log("Token approval failed!!!");
		})
		const lockTx = await interopContract.lockFungibleAsset(
			recipient,
			tokenContract.address,
			amount,
			hash,
			timeLock,
			{
				from: sender
			}
		).catch(function () {
			console.log("lockFungibleAsset threw an error");
		})
		const lockContractId = lockTx.logs[0].args.lockContractId
		console.log(`Lock contract ID: ${lockContractId}`)

		// Balances of sender and receiver after locking
		console.log(`Account balances after locking`)
		var senderBalance = await tokenContract.balanceOf(sender)
		console.log(`Account balance of the sender in Network ${options.network}: ${senderBalance.toString()}`)
		var recipientBalance = await tokenContract.balanceOf(recipient)
		console.log(`Account balance of the recipient in Network ${options.network}: ${recipientBalance.toString()}`)
	}
}

module.exports = command
