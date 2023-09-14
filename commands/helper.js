require('dotenv').config();
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('helper')
		.setDescription('What do I do?'),
	async execute(interaction) {
		await interaction.reply({//initial message
			content: 'Hi! My job is to record your art!\n\n'+
			"If you ping me in an image post or in a reply to an image post, I can add that image to my gallery.\n\n",
			ephemeral: true
		});

		//generate explanation text
		const followupText = "You can click the buttons to learn more about how I work, or click Done.";
		const doneText = "Alright! Call me if you need me!";
		const editText = "If you call '/edit' and give me a link to one of your art posts in either of my galleries, I can fix it for you! "+
			"Currently I can change or remove titles, descriptions, and spoiler tags. Note that remove and change are different - I have text inputs for new info, and True/False inputs for just removing it."+
			"If the piece is posted in both galleries, I will fix both posts (I do this using the links!). "+
			"I can only edit my posts in my galleries, and only when /edit is called by the original artist credited in the gallery post.";
		const deleteText = "If you call '/delete' and give me a link to one of your art posts in one of my galleries, I can remove it for you! "+
			`Currently, I remove any crossposted posts in both galleries, so if you accidentally shared it with Victoria, you'll need to repost it in <#${process.env.GALLERYCHANNELID}>`;
		const spoilerText = "Sometimes I need clarification about what people want me to do with spoilers, to make sure my gallery is as well organized as possible. "+
			"If you don't ask me to spoiler an image but it's spoilered in the original post, I'll offer to remove the spoiler. This won't change anything else about the image. "+
			"If you do ask me to spoiler an image, I'll ask you to reply to me with a spoiler tag. Spoilers are more much helpful when people have info about when they're safe to click!"
		const timeoutText = "When I post a response to an artist, I watch the emojis on that post for 48 hours or until I get a ✅ from the artist. "+
			"If I don't have a 🇾 from the artist after 48 hours, I don't post anything. If I *do* get a 🇾 but the artist never clicks ✅, I post the art when I finish waiting."+
			"If I need clarification about spoiler tags or unspoilering, I'll wait for 12 hours after asking and then post as-is if they didn't tell me anything more. " +
			"I edit posts once I'm done watching them so that no one gets confused. Currently I lose track of any posts I was watching if I go down for maintenance, but I edit them all when I come back up!";
		const userText = "I check discord user ids when I respond to art, and when I make gallery posts. Only the original poster of an image can consent for me to post it or ask me to edit or delete it. "+
			"(The mods can always delete things, of course.) If someone else replies to or reacts to me when I'm waiting on the artist, I'll just ignore them.";

		//set up array of explanations and buttonids for easy iteration (done is a special case and does not need to be in here)
		const buttonData = [{id:'edit', content: editText}, {id:'delete', content: deleteText}, {id:'spoiler', content: spoilerText}, {id:'timeout', content: timeoutText}, {id:'userid', content: userText}]

		//set up buttons
		const doneButton = new ButtonBuilder()
			.setCustomId('done')
			.setLabel('done')
			.setStyle(ButtonStyle.Primary);

		const editButton = new ButtonBuilder()
			.setCustomId(buttonData[0].id)
			.setLabel('/edit')
			.setStyle(ButtonStyle.Secondary)

		const deleteButton = new ButtonBuilder()
			.setCustomId(buttonData[1].id)
			.setLabel('/delete')
			.setStyle(ButtonStyle.Secondary);

		const spoilerButton = new ButtonBuilder()
			.setCustomId(buttonData[2].id)
			.setLabel('spoilers')
			.setStyle(ButtonStyle.Secondary);

		const timeoutButton = new ButtonBuilder()
			.setCustomId(buttonData[3].id)
			.setLabel('timeouts')
			.setStyle(ButtonStyle.Secondary);

		const userButton = new ButtonBuilder()
			.setCustomId(buttonData[4].id)
			.setLabel('user ids')
			.setStyle(ButtonStyle.Secondary);


		const buttonRow = new ActionRowBuilder()
			.addComponents(doneButton, editButton, deleteButton, userButton, spoilerButton, timeoutButton);

		await interaction.reply({
			content: followupText,
			components: [buttonRow],
			ephemeral: true
		}).then((sent)=>{
			const buttonCollector = sent.createMessageComponentCollector({ time: data.ephemeralTimeout*2 });//60 min timeout
			buttonCollector.on('collect', async buttonInteraction => {
	
				var buttonInteractionText;
				if (buttonInteraction.customId === 'done') {
					await buttonInteraction.update({ content: doneText, components: [] })//remove buttons and update with comfirm text
					return //end
				}
				else {
					buttonData.forEach(async (button)=>{//iterate through buttons
							if (buttonInteraction.customId === button.id) {//check each id, act on the matching one
								await buttonInteraction.update({ content: button.content })//update with text, do not remove buttons
							}
						})
					}
				});
				
			});
	
		}
	};