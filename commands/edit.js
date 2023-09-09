require('dotenv').config();
const moment = require('moment');
const data = require('../data.js');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('edit')
		.setDescription('Fix the title and/or description of one of your posted pieces.')
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
			.setRequired(false))
		.addBooleanOption(option => option.setName('add_images')
			.setDescription('Bot will ask you for more images to add to the post (optional)')
			.setRequired(false))
		.addBooleanOption(option => option.setName('clear_description')
			.setDescription('Remove description from gallery post (optional)')
			.setRequired(false)),
	async execute(interaction) {

		//parse link and channel to get message
		const link = interaction.options.getString('link');

		//i'm sorry, that doesn't seem to be a link
		if(!(link.startsWith("https://discord.com/channels/"))){//not a discord link
		await interaction.reply({//failure response
			content: "I'm sorry, but I don't recognize that link.",
			ephemeral: true
		});
		return //end 
		}

		//parse link and get channel
		[messageId, channelId] = data.parseLink(link);
		const channel = await interaction.client.channels.cache.get(channelId); //get channel

		//link channel should be one it has access to
		if(!channel.viewable){
			await interaction.reply({//failure response
				content: "I'm sorry, but that link goes somewhere I cannot.",
				ephemeral: true
			});
			return //end
		}

		//get post 
		const post = await channel.messages.fetch(messageId);
		
		//get gallery channels
		const galleryChannels = [process.env.VICTORIACHANNELID,  process.env.GALLERYCHANNELID]

		//channel should be a gallery channel and poster should be the bot
		if(post.author.id != process.env.BOTID || !(galleryChannels.includes(channelId))){
			await interaction.reply({//failure response
				content: "I'm sorry, but I can only edit art that I've posted in my galleries.",
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
		const clearDescription = interaction.options.getBoolean('clear_description') ?? false; //defaults to false
		const addImages = interaction.options.getBoolean('add_images') ?? false; //defaults to false
		
		if (title.length<1 && description.length<1 && !clearDescription && !addImages) {
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

			//do nothing if clear description true
			if(description.length>0 && !clearDescription){newEmbed.setDescription(description);} //set description
			else if (!clearDescription) {newEmbed.setDescription(embedData.description)}

			//image request goes here
			if(addImages){channel.send("image request still in progress!")}

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