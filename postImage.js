const {EmbedBuilder } = require('discord.js');
require('dotenv').config();
const data = require('./data.js');

async function postImage(artMessage, postingChannels, spoiler){

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
        messageAttachments.forEach(async attachment => {//prep each image into a file array with spoilers as necessary

            //spoiler images - split based on path separator and add SPOILER_ to the last section if it wasn't there already
            var imageUrl = attachment.url;
            //set up for spoilering by getting the image name
            var filename = (imageUrl.split('/')).pop();//url separator doesn't need os adjustment and only last chunk is needed
            
            if (spoiler && !filename.startsWith("SPOILER_")){// if it needs to be spoilered and isn't already
                filename = "SPOILER_" + filename; }//add spoiler flag to image name
            
            imageFiles.push({
                attachment:imageUrl,
                name: filename})//add image to array
        });
        
        //create attachable image and embedded data
        const embed = new EmbedBuilder() //embed posts tagged data, making the gallery entry nice and clean and updatable as needed
            .setColor("#d81b0e")//discord win red
            .setDescription(messageContent.length > 0 ? messageContent : "Some amazing fanart!")//posting message of the art or default
            .addFields(
                { name: "Artist", value: `<@${artistId}>` },//the author's discord id
                { name: "Links", value: `[Original](${artLink})`})
            .setTimestamp(artMessage.createdTimestamp);//timestamp of original post

        var artPost = { //combine all the art together for multiple similar sends
            embeds: [embed],   //embed
            files: imageFiles, //image array
        }

        //gallery channel is the default others are added to, it should always be first
        var galleryLink;
        var galleryPost;
        await postingChannels[0].send(artPost).then(sent => { //make link to posted message
            galleryLink = data.generateLink(process.env.GUILDID, process.env.GALLERYCHANNELID, sent.id)
            galleryPost = sent; //save first post
        });

        if (postingChannels.length>1){//if more than one channel keep going
            var originalLink = embed.data.fields[1].value
            artPost.embeds[0].data.fields[1].value = originalLink +  ` / [Gallery](${galleryLink})`;
            
            await postingChannels[1].send(artPost).then(sent => { //make link
                const victoriaLink = data.generateLink(process.env.GUILDID, process.env.VICTORIACHANNELID, sent.id)
                //now edit the original post with this data
                embed.data.fields[1].value = originalLink +  ` / [Victoria's Gallery](${victoriaLink})`;
                galleryPost.edit({ embeds: [embed] });//edit first post
            });
        }
    }
}
      
module.exports={postImage};