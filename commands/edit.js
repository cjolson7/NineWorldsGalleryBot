require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder, Client } = require('discord.js');

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
		const client = new Client({intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.MessageContent,
			]})
		const channel = client.channels.cache.get(channelId); //get channel
		const post = await channel.messages.fetch(messageId); //get post

		//compare interaction.user.id to author id
		console.log(interaction.user.id)
		console.log(post.embeds[0].fields) //see how it parses
		//I'm sorry, but you can only edit art that you originally posted.
			//return if error!

		//parse title and description
		const title = interaction.options.getString('title') ?? ""; //defaults to empty string
		const description = interaction.options.getString('description') ?? ""; //defaults to empty string
		
		if (title.length<1 && description.length<1) {
			await interaction.reply({//send reply
				content: "I'm sorry, but you do need to give me something to change.",
				ephemeral: true
			});
			return
		} else {
			if(title.length>0){ //change title
				const titleEmbed = new EmbedBuilder()
					.setTitle(title)
				post.edit({ embeds: [titleEmbed] });
			}
			if(description.length>0){// change description
				const descriptionEmbed = new EmbedBuilder()
					.setDescription(description);
				post.edit({ embeds: [descriptionEmbed] });
			}
			await interaction.reply({//send reply
				content: `Alright, how does that look? ${link}`,
				ephemeral: true
			});
		}
	},
};