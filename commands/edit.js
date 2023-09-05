require('dotenv').config();
const moment = require('moment');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('edit')
		.setDescription('Fix the title and/or description of one of your posted pieces')
		.addStringOption(option => option.setName('link')
			.setDescription('Discord link to the posted art')
			.setRequired(true))
		.addStringOption(option => option.setName('title')
			.setDescription('New title (optional)')
			.setMinLength(1)
			.setMaxLength(256)
			.setRequired(false))
		.addStringOption(option => option.setName('description')
			.setDescription('New description (optional)')
			.setMinLength(1)
			.setMaxLength(4096)
			.setRequired(false)),
	async execute(interaction) {	

		//parse link and channel to get message
		const link = interaction.options.getString('link');
		
		var fields = link.split('/')//discord links are a series of ids separated by slashes - discord/server/channel/message
		const messageId = fields.pop(); //id is the last field 
		const channelId = fields.pop(); //channel is the next to last

		const channel = await interaction.client.channels.cache.get(channelId); //get channel
		const post = await channel.messages.fetch(messageId); //get post  //link error handling needed!

		var embedData = post.embeds[0].data//original embed data 
		if (!embedData.fields[0].value.includes(interaction.user.id)) {//compare interaction.user.id to author id - only the author in the embed can make the edit
			await interaction.reply({//failure response
				content: "I'm sorry, but you can only edit art that you originally posted.",
				ephemeral: true
			});
			return //end
		}

		//parse title and description
		const title = interaction.options.getString('title') ?? ""; //defaults to empty string
		const description = interaction.options.getString('description') ?? ""; //defaults to empty string
		
		if (title.length<1 && description.length<1) {
			await interaction.reply({//failure response
				content: "I'm sorry, but you do need to give me something to change.",
				ephemeral: true
			});
			return //end
// '2023-09-04T17:04:43.489000+00:00',
		} else {
			console.log(embedData)
			var timestamp = moment(embedData.timestamp).valueOf()//parse, convert to unix stamp then date obj
			console.log(timestamp)
			const newEmbed = new EmbedBuilder()//preserve old data
				.setColor(embedData.color)
				.setTimestamp(timestamp)
				.setAuthor(embedData.author)
				.setFields(embedData.fields[0]);

			if(title.length>0){ newEmbed.setTitle(title)} //set title
			else if (embedData.title) {newEmbed.setTitle(embedData.title)}//embed might not have a title, set if it does
			if(description.length>0){newEmbed.setDescription(description);} //set description
			else {newEmbed.setDescription(embedData.description)}

			console.log(newEmbed)

			post.edit({ embeds: [newEmbed] });//edit embed

			await interaction.reply({//success response
				content: `Alright, how does that look? ${link}`,
				ephemeral: true
			});
		}
	},
};