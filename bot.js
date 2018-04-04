const { Client, Util } = require('discord.js');
const { TOKEN, PREFIX, GOOGLE_API_KEY } = require('./config');
const ytdl = require('ytdl-core')
const YouTube = require('simple-youtube-api');

const client = new Client({ disableEveryone: true });

const youtube = new YouTube(GOOGLE_API_KEY);

const queue = new Map();

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () => console.log('Estoy listoo!'));

client.on('disconnect', () => console.log('Me desconnecte'));

client.on('reconnecting', () => console.log('Me estoy reconectando'));

client.on('message', async msg => {
    if (msg.author.bot) return undefined;
    if (!msg.content.startsWith(PREFIX)) return undefined;
    const args = msg.content.split(' ');
    const SearchString = args.slice(1).join(' ');
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
    const serverQueue = queue.get(msg.guild.id);
    if(!msg.member.roles.some(r=>["Los Bien Vergas", "Secretarios de los Bien Vergas", "Admins"])) return msg.channel.send('No eres un admin lo siento umu')

    if (msg.content.startsWith(`${PREFIX}play`)) {
        const voiceChannel = msg.member.voiceChannel;
        if(!voiceChannel) return msg.channel.send('Ponte en un canal de Voz!!')
        const permissions = voiceChannel.permissionsFor(msg.client.user);
        if (!permissions.has('CONNECT')) {
            return msg.channel.send('Dame permisos para entrar!!')
        }
        if (!permissions.has('SPEAK')) {
            return msg.channel.send('Dame permisos para hablar!!!')
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try { 
                    var videos = await youtube.searchVideos(SearchString, 1);
                    var video = await youtube.getVideoByID(videos[0].id);
                } catch (err) {
                    console.error(err)
                    return msg.channel.send('No he encontrado ningun resultado.');
                }
            }    

           return handleVideo(video, msg, voiceChannel);
        }
    } else if (msg.content.startsWith(`${PREFIX}skip`)) {
        if (!msg.member.voiceChannel) return msg.channel.send('No estas en un canal de voz!');
        if (!serverQueue) return msg.channel.send('No hay nada para hacer skip');
        msg.channel.send(`Cancion saltada por ${msg.author.username}`)
        serverQueue.connection.dispatcher.end();
        return undefined;
    } else if (msg.content.startsWith(`${PREFIX}stop`)) {
        if (!msg.member.voiceChannel) return msg.channel.send('No estas en un canal de voz!');
        if (!serverQueue) return msg.channel.send('No hay nada para poderme parar');
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
        return undefined;
    }else if (msg.content.startsWith(`${PREFIX}volumen`)) {
        if (!serverQueue) return msg.channel.send('No hay nada reproduciendose.');
        if (!msg.member.voiceChannel) return msg.channel.send('No estas en un canal de voz!');
        if (!args[1]) return msg.channel.send(`El volumen actual es: ${serverQueue.volume}`)
        serverQueue.volume = args[1];
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 100);
        return msg.channel.send(`El volumen fue cambiado a: ${args[1]}`)
    } if (msg.content.startsWith(`${PREFIX}np`)) {
        if (!serverQueue) return msg.channel.send('No hay nada reproduciendose.');
        return msg.channel.send(`Se esta reproduciendo: ${serverQueue.songs[0].titulo}`);
    }else if(msg.content.startsWith(`${PREFIX}queue`)){
        if (!serverQueue) return msg.channel.send('No hay nada reproduciendose.');
        return msg.channel.send(`
_**Lista de Canciones:**_

${serverQueue.songs.map(song => `-${song.titulo}`).join('\n')}
        
**Se esta reproduciendo** ${serverQueue.songs[0].titulo}
        `)
    } else if (msg.content.startsWith(`${PREFIX}pause`)) {
        if (serverQueue && serverQueue.playing) {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return msg.channel.send(`Pausado por ${msg.author.username}`)
        }
        return msg.channel.send('No hay nada reproduciendose')
    } else if (msg.content.startsWith(`${PREFIX}resume`)) {
        if (serverQueue && !serverQueue.playing) {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return msg.channel.send(`Reactivado por ${msg.author.username}`)
        }
        return msg.channel.send('No hay nada reproduciendose')
    }
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
    const serverQueue = queue.get(msg.guild.id);
    const song = {
        id: video.id,
        titulo: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    }
    if (!serverQueue) {
        const queueConstruct = {
            textchannel: msg.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 100,
            playing: true
        };
        queue.set(msg.guild.id, queueConstruct);
    
        queueConstruct.songs.push(song);

        try {
        var connection = await voiceChannel.join();
        queueConstruct.connection = connection;
        play(msg.guild, queueConstruct.songs[0]);
        } catch (error) {
        console.error(`No me pude unir al canal de voz: ${error}`);
        queue.delete(msg.guild.id);
        return msg.channel.send(`No me pude unir al canal de voz ${error}`);
        }
    } else {
        serverQueue.songs.push(song);
        if (playlist) return undefined
        else msg.channel.send(`La cancion ${song.titulo} se añadió a la cola`);    
    }
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if(!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id)
        return;
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
        .on('end', reason => {
            if (reason === 'El reproductor no va lo suficientemente rapido.');
            else console.log(reason);
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on('error', error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 100);

    serverQueue.textchannel.send(`Ahora se esta reproduciendo ${song.titulo}`);
}

client.login(TOKEN);