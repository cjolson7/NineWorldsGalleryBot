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
var collectors = 0;//set collector counter on bot start
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

  if(pingMessage.mentions.has(process.env.BOTID, {ignoreRepliedUser: true, ignoreEveryone: true})){//if bot is mentioned (ignore replies and @here/@everyone)

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

      artMessage.reply(data.artResponseMessage(artMessage.author.id)).then((botResponse) => {//send the message, including user reference
          botResponse.react('🇾');
          botResponse.react('🔒');
          botResponse.react('✍️');
          botResponse.react('✅');//bot reacts to its own message with all the emojis

          const collectorFilter = (reaction, user) => {//filter for specific emoji and original poster
            return (reaction.emoji.name === '🇾' || reaction.emoji.name === '🔒' || reaction.emoji.name === '✍️' || reaction.emoji.name === '✅') &&
            	user.id === artMessage.author.id;
          };

          const collector = botResponse.createReactionCollector({ filter: collectorFilter, time: data.day*2, dispose: true}); //bot watches the message for 2 days (unless stopped by ✅)
          collectors = data.collectorsUp(collectors);//increment active collectors and report

          //send a message when you detect the ✅, record detecting the others
          collector.on('collect', async (reaction, user) => {
            if (!yesDetected && reaction.emoji.name === '🇾') yesDetected=true; //use detector vars to know when they're clicked
            if (!spoilerDetected && reaction.emoji.name === '🔒') spoilerDetected=true;
            if (!victoriaDetected && reaction.emoji.name === '✍️') victoriaDetected=true;
            
            if (!doneDetected && reaction.emoji.name === '✅') {
              doneDetected=true; //this one only reacts the first time and doesn't care if it's removed
              collector.stop();//turn off the collector after it receives this emoji
              collectors = data.collectorsDown(collectors);//decrement active collectors and report
            }
          });

          collector.on('remove', (reaction, user) => {
            if (yesDetected && reaction.emoji.name === '🇾') yesDetected=false; //toggle detector vars on remove
            if (spoilerDetected && reaction.emoji.name === '🔒') spoilerDetected=false;
            if (victoriaDetected && reaction.emoji.name === '✍️') victoriaDetected=false;
          });
          
          collector.on('end', async (collected, reason) => {//edit instruction message on collector stop
            var replaceMessage;
            if(reason === 'time'){replaceMessage = data.timeout}//edit post on timeout
            else if(reason === 'user'){//when a user stops the collector, post the image and edit the message
              
              var confirmationMessage = data.noMessage; //default response is no 
              var spoilerTag; //needs to exist as blank even when not updated
              const timeout = data.day/2 //consistent timeout
              var finished = false;//reuse stopper variable since spoiler cases are contradictory
              var unspoiler = false;//unspoiler defaults to false
            
              if(!spoilerDetected){//if they did *not* spoiler, check if any of the images are spoilered
                const filenames = artMessage.attachments.map((a)=>{return a.url.split('/').pop()}) //array of filenames
                const spoilerFiles = filenames.filter(file => file.includes("SPOILER_")); //subset of array that contains the number that are already spoilered
                if(spoilerFiles.length>0){//if they did not choose spoiler but any of the images have a spoiler
                  const unspoilerFilter = (reaction, user) => {return ((reaction.emoji.name === data.yesEmoji || reaction.emoji.name === data.noEmoji) && user.id === artMessage.author.id)};//filter for emojis by original poster
                  const unspoilerCollector = botResponse.createReactionCollector({ filter: unspoilerFilter, time: timeout, dispose: true}); //bot watches for a reaction
                  collectors = data.collectorsUp(collectors);//increment active collectors and report

                  //edits the prompt and reacts to its own message
                  await botResponse.edit({content: data.unspoilerCheck})
                  botResponse.react(data.yesEmoji); 
                  botResponse.react(data.noEmoji); 

                  unspoilerCollector.on('collect', (reaction) => {//on any collection, detect which then stop and move on - only need one result
                    if(reaction.emoji.name === data.yesEmoji) unspoiler = true;
                    unspoilerCollector.stop();
                    collectors = data.collectorsDown(collectors);//decrement active collectors and report
                    finished = true; //callback flag for bot to move on
                  }) 
                  await data.waitFor(_ => finished === true);//waits for finished to be true, which happectorCountns when collector has gotten an answer and closed
                  }
                }
              else if(spoilerDetected){//if they chose spoiler, ask them for a spoiler tag to use
                await botResponse.edit({content: data.spoilerMessage})//edit its message to ask for spoiler text
                botResponse.react('🇳'); //add reaction
                const noFilter = (reaction, user) => {return (reaction.emoji.name === '🇳' && user.id === artMessage.author.id)};//filter for 🇳 emoji by original poster
                const replyFilter = (message) => {return (artMessage.author.id === message.author.id && message.reference && message.reference.messageId === botResponse.id)};//filter for a reply from the poster
                const replyCollector = botResponse.channel.createMessageCollector({filter: replyFilter, time: timeout, dispose: true, max: 1})//message collector watches for one reply
                const noCollector = botResponse.createReactionCollector({ filter: noFilter, time: timeout, dispose: true}); //bot watches for a message or reaction for half a day (unless stopped early)
                collectors = data.collectorsUp(collectors);//increment active collectors and report

                noCollector.on('collect', () => {
                  noCollector.stop();//stop and move on if the reaction filter collects anything (since it's already filtered down to the one emoji)
                  replyCollector.stop();
                }) //stop reply collector, too

                replyCollector.on('collect', async (replyMessage) => {//change this function, it doesn't like on collect
                  spoilerTag = await replyMessage.content;
                })
                await replyCollector.on('end', ()=>{
                  noCollector.stop() //make sure both collectors stop  
                  collectors = data.collectorsDown(collectors);//decrement active collectors and report
                  finished = true;//when it stops waiting for replies it is done
                })

                await data.waitFor(_ => finished === true);//waits for finished to be true, which happens when collectors have gotten their answers and closed
              }

              //if yes, make the posts!
              if(yesDetected){
                const galleryChannel = client.channels.cache.get(process.env.GALLERYCHANNELID); //get gallery channel
                var postingChannels = [galleryChannel];//gallery is the default
                if(victoriaDetected) {//it it's being used, get other channel from id and add it to the list
                  const victoriaChannel = client.channels.cache.get(process.env.VICTORIACHANNELID); 
                  postingChannels.push(victoriaChannel);
                }
                confirmationMessage = await postImage(artMessage, postingChannels, spoilerDetected, spoilerTag, unspoiler); //post to channels and return links to posts!
              }
              replaceMessage = confirmationMessage//prepare to edit in the message
            }
            else{replaceMessage = data.unknownEndReason}//any other reason gets a default response

            await botResponse.edit({content: replaceMessage, embeds: []})//edit its message
          });
        });
      }
    else pingMessage.reply(data.noImageMessage); //report if no images found in either ping message or reply
  }
});