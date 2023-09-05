const {EmbedBuilder } = require('discord.js');
require('dotenv').config();
const data = require('./data.js');

async function postImage(artMessage, postingChannels, spoiler){

    var messageAttachments = artMessage.attachments.size > 0 ? artMessage.attachments : null; //get the attachments
    if (messageAttachments) {//no need to send something if there is somehow not an image
        messageAttachments.forEach(async attachment => {//for each image post it using its discord url
        
            //get artist id (links post to discord handle and not just artist name)
            artistId = artMessage.author.id;

            //strip @Bot from post content
            var messageContent = artMessage.content.replace(`<@${process.env.BOTID}>`, "");

            //spoiler images - split based on path separator and add SPOILER_ to the last section if it wasn't there already
            var imageUrl = attachment.url;
            //set up for spoilering by getting the image name
            var urlPieces = imageUrl.split('/');//url separator doesn't need os adjustment
            filename = urlPieces.pop();
            if (spoiler && !filename.startsWith("SPOILER_")){// if it needs to be spoilered and isn't already
                filename = "SPOILER_" + filename; }//add spoiler flag to image name

            const artLink = data.generateLink(
                process.env.GUILDID, 
                artMessage.channel.id, 
                artMessage.id); //create link to original post
        
            //create attachable image and embedded data
            const embed = new EmbedBuilder() //embed posts tagged data, making the gallery entry nice and clean and updatable as needed
                .setColor("#d81b0e")//discord win red
                .setDescription(messageContent.length > 0 ? messageContent : "Some amazing fanart!")//posting message of the art or default
                .addFields(
                    { name: "Artist", value: `<@${artistId}>` },//the author's discord id
                    { name: "Links", value: `[Original Post](${artLink})`})
                .setTimestamp(artMessage.createdTimestamp);//timestamp of original post

            //gallery channel is the default others are added to, it should always be first
            await postingChannels[0].send({ //content: "string", //content of the message itself, ie, i'm posting art!
                embeds: [embed],
                files: [{
                    attachment:imageUrl,
                    name: filename}]
            }).then(sent => { //make link to post
                galleryLink = data.generateLink(process.env.GUILDID, process.env.GALLERYCHANNELID, sent.id)
            });

            if (postingChannels.length>1){//if more than one channel keep going
                var links = embed.data.fields[1].value
                links += `/ [Gallery Post](${galleryLink})`;
                embed.data.fields[1].value = links;

                await postingChannels[1].send({ //content: "string", //content of the message itself, ie, i'm posting art!
                    embeds: [embed],
                    files: [{
                        attachment:imageUrl,
                        name: filename}]
                })
            }
        });
    }
}
      
module.exports={postImage};