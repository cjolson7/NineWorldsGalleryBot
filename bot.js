require('dotenv').config();
const { Client, Collection, Events, GatewayIntentBits, } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const data = require('./data.js');
const postImage = require('./postImage.js').postImage;


const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
	],
});

//set up commands on startup
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');//find all the js files in the command subfolder
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	// each command that has the right info is added to the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

client.login(process.env.TOKEN);//start bot

client.on(Events.InteractionCreate, async interaction => {//execute slash commands
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

client.on("ready", () => {//when the bot first logs in
  console.log(`Logged in as ${client.user.tag}!`)
})

client.on("messageCreate", async pingMessage => {//respond to messages where the bot is pinged and there is art

  if(pingMessage.mentions.has(process.env.BOTID)){//if bot is mentioned

    var pingChannel = pingMessage.channel; //the channel it was pinged in
    var repliedTo = pingMessage.reference; //the referenced (replied to) message if any
    var artMessage = pingMessage; //by default, the message being worked on is the one where the bot was pinged

    if (repliedTo){//if there is a reply reference, find the reply message
      const flaggedMessage = await pingChannel.messages.fetch(repliedTo.messageId);
      if (flaggedMessage.attachments.size > 0 && flaggedMessage.author.id!=process.env.BOTID){
        artMessage = flaggedMessage;} //if there is an image in the ref message, and it wasn't posted by this bot, choose that message
    }

    //if there wasn't a reply, or wasn't art in the reply, we're still on the ping message - check for an image again before proceeding
    if (artMessage.attachments.size > 0 && artMessage.author.id!=process.env.BOTID) {

      var yesDetected=false; //set up emoji tracker variables
      var spoilerDetected=false;
      var victoriaDetected=false;
      var doneDetected=false;

      artMessage.reply(data.artResponseMessage).then((botResponse) => {
          botResponse.react('🇾');
          botResponse.react('🔒');
          botResponse.react('✍️');
          botResponse.react('✅');//bot reacts to its own message with all the emojis

          const collectorFilter = (reaction, user) => {//filter for specific emoji and original poster
            return (reaction.emoji.name === '🇾' || reaction.emoji.name === '🔒' || reaction.emoji.name === '✍️' || reaction.emoji.name === '✅') &&
            	user.id === artMessage.author.id;
          };
          const collector = botResponse.createReactionCollector({ filter: collectorFilter, time: data.day, dispose: true}); //bot watches the message for a day (unless stopped by ✅)
          //send a message when you detect the ✅, record detecting the others
          collector.on('collect', async (reaction, user) => {
            if (!yesDetected && reaction.emoji.name === '🇾') yesDetected=true; //use detector vars to know when they're clicked
            if (!spoilerDetected && reaction.emoji.name === '🔒') spoilerDetected=true;
            if (!victoriaDetected && reaction.emoji.name === '✍️') victoriaDetected=true;
            
            if (!doneDetected && reaction.emoji.name === '✅') {
              doneDetected=true; //this one only reacts the first time and doesn't care if it's removed
              collector.stop();//turn off the collector after it receives this emoji
              
              var actualMessage = data.noMessage; //default is no
              if(yesDetected) actualMessage = data.yesMessage(spoilerDetected, victoriaDetected); //formulate yes based on what it's doing
              pingChannel.send(actualMessage); //send confirmation message
              
              //if yes, post the art to all relevant channels!
              if(yesDetected){
                const galleryChannel = client.channels.cache.get(process.env.GALLERYCHANNELID); //get gallery channel
                var postingChannels = [galleryChannel];//gallery is the default
                if(victoriaDetected) {//it it's being used, get other channel from id and add it to the list
                  const victoriaChannel = client.channels.cache.get(process.env.VICTORIACHANNELID); 
                  postingChannels.push(victoriaChannel);
                }
                await postImage(artMessage, postingChannels, spoilerDetected); //post to channels!
              }

            }
          });

          collector.on('remove', (reaction, user) => {
            if (yesDetected && reaction.emoji.name === '🇾') yesDetected=false; //toggle detector vars on remove
            if (spoilerDetected && reaction.emoji.name === '🔒') spoilerDetected=false;
            if (victoriaDetected && reaction.emoji.name === '✍️') victoriaDetected=false;
          });
          
          collector.on('end', collected => {//log count at the end and reset counters
            console.log(`Collected ${collected.size} items`);
          });
        });
      }
    else pingChannel.send(data.noImageMessage); //catch case for no images found in ping message or reply
  }
});