const fs = require("fs")
module.exports = {
  cmdHandler: async function(message, bot, perms, no_perms, db, fs, cooldown) {
  var prefix;
    if(!message.guild) {
      prefix = bot.standard.prefix;
    } else {
  await db.fetch(`config_${message.guild.id}`, {target: ".prefix"}).then(i => {
    if(!i) {
      prefix = bot.standard.prefix;
      return;
    }
    prefix = i
  })
    }
    
  if(!message.content.toLowerCase().startsWith(prefix)) return;
  
  let command = message.content.toLowerCase().split(' ')[0].slice(prefix.length);
  let args = message.content.split(' ').slice(1);
  let cmd;

  if (bot.commands.has(command)) {
  cmd = bot.commands.get(command);
  } else if (bot.aliases.has(command)) {
  cmd = bot.commands.get(bot.aliases.get(command));
  }
    
    if(!cmd) return;
    if(cooldown[message.author.id] && perms < 2) return message.reply(`You have to wait 5 seconds to run another command.`)
      cooldown[message.author.id] = {
        time: Date.now()
      }
      setTimeout(() => {
        delete cooldown[message.author.id]
      }, 5000)
      if(perms < cmd.config.permlevel) {
        message.author.send(no_perms).catch(e => message.channel.send(no_perms))
        return;
      }
    if(cmd.config.enabled === false && perms < 10) return message.channel.send(`This command is disabled.`)
    if(cmd.config.guildOnly === true && !message.guild) return message.channel.send(`This command is only available in a server.`)
    cmd.run(bot, message, args)
    console.log(`${cmd.help.name} got runned by ${message.author.tag}`)
  }
}
