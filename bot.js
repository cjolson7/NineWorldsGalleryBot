require('dotenv').config();
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const {data, helpers} = require('./data.js');
const {artCollector, unspoilerCollector, spoilerCollector} = require('./collectors.js');
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

  //connect to message list file on startup and turn it into a list of discord links
  var untrackedPosts = 0;
  var processed = 0; //counters
  fs.readFile(helpers.filename, async (err, contents) => {if(err) console.log(err);//log error if any
    var cachedLinks = contents.toString().replaceAll("\r","").split("\n");//trim and split to make neat list
      cachedLinks.forEach(async link => {//try each link
      if(data.linkRegex.test(link)){//check if the link parses
        var [cachedMessageId, cachedChannelId] = data.parseLink(link); //parse link
        var cachedChannel;
        try{ cachedChannel = await client.channels.cache.get(cachedChannelId);}catch{return};//get channel or skip
        if(cachedChannel.viewable){//channel should be viewable
          var cachedPost
          try{cachedPost = await cachedChannel.messages.fetch(cachedMessageId);}catch{return};
          if(cachedPost.embeds.length<1 && cachedPost.attachments.size<1 && cachedPost.author.id == process.env.BOTID){
            //should be a bot post without art or embeds that is not in a gallery
            untrackedPosts += 1;
            await cachedPost.edit({content: data.genericEndMessage});
          }
        }
      }
      processed++;//count processed links after all ifs/awaits (tracks whether the loop is done)
      if(processed === cachedLinks.length)  {
        //after processing it all, log the count and dump the file
        console.log(`Edited ${untrackedPosts} untracked ` + (untrackedPosts===1 ? "post" : "posts" + "!"));
        fs.writeFile(helpers.filename, "", (err)=>{if(err) console.log(err);})//log error if any
      }
    })
  })
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

      artMessage.reply(data.artResponseMessage(artMessage.author.id)).then(async (botResponse) => {//send the message, including user reference
          botResponse.react('🇾');
          botResponse.react('🔒');
          botResponse.react('✍️');
          botResponse.react('✅');//bot reacts to its own message with all the emojis

          const collectorFilter = (reaction, user) => {//filter for specific emoji and original poster
            return (reaction.emoji.name === '🇾' || reaction.emoji.name === '🔒' || reaction.emoji.name === '✍️' || reaction.emoji.name === '✅') &&
            	user.id === artMessage.author.id;
          };

          const collector = botResponse.createReactionCollector({ filter: collectorFilter, time: data.day*2, dispose: true}); //bot watches the message for 2 days (unless stopped by ✅)
          collectors = await data.collectorsUp(collectors, botResponse.channelId, botResponse.id, true);//increment active collectors and report

          //send a message when you detect the ✅, record detecting the others
          collector.on('collect', async (reaction, user) => {
            if (!yesDetected && reaction.emoji.name === '🇾') yesDetected=true; //use detector vars to know when they're clicked
            if (!spoilerDetected && reaction.emoji.name === '🔒') spoilerDetected=true;
            if (!victoriaDetected && reaction.emoji.name === '✍️') victoriaDetected=true;
            
            if (!doneDetected && reaction.emoji.name === '✅') {
              doneDetected=true; //this one only reacts the first time and doesn't care if it's removed
              collector.stop();//turn off the collector after it receives this emoji
            }
          });

          collector.on('remove', (reaction, user) => {
            if (yesDetected && reaction.emoji.name === '🇾') yesDetected=false; //toggle detector vars on remove
            if (spoilerDetected && reaction.emoji.name === '🔒') spoilerDetected=false;
            if (victoriaDetected && reaction.emoji.name === '✍️') victoriaDetected=false;
          });
          
          collector.on('end', async (collected, reason) => {//edit instruction message on collector stop
            var editTrackerFile = true; //defaults to true - normal behavior is to edit collector tracker on stop
            var unspoiler = false;//unspoiler defaults to false

            //check unspoiler status (break up status and collector creation to make file tracking possible)
            if(yesDetected && !spoilerDetected){//if they did *not* spoiler (but they did say yes, it doesn't otherwise matter) check if any imagesare spoilered
              const filenames = artMessage.attachments.map((a)=>{return a.url.split('/').pop()}) //array of filenames
              const spoilerFiles = filenames.filter(file => file.includes("SPOILER_")); //subset of array that contains the number that are already spoilered
              if(spoilerFiles.length>0){unspoiler = true;} //spoiler on image even though spoiler not selected - unspoiler condition is flagged, new collector needed
            }                

            //check if there's going to be another collector opening up, for accurate file tracking
            if(spoilerDetected || unspoiler){editTrackerFile = false}//in the two conditions where more clarification is needed, don't remove that post link from the tracking list

            collectors = await data.collectorsDown(collectors, botResponse.channelId, botResponse.id, editTrackerFile);//decrement active collectors on end and report
            //file edit is conditional on spoiler conditions - don't remove the post link if another collector is going to start on the exact same post

            var replaceMessage;
            if(reason === 'time' && !yesDetected){replaceMessage = data.timeout}//edit post on timeout
            else if(reason === 'user' || (reason === 'time' && yesDetected)){//when a user stops the collector, or it times out with yes, post the image and edit the message
              
              var confirmationMessage = data.noMessage; //default response is no 
              var spoilerTag; //needs to exist as blank even when not updated

              if(unspoiler){//unspoiler clarification - initial logical check was earlier

                //edits the prompt and reacts to its own message
                await botResponse.edit({content: data.unspoilerCheck})
                botResponse.react(helpers.yesEmoji); 
                botResponse.react(helpers.noEmoji); 

                //run response collector, return unspoiler and collector tracking (false for initialization)
                [unspoiler, collectors] = await unspoilerCollector(artMessage.author.id, botResponse, collectors, false);
              }
              else if(spoilerDetected){//if they chose spoiler, ask them for a spoiler tag to use
                await botResponse.edit({content: data.spoilerMessage})//edit its message to ask for spoiler text
                botResponse.react('🇳'); //add reaction

                //run response collector, return unspoiler and collector tracking (false for initialization)
                [spoilerTag, collectors] = await spoilerCollector(artMessage.author.id, botResponse, collectors, false);
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
            else{replaceMessage = data.genericEndMessage}//any other reason gets a default response

            await botResponse.edit({content: replaceMessage, embeds: []})//edit its message
          });
        });
      }
    else pingMessage.reply(data.noImageMessage); //report if no images found in either ping message or reply
  }
});