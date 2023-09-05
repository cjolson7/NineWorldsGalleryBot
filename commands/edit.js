require('dotenv').config();
const moment = require('moment');
const data = require('../data.js');
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
		[messageId, channelId] = data.parseLink(link);

		//channel should be one of the two gallery channels
		const galleryChannels = [process.env.VICTORIACHANNELID,  process.env.GALLERYCHANNELID]
		if(!(galleryChannels.includes(channelId))){
			await interaction.reply({//failure response
				content: "I'm sorry, but I can only edit art that is in my galleries.",
				ephemeral: true
			});
			return //endgit 
		}

		const channel = await interaction.client.channels.cache.get(channelId); //get channel
		const post = await channel.messages.fetch(messageId); //get post  //link error handling needed!

		//poster of the message being edited should be the bot
		if(post.author.id != process.env.BOTID){
			await interaction.reply({//failure response
				content: "I'm sorry, but I can only edit art that I curated.",
				ephemeral: true
			});
			return //end
		}

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

		} else {//actually edit
			const timestamp = moment(embedData.timestamp).valueOf()//parse and convert to unix stamp
			const newEmbed = new EmbedBuilder()//preserve old data
				.setColor(embedData.color)
				.setTimestamp(timestamp)
				.setFields(embedData.fields);

			if(title.length>0){ newEmbed.setTitle(title)} //set title
			else if (embedData.title) {newEmbed.setTitle(embedData.title)}//embed might not have a title, set if it does
			if(description.length>0){newEmbed.setDescription(description);} //set description
			else {newEmbed.setDescription(embedData.description)}

			post.edit({ embeds: [newEmbed] });//edit embed

			//check if there is a crosspost
			const linkField = newEmbed.data.fields.find(f => f.name === "Links").value;
			if(linkField.includes("Gallery")){//Original or Original / (Victoria's) Gallery
				//get the corresponding post from the links
				var crossLink = linkField.split("(").pop();//get link
				console.log(crossLink)
				crossLink = crossLink.replace(")","")//trim end
				console.log(crossLink)
				const [crossMessageId, crossChannelId] = data.parseLink(crossLink);

				const crossChannel = await interaction.client.channels.cache.get(crossChannelId); //get channel
				const crossPost = await crossChannel.messages.fetch(crossMessageId); //get post

				//get links field from crossPost to use in embed 
				const crossLinkData = crossPost.embeds[0].fields.find(f => f.name === "Links").value;	
				newEmbed.data.fields.find(f => f.name === "Links").value = crossLinkData;

				crossPost.edit({ embeds: [newEmbed] });//edit crosspost
			}

			await interaction.reply({//success response
				content: `Alright, how does that look? ${link}`,
				ephemeral: true
			});
		}
	},
};