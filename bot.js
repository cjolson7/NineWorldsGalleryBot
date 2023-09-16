require('dotenv').config();
const { Client, Collection, Events, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const {data, helpers} = require('./data.js');
const {artCollector, startCountingCollectors, unspoilerCollector} = require('./collectors.js');
//const postImage = require('./postImage.js').postImage;

const client = new Client({//set up basic context with relevant action permissions
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
	],
  partials: [
    Partials.Message, 
    Partials.Channel, 
    Partials.Reaction],
});

//set up commands on startup
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');//find all the js files in the command subfolder
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {//initialize each command 
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	// each command that has the right info is added to the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

startCountingCollectors();//set collector counter on bot start
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
          try{cachedPost = await cachedChannel.messages.fetch(cachedMessageId);}catch{return};//get message or skip
          //should be a bot post without art or embeds that is not in a gallery
          if(cachedPost.embeds.length<1 && cachedPost.attachments.size<1 && cachedPost.author.id == process.env.BOTID){
            const repliedTo = cachedPost.reference; //reference to the replied to message (cached post should be a bot reply to art)
            if (repliedTo){//check that the reference exists
              var artMessage;
              try{artMessage = await cachedChannel.messages.fetch(repliedTo.messageId);}catch{return}//get referenced message or skip
              if (artMessage.attachments.size > 0 && artMessage.author.id!=process.env.BOTID){//check that the reference message has art and is not by the bot
                
                var stillEdit = true;//TEMP

                //use the content of the bot's post to determine its status
                if(cachedPost.content===data.artResponseMessage(artMessage.author.id)) {console.log("untracked post is main message")
                }
                else if(cachedPost.content===data.spoilerMessage) {console.log("untracked post is spoiler message")
                }
                else if(cachedPost.content===data.unspoilerCheck) {
                  console.log("untracked post is unspoiler message")
                  stillEdit = false;
                  unspoilerCollector(artMessage.author.id, cachedPost, true)
                }
                
                if(stillEdit)await cachedPost.edit({content: data.genericEndMessage});//edit post with unwatched message (this is the part that will be replaced)

                untrackedPosts += 1; //count post as being acted on
              }
            }
          }
        }
      }
      processed++;//count processed links after all ifs/awaits (tracks whether the loop is done)
      if(processed === cachedLinks.length)  {
        //after processing it all, log the count and dump the file
        console.log(`Restarted monitoring of ${untrackedPosts} ` + (untrackedPosts===1 ? "post" : "posts" + "!"));
        fs.writeFile(helpers.filename, "", (err)=>{if(err) console.log(err);})//log error if any
      }
    })
  })
})

client.on("messageCreate", async pingMessage => {//respond to messages where the bot is pinged and there is art

  if(pingMessage.mentions.has(process.env.BOTID, {ignoreRepliedUser: true, ignoreEveryone: true})){//if bot is mentioned (ignore replies and @here/@everyone)

    const pingChannel = pingMessage.channel; //the channel it was pinged in
    const repliedTo = pingMessage.reference; //the referenced (replied to) message if any
    var artMessage = pingMessage; //by default, the message being worked on is the one where the bot was pinged

    if (repliedTo){//if there is a reply reference, find the reply message
      const flaggedMessage = await pingChannel.messages.fetch(repliedTo.messageId);
      if (flaggedMessage.attachments.size > 0 && flaggedMessage.author.id!=process.env.BOTID){
        artMessage = flaggedMessage;} //if there is an image in the ref message, and it wasn't posted by this bot, choose that message
    }

    //if there wasn't a reply, or wasn't art in the reply, we're still on the ping message - check image and author again before proceeding
    if (artMessage.attachments.size > 0 && artMessage.author.id!=process.env.BOTID) {

      artMessage.reply(data.artResponseMessage(artMessage.author.id)).then(async (botResponse) => {//send the message, including user reference
          botResponse.react('🇾');
          botResponse.react('🔒');
          botResponse.react('✍️');
          botResponse.react('✅');//bot reacts to its own message with all the emojis

          //initialize collector (the function will post, it doesn't need data return but does need client context)
          artCollector(client, artMessage, botResponse, false);
        });
      }
    else pingMessage.reply(data.noImageMessage); //report if no images found in either ping message or reply
  }
});