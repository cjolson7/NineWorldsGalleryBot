const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('helper')
		.setDescription('says hello'),
	async execute(interaction) {
		await interaction.reply('Hi! My job is to record your art!\n\nIf you ping me on an image post, or a reply to an image post, I can add that image to my gallery.');
	},
};