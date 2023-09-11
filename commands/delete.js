require('dotenv').config();
const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const {data} = require('../data.js');
const galleryLinkErrors = require('../galleryLinkErrors.js').galleryLinkErrors;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('delete')
		.setDescription('Removes one of your posts from my gallery')
		.addStringOption(option => option.setName('link')
			.setDescription('Discord link to the posted art (required)')
			.setMinLength(1)
			.setRequired(true)),
	async execute(interaction) {

		var link, channel, post; //generate data from link
		try{
			[link, channel, post] = await galleryLinkErrors(interaction)//try to go parse the link - link is in the interaction data
		}catch(error){return};//if it can't get the data out then there was an error handled in the initial interaction and this is done

		//set up cancel buttons
		const confirm = new ButtonBuilder()
			.setCustomId('delete')
			.setLabel('Delete')
			.setStyle(ButtonStyle.Primary)

		const cancel = new ButtonBuilder()
			.setCustomId('cancel')
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Secondary);

		const buttonRow = new ActionRowBuilder()
			.addComponents(cancel, confirm);

		await interaction.reply({
			content: `Are you sure that you want to delete [this post?](${link})`,
			components: [buttonRow],
			ephemeral: true
		}).then((sent)=>{
			const buttonCollector = sent.createMessageComponentCollector({ time: data.ephemeralTimeout });//30 min timeout
			buttonCollector.on('collect', async buttonInteration => {
	
				var buttonInteractionText;
				if (buttonInteration.customId === 'delete') {
					buttonInteractionText = "Okay, I've deleted it!";
					await post.delete();//delete the post
				}
				else if (buttonInteration.customId == 'cancel') {
					buttonInteractionText = "Okay, I won't delete it!";
				}
	
				await buttonInteration.update({ content: buttonInteractionText, components: [] })//remove buttons and update with comfirm text
			});
	
	
		})
	}
};