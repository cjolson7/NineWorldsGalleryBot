require('dotenv').config();
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const {data, helpers} = require('./data.js');
const {artCollector, startCountingCollectors} = require('./collectors.js');
//const postImage = require('./postImage.js').postImage;

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
      // var doneDetected=false;

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