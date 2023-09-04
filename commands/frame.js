const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('greetgbot')
		.setDescription('says hello'),
	async execute(interaction) {
		await interaction.reply('Hi! My job is to record your art!');
	},
};