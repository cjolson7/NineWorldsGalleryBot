require('dotenv').config();
const {data, helpers} = require('./data.js');

const mainTimeout = data.day*2;//timeouts for collectors - 48 hours for initial ping, 12 hours for clarification
const clarificationTimeout = 10000//data.day/2

const artCollector = async ()=>{
}

const unspoilerCollector = async (artistId, botResponse, collectors, reinitialize)=>{
    var finished = false;//stopper variable for secondary collector waiting
    var unspoiler = false; //default is *not* to unspoiler

    if(reinitialize){//check emoji on reinitialize - collector may not be needed
        console.log("checking existing emoji")
    }

    collectors = await data.collectorsUp(collectors, botResponse.channelId, botResponse.id, false);//increment active collectors and report (don't add to file for clarification collector)

    const unspoilerFilter = (reaction, user) => {return ((reaction.emoji.name === helpers.yesEmoji || reaction.emoji.name === helpers.noEmoji) && user.id === artistId)};//filter for emojis by original poster
    const unspoilerCollector = botResponse.createReactionCollector({ filter: unspoilerFilter, time: clarificationTimeout, dispose: true}); //bot watches for a reaction

    unspoilerCollector.on('collect', (reaction) => {//on any collection, detect which then stop and move on - only need one result
        if(reaction.emoji.name === helpers.yesEmoji) unspoiler = true;
        unspoilerCollector.stop();
        finished = true; //callback flag for bot to move on
    });
                
    unspoilerCollector.on('end', async ()=>{collectors = await data.collectorsDown(collectors, botResponse.channelId, botResponse.id, true);});//decrement active collectors and report (edit file, no longer tracking post)                 
                
    await data.waitFor(_ => finished === true);//waits for finished to be true, which happens when collector has gotten an answer and close

    return [unspoiler, collectors];
}

const spoilerCollector = async (artistId, botResponse, collectors, reinitialize)=>{
    //takes in the art post's author, the bot's response message, collector tracker, and whether this is a new collector or a reinitialization

    var finished = false;//stopper variable for secondary collector waiting

    if(reinitialize){//check emoji on reinitialize - collector may not be needed
        console.log("checking existing emoji")
    }

    const noFilter = (reaction, user) => {return (reaction.emoji.name === '🇳' && user.id === artistId)};//filter for 🇳 emoji by original poster
    const replyFilter = (reply) => {return (artistId === reply.author.id && reply.reference && reply.reference.messageId === botResponse.id)};//filter for a reply from the poster to the bot
    const replyCollector = botResponse.channel.createMessageCollector({filter: replyFilter, time: clarificationTimeout, dispose: true, max: 1})//message collector watches for just the first applicable reply
    const noCollector = botResponse.createReactionCollector({ filter: noFilter, time: clarificationTimeout, dispose: true}); //reaction collector watches for a 🇳
    collectors = await data.collectorsUp(collectors, botResponse.channelId, botResponse.id, false);//increment active collectors and report (don't add to file for clarification collector)
    var spoilerTag;

    noCollector.on('collect', () => {
        noCollector.stop();//stop and move on if the reaction filter collects anything (since it's already filtered down to the one emoji)
        replyCollector.stop();
    }) //stop reply collector, too

    replyCollector.on('collect', async (replyMessage) => {//collect reply message if one is detected
        spoilerTag = await replyMessage.content;
    })
    await replyCollector.on('end', async ()=>{
        noCollector.stop() //make sure both collectors stop  
        collectors = await data.collectorsDown(collectors, botResponse.channelId, botResponse.id, true);//decrement active collectors and report (edit file, no longer tracking post)
        finished = true;//when it stops waiting for replies it is done
    })

    await data.waitFor(_ => finished === true);//waits for finished to be true, which happens when collectors have gotten their answers and closed

    return [spoilerTag, collectors];//return spoiler tag for use in posting, collectors for tracking
}

module.exports = {artCollector, unspoilerCollector, spoilerCollector};