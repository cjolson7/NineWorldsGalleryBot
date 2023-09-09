const {EmbedBuilder } = require('discord.js');
require('dotenv').config();
const data = require('./data.js');

async function postImage(artMessage, postingChannels, spoiler, spoilerTag){

    var messageAttachments = artMessage.attachments.size > 0 ? artMessage.attachments : null; //get the attachments
    if (messageAttachments) {//no need to send something if there is somehow not an image
        
    //get artist id (links post to discord handle and not just artist name)
    artistId = artMessage.author.id;

    //strip @Bot from post content
    var messageContent = artMessage.content.replace(`<@${process.env.BOTID}>`, "");

    const artLink = data.generateLink(
        process.env.GUILDID, 
        artMessage.channel.id, 
        artMessage.id); //create link to original post

        var imageFiles = [];
        messageAttachments.forEach(async attachment => { //prep each image into a file array with spoilers as necessary

            var imageUrl = attachment.url; //get url of actual image
            var filename = (imageUrl.split('/')).pop(); //get the last chunk of the filename as the actual image name
            
            if (spoiler &&  !filename.startsWith("SPOILER_")) filename = "SPOILER_" + filename; //if it needs to be spoilered and isn't already, add the spoilerflag to the filename
            
            imageFiles.push({
                attachment:imageUrl,
                name: filename})//add image to array

        });
        
        //create attachable image and embedded data
        const embed = new EmbedBuilder() //embed posts tagged data, making the gallery entry nice and clean and updatable as needed
            .setColor("#d81b0e")//discord win red
            //.setDescription(messageContent.length > 0 ? messageContent : "Some amazing fanart!")//default description (currently none)
            .addFields(
                { name: "Artist", value: `<@${artistId}>` },//the author's discord id
                { name: "Links", value: `[Original](${artLink})`})
            .setTimestamp(artMessage.createdTimestamp);//timestamp of original post

        //if it's spoilered and spoiler tag exists, update description with it (no default description)
        var messageDescription = (messageContent.length>0)? messageContent : ""//start with message content if sany as description
        if(spoiler && spoilerTag) messageDescription += (messageDescription.length>0)? `\n(${spoilerTag})` : `(${spoilerTag})`//add spoiler tag to description if present
        if(messageDescription.length > 0) embed.setDescription(messageDescription)//describe in embed if there's something here to use

        var artPost = { //combine all the art together for multiple similar sends
            embeds: [embed],   //embed
            files: imageFiles, //image array
        }

        //gallery channel is the default others are added to, it should always be first
        var galleryLink;
        var galleryPost;
        var victoriaLink;
        await postingChannels[0].send(artPost).then(sent => { //make link to posted message
            galleryLink = data.generateLink(process.env.GUILDID, process.env.GALLERYCHANNELID, sent.id)
            galleryPost = sent; //save first post
        });

        if (postingChannels.length>1){//if more than one channel keep going
            var originalLink = embed.data.fields[1].value
            artPost.embeds[0].data.fields[1].value = originalLink +  ` / [Gallery](${galleryLink})`;
            
            await postingChannels[1].send(artPost).then(sent => { //make link
                victoriaLink = data.generateLink(process.env.GUILDID, process.env.VICTORIACHANNELID, sent.id)
                //now edit the original post with this data
                embed.data.fields[1].value = originalLink +  ` / [Victoria's Gallery](${victoriaLink})`;
                galleryPost.edit({ embeds: [embed] });//edit first post
            });
        }
    }

    //return from posting with the correct confirmation message
    postLinks = [galleryLink] //formulate and return post links, incl. victoria if applicable
    if(victoriaLink) postLinks.push(victoriaLink)
    return data.yesMessage(spoiler, postLinks);//formulate the message based on link count / spoilers
}
      
module.exports={postImage};