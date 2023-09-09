require('dotenv').config();
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('helper')
		.setDescription('What do I do?'),
	async execute(interaction) {
		await interaction.reply({
			content: 'Hi! My job is to record your art!\n\n'+
			'If you ping me in an image post or in a reply to an image post, I can add that image to my gallery.',
			ephemeral: true
		});
	}
};