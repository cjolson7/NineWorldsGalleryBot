const {EmbedBuilder } = require('discord.js');
require('dotenv').config();
const {data, helpers, artLinkRegex} = require('./data.js');

async function postImage(artMessage, postingChannels, spoiler, spoilerTag, unspoiler){

    var messageAttachments = artMessage.attachments.size > 0 ? artMessage.attachments : null; //get the attachments
    //if (messageAttachments) {//no need to send something if there is somehow not an image
        //TODO: fix
    var justLink = false; // boolean for link and not attachmets

    //get artist id (links post to discord handle and not just artist name)
    artistId = artMessage.author.id;

    //strip @Bot from post content
    var messageContent = artMessage.content.replace(`<@${process.env.BOTID}>`, "");

    const originalPostLink = helpers.generateLink(
        process.env.GUILDID, 
        artMessage.channel.id, 
        artMessage.id); //create link to original post

        // if there is no image attachment, it's a link, and that is the art link for the embed (and image array is empty)
        // if there is an image attachment, art
        var imageFiles = [];
        const artLink = messageContent.match(artLinkRegex)[0] //find link if there is one - null if no match, first if multiple
        if (messageAttachments){//if images present, prep spoilered images
            var imageFiles = [];
            messageAttachments.forEach(async attachment => { //prep each image into a file array with spoilers as necessary

                var imageUrl = attachment.url; //get url of actual image
                var filename = (imageUrl.split('/')).pop(); //get the last chunk of the filename as the actual image name

                //there may be ? and parameters in the image url - detect and drop these
                if (filename.includes("?")) filename = filename.replace(/\?.*$/, "")
                
                if (spoiler &&  !filename.startsWith("SPOILER_")) filename = "SPOILER_" + filename; //if it needs to be spoilered and isn't already, add the spoilerflag to the filename
                else if (!spoiler && unspoiler && filename.startsWith("SPOILER_")) filename = filename.replace("SPOILER_", "");//if it needs to be unspoilered, remove "SPOILER_"

                imageFiles.push({
                    attachment:imageUrl,
                    name: filename})//add image to array

            });
        }
        
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

        embed.addFields({ name: "Links", value: `[Original](${originalPostLink})`});//this one looks good if it's last

        const content = artLink ? "[External Link](" + artLink + ")" : null //for a link to embed it needs to be in the message content, no content otherwise

        var artPost = { //combine everything being posted for sending
            embeds: [embed],   //embed
            files: imageFiles, //image array (empty if link)
            content: content
        }

        //gallery channel is the default others are added to, it should always be first
        var galleryLink;
        var galleryPost;
        var videoEmbed;
        var victoriaLink;

        await postingChannels[0].send(artPost).then(sent => { //make link to posted message
            galleryLink = helpers.generateLink(process.env.GUILDID, process.env.GALLERYCHANNELID, sent.id)
            galleryPost = sent; //save first post
        });

        if (postingChannels.length>1){//if more than one channel keep going
            var firstLink = embed.data.fields.find(f => f.name === "Links").value
            artPost.embeds[0].data.fields.find(f => f.name === "Links").value = firstLink +  ` / [Gallery](${galleryLink})`;
            
            await postingChannels[1].send(artPost).then(sent => { //make link
                victoriaLink = helpers.generateLink(process.env.GUILDID, process.env.VICTORIACHANNELID, sent.id)
                //now edit the original post with this data
                embed.data.fields.find(f => f.name === "Links").value = firstLink +  ` / [Victoria's Gallery](${victoriaLink})`;
                galleryPost.edit({ embeds: [embed] });//edit first post
            });
        }
    //}
    //todo: test spoiler and victoria cases with links before pushing!

    //return from posting with the correct confirmation message
    postLinks = [galleryLink] //formulate and return post links, incl. victoria if applicable
    if(victoriaLink) postLinks.push(victoriaLink)
    return data.yesMessage(spoiler, postLinks);//formulate the message based on link count / spoilers
}
      
module.exports={postImage};