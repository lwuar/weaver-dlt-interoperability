import { GluegunCommand } from 'gluegun'
import { getNetworkConfig, commandHelp } from '../../helper/helper'
import { getContractInstance } from '../../helper/besu-functions'
const Web3 = require ("web3")

const command: GluegunCommand = {
	name: 'claim',
	description: 'Claim assets (fungible assets for now)',

	run: async toolbox => {
		const {
			print,
			parameters: { options }
		} = toolbox
		if (options.help || options.h) {
			commandHelp(
				print,
				toolbox,
				`besu-cli asset claim --network=network1 --lock_contract_id=lockContractID --recipient_account=2 --preimage_base64=preimage`,
				'besu-cli asset claim --network=<network1|network2> --lock_contract_id=<lockContractID> --recipient_account=<2|1> --preimage_base64=<preimage>',
				[
					{
						name: '--network',
						description:
							'network for command. <network1|network2>'
					},
					{
						name: '--lock_contract_id',
						description:
							'The address / ID of the lock contract.'
					},
					{
						name: '--recipient_account',
						description:
							'The index of the account of the recipient of the asset from the list obtained through web3.eth.getAccounts(). For example, we can set Alice as accounts[1] and hence value of this parameter for Alice can be 1.'
					},
					{
						name: '--preimage_base64',
						description:
							'The preimage of hash with which the asset was locked with. Input format supported: base64.'
					}
				],
				command,
				['asset', 'claim']
			)
			return
		}
		print.info('Claim assets (fungible assets for now)')

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

		// Receiving the input parameters
		var recipient
		if(options.recipient_account){
			recipient = accounts[options.recipient_account]
		}
		else{
			print.info('Recipient account index not provided. Taking from networkConfig..')
			recipient = accounts[networkConfig.recipientAccountIndex]
		}
		if(!options.lock_contract_id){
			print.error('Lock contract ID not provided.')
			return
		}
		const lockContractId = options.lock_contract_id
		if(!options.preimage_base64){
			print.error('Preimage not provided.')
			return
		}
		const preimage_base64 = options.preimage_base64
		const preimage = Buffer.from(preimage_base64, 'base64')
		console.log('Length of preimage:', preimage.length)	

		console.log('Parameters')
		console.log('networkConfig', networkConfig)
		console.log('Receiver', recipient)
		console.log('Lock Contract ID', lockContractId)
		console.log('Preimage', preimage)

		// Balance of the recipient before claiming
		var recipientBalance = await tokenContract.balanceOf(recipient)
		console.log(`Account balance of the recipient in Network ${options.network} before claiming: ${recipientBalance.toString()}`)

		await interopContract.claimFungibleAsset(lockContractId, preimage, {
			from: recipient,
		}).catch((error) => {
			console.log("claimFungibleAsset threw an error:", error);
		})

		// Balance of the recipient after claiming
		var recipientBalance = await tokenContract.balanceOf(recipient)
		console.log(`Account balance of the recipient in Network ${options.network} after claiming: ${recipientBalance.toString()}`)
	}
}

module.exports = command
