const db = require('quick.db');

class Auction {
	/**
	 * @constructor
	 * @param {Object} options
	 * @param {string} options.channelId - The ID of the auction channel.
	 * @param {string} options.guildId - The ID of the auction guild.
	 * @param {string} options.item - The Item/Prize of the auction.
	 * @param {number} options.price - The Price of the auction.
	 * @param {string} [options.hostedBy] - The Hoster/Manager of the auction.
	 * @param {number} [options.startedAt] - The date the auction is started at.
	 * @param {string} [options.winner] - The winner of the auction.
	 * @param {number} [options.bidLimit] - The bid limit of the auction.
	 * @param {AuctionManager} manager - The Manager of the auction.
	 */
	constructor(options, manager) {
		const { channelId, guildId, item, price, hostedBy, startedAt, winner, bidLimit } = options;
		if (!(typeof channelId == 'string')) throw 'ChannelID is not instance of String!';
		/**
		 * The ChannelID of the auction.
		 * @member {string}
		 */
		this.channelId = channelId;

		if (!(typeof guildId == 'string')) throw 'GuildID is not instance of String!';
		/**
		 * The GuildID of the auction.
		 * @member {string}
		 */
		this.guildId = guildId;

		if (!(typeof item == 'string')) throw 'Item is not instance of String!';
		/**
		 * The item of the auction.
		 * @member {string}
		 */
		this.item = item;

		if (!(typeof price == 'number')) throw 'Price is not instance of Number!';
		if (price < 0) throw 'Price is not instance of String!';
		/**
		 * The Price of the auction.
		 * @member
		 */
		this.price = price;

		if (hostedBy != undefined) {
			if (!(typeof hostedBy == 'string')) throw 'HostedBy is not instance of String!';
			/**
			 * The ID of the host/manager of the auction.
			 * @member {string}
			 */
			this.hostedBy = hostedBy;
		}

		/**
		 * The Date that the auction is started at.
		 * @member {number}
		 */
		this.startedAt = startedAt == undefined ? Date.now() : startedAt;

		/**
		 * The Manager the auction belongs to.
		 * @member {AuctionManager}
		 */
		this.manager = manager;

		/**
		 * The WinnerID of the auction, if there's no winner this value will be set to blank string.
		 * @member {string}
		 */
		this.winner = winner == undefined ? '' : winner;

		/**
		 * The Bid Limit of the auction.
		 * @member {number}
		 */
		this.bidLimit = 0;
	}

	/**
	 * Saves edits on the auction.
	 */
	async save() {
		await this.manager.editAuction(this.guildId, this.channelId, this);
	}

	/**
	 * Deletes the auction.
	 */
	async delete() {
		await this.manager.deleteAuction(this.guildId, this.channelId);
	}

	/**
	 * @param {number} price - The new bid on the auction
	 * @param {string} user - The Person who bid on the auction
	 */
	async bid(price, user) {
		if (this.price >= price) throw 'Bid amount is lower than current bid!';
		if (this.price + this.bidLimit >= price) throw 'Bid amount does not pass the bid limit!';
		this.price = price;
		this.winner = user;
	}

	/**
	 * Sets a new winner to the auction.
	 * @param {string} user - The new winner to the auction.
	 */
	async setWinner(user) {
		this.winner = user;
	}

	/**
	 * Sets a new price to the auction.
	 * @param {number} price - The new price of the auction.
	 */
	async setPrice(price) {
		this.price = price;
	}

	/**
	 * Sets a new bid limit to the auction.
	 * @param {number} bidLimit - The new bid limit of the auction.
	 */
	async setBidLimit(bidLimit) {
		this.bidLimit = bidLimit;
	}

	/**
	 * Sets a new item to the auction.
	 * @param {string} item - The new item of the auction.
	 */
	async setItem(item) {
		this.item = item;
	}

	/**
	 * @returns {number} - How much the auction lasted in milliseconds
	 */
	async auctionLength() {
		return Date.now() - this.startedAt;
	}
}

class AuctionManager {
	/**
	 * @constructor
	 * @param {Object} managerOptions - The options of the manager
	 */
	constructor() {
		this.db = new db.table('auctions');
	}

	/**
	 * @method
	 * @private
	 * @param {Auction} auction - The Auction to set in the database.
	 * @returns {Promise<Auction>}
	 */
	async createAuction(auction) {
		this.db.set(`${auction.guildId}/${auction.channelId}`, auction);
		return this.promise(auction);
	}

	/**
	 * @method
	 * @private
	 * @param {string} guildId - The Guild ID of the auction to fetch.
	 * @param {string} channelId - The Channel ID of the auction to fetch.
	 * @returns {Promise<Auction>}
	 */
	async getAuction(guildId, channelId) {
		return this.promise(this.db.get(`${guildId}/${channelId}`));
	}

	/**
	 * @method
	 * @private
	 * @param {string} guildId - The Guild ID of the auction to delete.
	 * @param {string} channelId - The Channel ID of the auction to delete.
	 * @returns {Promise<undefined>} 
	 */
	async deleteAuction(guildId, channelId) {
		this.db.delete(`${guildId}/${channelId}`);
		return this.promise(undefined);
	}

	/**
	 * @private
	 * @returns {Promise<string[]>}
	 */
	async getAllAuctions() {
		return this.promise(this.db.all().map((vrbl) => vrbl.data));
	}

	/**
	 * @method
	 * @private
	 * @param {string} guildId - The Guild ID of the auction to edit.
	 * @param {string} channelId - The Channel ID of the auction to edit.
	 * @param {Auction} updatedAuction - The auction to replace the current auction with.
	 * @returns {Promise<Auction>}
	 */
	async editAuction(guildId, channelId, updatedAuction) {
		this.db.set(`${guildId}/${channelId}`, updatedAuction);
		return this.promise(updatedAuction);
	}

	/**
	 * @param {Object} auctionStartOptions
	 * @param {string} auctionStartOptions.item - The item to auction.
	 * @param {string} auctionStartOptions.price - The starting price of the auction.
	 * @param {string} auctionStartOptions.channelId - The channel id to start the auction in.
	 * @param {string} auctionStartOptions.guildId - The guild id to start the auction in.
	 * @param {string} [auctionStartOptions.hostedBy] - The user who started the auction
	 * @returns {Promise<Auction>} - The Auction that was started
	 */
	async start(auctionStartOptions) {
		const { item, price, channelId, guildId, hostedBy } = auctionStartOptions;
		const aucToStart = new Auction({ item, price, hostedBy, guildId, channelId }, this);
		await this.createAuction(aucToStart);
		return this.promise(aucToStart);
	}

	/**
	 * @param {string} guildId - The guild ID of the auction.
	 * @param {string} channelId - The channel ID of the auction.
	 * @returns {Promise<Auction>}
	 */
	async fetch(guildId, channelId) {
		if (!await this.exists(guildId, channelId)) return undefined;
		const fetched = await this.getAuction(guildId, channelId);
		return this.promise(
			new Auction(
				{
					channelId,
					guildId,
					item: fetched.item,
					hostedBy: fetched.hostedBy,
					price: fetched.price,
					bidLimit: fetched.bidLimit,
					startedAt: fetched.startedAt,
					winner: fetched.winner
				},
				this
			)
		);
	}

	/**
	 * Fetches all auctions
	 * @returns {Promise<Auction[]>}
	 */
	async fetchAll() {
		let aucs = await this.getAllAuctions();
		aucs = aucs.map((val) => JSON.parse(val));
		aucs.map(
			(auc) =>
				new Auction(
					{
						channelId: auc,
						guildId,
						item: fetched.item,
						hostedBy: fetched.hostedBy,
						price: fetched.price,
						bidLimit: fetched.bidLimit,
						startedAt: fetched.startedAt,
						winner: fetched.winner
					},
					this
				)
		);

		return this.promise(aucs);
	}

	/**
	 * 
	 * @param {string} guildId 
	 * @param {string} channelId  
	 * @returns {boolean}
	 * @private
	 */
	async hasAuction(guildId, channelId) {
		return this.promise(this.db.has(`${guildId}/${channelId}`));
	}

	/**
	 * 
	 * @param {string} guildId - The guild ID of the auction
	 * @param {string} channelId - The channel ID of the auction
	 * @returns {Promise<boolean>}
	 */
	async exists(guildId, channelId) {
		return this.promise(this.hasAuction(guildId, channelId));
	}

	/**	
	 * @method
	 * @private
	 */
	promise(data) {
		return new Promise((resolve) => {
			resolve(data);
		});
	}
}

module.exports = {
	AuctionManager
};
