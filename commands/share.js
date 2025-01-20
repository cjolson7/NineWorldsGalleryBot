require('dotenv').config();
const moment = require('moment');
const {data, helpers} = require('../data.js');
const galleryLinkErrors = require('../galleryLinkErrors.js').galleryLinkErrors;
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('share')
		.setDescription("Take a post that is only in the main gallery and share it to Victoria's gallery")
		.addStringOption(option => option.setName('link')
			.setDescription('Discord link to the posted art (required)')
			.setMinLength(1)
			.setRequired(true)),
	async execute(interaction) {

		var galleryLink, galleryPost; //generate data from link
		try{
			[galleryLink, galleryPost] = await galleryLinkErrors(interaction, "share")//verify valid link that bot is allowed to edit
		}catch(error){return};//error message handled above, if error do not continue
		
		//verify that the link is valid to share
		var [messageId, channelId] = data.parseLink(galleryLink);

		//must be specifically gallery channel
		if(channelId != process.env.GALLERYCHANNELID){
			await interaction.reply({//failure response
				content: `I'm sorry, but I can only share art that was posted in my main gallery.`,
				ephemeral: true
			});
			return //end
		}
	
		//post must not already have a victoria link
		if (galleryPost.embeds[0].data.fields.find(f => f.name === "Links").value.includes("Victoria")) {
			await interaction.reply({//failure response
				content: `I'm sorry, but it looks like this piece was already shared with Victoria!`,
				ephemeral: true
			});
			return //end
		}  

		//if not returned for error, ask them to confirm
		//set up cancel buttons
		const confirm = new ButtonBuilder()
			.setCustomId('share')
			.setLabel('Share With Victoria')
			.setStyle(ButtonStyle.Primary)

		const cancel = new ButtonBuilder()
			.setCustomId('cancel')
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Secondary);

		const buttonRow = new ActionRowBuilder()
			.addComponents(confirm, cancel);

		await interaction.reply({
			content: `Are you sure that you want to share [this post](${galleryLink}) to Victoria's gallery?`,
			components: [buttonRow],
			ephemeral: true
		}).then((sent)=>{
			const buttonCollector = sent.createMessageComponentCollector({ time: data.ephemeralTimeout });//30 min timeout
			buttonCollector.on('collect', async buttonInteraction => { 

				var buttonInteractionText;

				if (buttonInteraction.customId === 'cancel') {
					buttonInteractionText = "Alright, I won't share it!"
				}
				else if (buttonInteraction.customId === 'share') {

					var embedData = galleryPost.embeds[0].data //get original embed data
					const timestamp = moment(embedData.timestamp).valueOf()//parse and convert to unix stamp for reuse

					const newEmbed = new EmbedBuilder() //preserve old data in embed format
						.setColor(embedData.color)
						.setTimestamp(timestamp)
						.setFields(embedData.fields)

					//save description if one was present
					if (embedData.description) newEmbed.setDescription(embedData.description)

					//update links for new post
					var originalLinks = embedData.fields.find(f => f.name === "Links" ).value;
					const originalAndGalleryLinks = originalLinks+ ` / [Gallery](${galleryLink})`;

					newEmbed.data.fields.find(f => f.name === "Links").value = originalAndGalleryLinks; //add links

					//preserve images
					var attachments = galleryPost.attachments;
					imageFiles = [] 
					attachments.forEach(async image => {
						imageUrl = image.url,
						filename = helpers.getFilenameFromLink(imageUrl)
						imageFiles.push({
								attachment: imageUrl,  
							name: filename
						})
					});

					//find victoria's gallery channel 
					var victoriaLink
					const victoriaChannel = await interaction.client.channels.cache.get(process.env.VICTORIACHANNELID);

					//post to channel and get link
					await victoriaChannel.send({
						embeds: [newEmbed],
						files: imageFiles,
					}).then(sent => {
						victoriaLink = helpers.generateLink(process.env.GUILDID, process.env.VICTORIACHANNELID, sent.id)
					})

					//format links
					var originalAndNewLinks = originalLinks+ ` / [Victoria's Gallery](${victoriaLink})`;
					
					//edit old post with link
					newEmbed.data.fields.find(f => f.name === "Links").value = originalAndNewLinks;
					galleryPost.edit({ embeds: [newEmbed] });

					buttonInteractionText = `Alright, how does that look? ${victoriaLink}`;
				}
				await buttonInteraction.update({ content: buttonInteractionText, components: [] })//remove buttons and update with comfirm text
			});
				
		}); 
	}
}