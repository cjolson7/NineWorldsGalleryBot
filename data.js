const helpers = {
    yesEmoji:"👍",
    noEmoji:"👎",
    collectorTracker: (verb, collectors)=>{
        console.log(`Collector ${verb}. I am currently monitoring ${collectors} collectors.`);
        return collectors;
    },
    hour: 1000*60*60,//hour in milliseconds
}
  
const data = {
    artResponseMessage: (artistId) => {return "Hi, <@" + artistId + ">! It looks like you posted some art! Please react with 🇾 if you want me to put it in my gallery. (You can edit it there later if you'd like.)\n\n" +
    	"You can use 🔒 to tell me to spoiler it when I post it. If you add ✍️, I\'ll share it with Victoria as well.\n\n" +
    	"When you're done reacting, or if you don't want me to post, please click ✅ to tell me to move on."},
    noMessage: "Okay, I won't post this image to the gallery. Thanks for telling me!",
    noImageMessage: "Sorry, I don't see any images there for me to record.",
    yesMessage: (spoiler, links)=>{ //posting message is dependent on the spoiler toggle and post links
        var yesMessage = "Okay, your image is posted to "; //basic text
        if(postLinks.length>1){yesMessage+=`[both](<${links[0]}>) [galleries](<${links[1]}>)`}
        else{yesMessage+=`the [gallery](<${links[0]}>)`} //one or both post links
        if (spoiler) yesMessage += ". I made sure to spoiler it"; //extension
        yesMessage +=". If you need to fix things later, you can always use /edit!"; //end
        return yesMessage; 
    },
    unspoilerCheck: "You didn't say to add spoilers, but at least one image here is already spoilered. Would you like me to post your art with all image spoilers removed?\n\n"+
        `Please tell me ${helpers.yesEmoji} or ${helpers.noEmoji}`,
    spoilerMessage: "Do you want to add a spoiler tag to the gallery post? You can reply to this post with the spoiler tag.\n\n"+
        "If you use 🇳 (or ignore me long enough), I'll move on without a tag.",
    spoilerField:"Spoiler Tag",//don't change this one, field names should be stable!
    timeout: "I've timed out, so I won't take responses here. Call me again if you need me!",
    unknownEndReason: "I am no longer watching this message. Call me again if you need me!",
    day: 24*helpers.hour,//24 hours
    ephemeralTimeout: helpers.hour/2, //half an hour
    linkRegex: /^https:\/\/discord.com\/channels\/\d*\/\d*\/\d*/,
    generateLink: (guild, channel, message)=>{
        return ["https://discord.com/channels",
            guild,
            channel,
            message].join("/"); //discord links have a standard format
        },
    parseLink: (link)=>{
        var fields = link.split('/')//discord links are a series of ids separated by slashes - discord/server/channel/message
        const messageId = fields.pop(); //id is the last field 
        const channelId = fields.pop(); //channel is the next to last
        return [messageId, channelId];
        },
    waitFor: (condition)=>{//conditional waiting function, doesn't move on until it detects its condition
        const poll = resolve => {
        if(condition()) resolve();
        else setTimeout(_ => poll(resolve), 200);//checks every 200 ms
        }
        return new Promise(poll)
        },
    collectorsUp: (collectors)=>{ return helpers.collectorTracker("activated", collectors+1); },
    collectorsDown: (collectors)=>{ return helpers.collectorTracker("stopped", collectors-1); },
}


module.exports = {data, helpers};