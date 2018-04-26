exports.run = (bot, message) => {
  message.channel.send(`Pong!`)
}

exports.help = {
  name: "ping",
  description: "Check if the bot is online or not.",
  usage: "ping"
}

exports.config = {
  enabled: true,
  guildOnly: false,
  permlevel: 0,
  aliases: []
}
