const {EmbedBuilder } = require('discord.js');
require('dotenv').config();
const {data, helpers} = require('./data.js');

async function postImage(artMessage, postingChannels, spoiler, spoilerTag, unspoiler){

    var messageAttachments = artMessage.attachments.size > 0 ? artMessage.attachments : null; //get the attachments
    if (messageAttachments) {//no need to send something if there is somehow not an image
        
    //get artist id (links post to discord handle and not just artist name)
    artistId = artMessage.author.id;

    //strip @Bot from post content
    var messageContent = artMessage.content.replace(`<@${process.env.BOTID}>`, "");

    const artLink = helpers.generateLink(
        process.env.GUILDID, 
        artMessage.channel.id, 
        artMessage.id); //create link to original post

        var imageFiles = [];
        messageAttachments.forEach(async attachment => { //prep each image into a file array with spoilers as necessary

            var imageUrl = attachment.url; //get url of actual image
            var filename = helpers.getFilenameFromLink(imageUrl); //parse filename out of url
            
            if (spoiler &&  !filename.startsWith("SPOILER_")) filename = "SPOILER_" + filename; //if it needs to be spoilered and isn't already, add the spoilerflag to the filename
            else if (!spoiler && unspoiler && filename.startsWith("SPOILER_")) filename = filename.replace("SPOILER_", "");//if it needs to be unspoilered, remove "SPOILER_"

            imageFiles.push({
                attachment:imageUrl,
                name: filename})//add image to array

        });
        
        //create attachable image and embedded data
        const embed = new EmbedBuilder() //embed posts tagged data, making the gallery entry nice and clean and updatable as needed
            .setColor("#d81b0e")//discord win red
            //.setDescription(messageContent.length > 0 ? messageContent : "Some amazing fanart!")//default description (currently none)
            .addFields({ name: "Artist", value: `<@${artistId}>`})//the author's discord id
            .setTimestamp(artMessage.createdTimestamp);//timestamp of original post

        //parse and add description
        var messageDescription = (messageContent.length>0)? messageContent : ""//start with message content if any as description
        if(messageDescription.length > 0) embed.setDescription(messageDescription)//describe in embed if there's something here to use

        //add spoiler tag as field if tag present and spoiler true
        if(spoiler && spoilerTag) embed.addFields({name: data.spoilerField, value: spoilerTag})

        embed.addFields({ name: "Links", value: `[Original](${artLink})`});//this one looks good if it's last

        var artPost = { //combine all the art together for multiple similar sends
            embeds: [embed],   //embed
            files: imageFiles, //image array
        }

        //gallery channel is the default others are added to, it should always be first
        var galleryLink;
        var galleryPost;
        var victoriaLink;
        await postingChannels[0].send(artPost).then(sent => { //make link to posted message
            galleryLink = helpers.generateLink(process.env.GUILDID, process.env.GALLERYCHANNELID, sent.id)
            galleryPost = sent; //save first post
        });

        if (postingChannels.length>1){//if more than one channel keep going
            var originalLink = embed.data.fields.find(f => f.name === "Links").value
            artPost.embeds[0].data.fields.find(f => f.name === "Links").value = originalLink +  ` / [Gallery](${galleryLink})`;
            
            await postingChannels[1].send(artPost).then(sent => { //make link
                victoriaLink = helpers.generateLink(process.env.GUILDID, process.env.VICTORIACHANNELID, sent.id)
                //now edit the original post with this data
                embed.data.fields.find(f => f.name === "Links").value = originalLink +  ` / [Victoria's Gallery](${victoriaLink})`;
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