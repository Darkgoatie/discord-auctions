// Import Discord modules

const { Client, Intents, MessageEmbed, Permissions } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { AuctionManager } = require('../../src/index.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

// Import mongoDB URI and token from ./config.json
const { CMDclientId, CMDguildId, mongodbURI, token } = require('./config.json');
const mongoose = require('mongoose');

// Create client
const client = new Client({ intents: [ Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES ] });

// Log when the client is ready
client.once('ready', () => {
	console.log('Ready!');
});

// Create DB
mongoose.connect(mongodbURI);
const db = mongoose.connection;

// Check the connection
db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', () => {
	console.log('Connected to MongoDB.');
});

// Create the mongoose schema
const auctionSchema = new mongoose.Schema({
	guildId: String,
	channelId: String,
	bidLimit: Number,
	hostedBy: String,
	item: String,
	price: Number,
	startedAt: Number,
	winner: String
});

// Create the mongoose model
const auctionModel = mongoose.model('auctions', auctionSchema);

// Add database functions to AuctionManager

const AuctionManagerWithMongoose = class extends AuctionManager {
	async getAllAuctions() {
		const all = await auctionModel.find().lean().exec();
		return this.promise(all);
	}

	async saveAuction(auc) {
		await auctionModel.create(auc);
		return this.promise(true);
	}

	async deleteAuction(guildId, channelId) {
		await auctionModel.deleteOne({ guildId, channelId });
		return this.promise(true);
	}

	async editAuction(guildId, channelId, updatedAuction) {
		await auctionModel.updateOne({ guildId, channelId }, updatedAuction);
		return this.promise(updatedAuction);
	}

	async hasAuction(guildId, channelId) {
		const auc = await auctionModel.findOne({ guildId, channelId }).exec();
		if (!auc) {
			return false;
		} else {
			return true;
		}
	}
};

// Create auction manager
const manager = new AuctionManagerWithMongoose();

client.on('interactionCreate', async (int) => {
	if (!int.isCommand()) return;
	if (int.commandName == 'start') {
		if (!int.member.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES))
			return int.reply({
				ephemeral: true,
				content: 'You need `MANAGE_MESSAGES` permissions to use that command!'
			});
		if ((await manager.exists(int.guild.id, int.channel.id)) == true)
			return int.reply({
				ephemeral: true,
				content: 'There is already an active auction in this channel!'
			});
		const price = int.options.getInteger('price');
		const item = int.options.getString('item');
		const auc = await manager.start({
			channelId: int.channel.id,
			guildId: int.guild.id,
			item: item,
			price: price,
			hostedBy: int.user.id
		});
		int.reply({
			embeds: [
				new MessageEmbed()
					.setColor('RANDOM')
					.setTitle('Auction started')
					.addField('item', item.toString(), true)
					.addField('Starting bid', price.toString(), true)
			]
		});
	} else if (int.commandName == 'bid') {
		if (!await manager.exists(int.guild.id, int.channel.id))
			return int.reply({
				ephemeral: true,
				content: 'There is no active auction in this channel!'
			});
		const amount = int.options.getInteger('amount');
		const auc = await manager.fetch(int.guild.id, int.channel.id);
		auc
			.bid(amount, int.user.id)
			.then(async () => {
				await int.reply({
					embeds: [
						new MessageEmbed()
							.setColor('RANDOM')
							.setTitle('New Bid!')
							.addField('item', auc.item, true)
							.addField(`user`, `${int.user.tag}`, true)
							.addField('amount', auc.price.toString(), true)
					]
				});
			})
			.catch((err) => int.reply({ ephemeral: true, content: err }));
	} else if (int.commandName == 'end') {
		if (!int.member.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES))
			return int.reply({
				ephemeral: true,
				content: 'You need `MANAGE_MESSAGES` permissions to use that command!'
			});
		if (!await manager.exists(int.guild.id, int.channel.id))
			return int.reply({
				ephemeral: true,
				content: 'There is no active auction in this channel!'
			});
		const auc = await manager.fetch(int.guild.id, int.channel.id);
		await int.reply({
			embeds: [
				new MessageEmbed()
					.setColor('RANDOM')
					.setTitle('Auction ended!')
					.addField('item', auc.item, true)
					.addField('ended at price', auc.price.toString(), true)
					.addField('won by', auc.winner.length == 0 ? 'NOBODY' : `<@${auc.winner}>`, true)
					.addField('amount', auc.price.toString(), true)
			]
		});
		await auc.delete();
	}
});

// Login to Discord with your client's token
client.login(token);

const commands = [
	new SlashCommandBuilder()
		.setName('start')
		.setDescription('Starts an auction')
		.addIntegerOption((opt) =>
			opt.setName('price').setDescription('The starting bid of the auction.').setRequired(true)
		)
		.addStringOption((opt) => opt.setName('item').setDescription('The item to be auctioned.').setRequired(true)),
	new SlashCommandBuilder()
		.setName('bid')
		.setDescription('Bids to an auction')
		.addIntegerOption((opt) =>
			opt.setName('amount').setDescription("The Amount you're bidding to the auction").setRequired(true)
		),
	new SlashCommandBuilder().setName('end').setDescription('Ends an auction')
];
commands.map((command) => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(Routes.applicationGuildCommands(CMDclientId, CMDguildId), { body: commands });

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})();
