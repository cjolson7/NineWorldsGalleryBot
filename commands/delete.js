require('dotenv').config();
const { SlashCommandBuilder } = require('discord.js');
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

		[link, channel, post] = galleryLinkErrors(interaction);//check the link/channel and send default gallery link access errors

		//set up cancel buttons
		const confirm = new ButtonBuilder()
			.setCustomId('delete')
			.setLabel('Delete')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(true);

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
		});

		// Response collector for buttons
		const buttonCollector = ephemeralComponentFollowUp.createMessageComponentCollector({ componentType: ComponentType.Button, time: data.day/4 });//6 hr timeout
		buttonCollector.on('collect', async buttonInteration => {

			var buttonInteractionText;
			if (buttonInteration.customId === 'delete') {
				buttonInteractionText = "Okay, I'll delete it right away!";
	
				post.delete();//delete the post
			}
			else if (buttonInteration.customId == 'cancel') {
				buttonInteractionText = "Okay, I won't delete it!";
			}

			await buttonInteration.update({ content: buttonInteractionText, components: [] })//remove buttons and update with comfirm text
		});


	}
};