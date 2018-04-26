const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const Discord = require("discord.js");
const bot = new Discord.Client();
bot.db = require("quick.db");

var config = {
  token: "Your Token",
  developers: [
    "The",
    "developers",
    "ids"
  ],
  owner: "Your id"
}

bot.standard = {
  prefix: "!",
  modLogChannel: "not_set",
  welcomeMessage: "Welcome {user} to {server}! Have a nice stay!",
  joinChannel: "not_set",
  cooldown: 0,
  cmdcooldown: 2500,
  antispam: 0,
  automute: 5,
  automod: 3,
  botcmds: "off",
  commands: ["abuse"],
  blacklisted: [],
  modrole: "Mods",
  adminrole: "Admins"
}

const restapi = express();

bot.mutes = require("./mutes.json")

restapi.use(bodyParser.urlencoded({ extended: true }));

var urlencodedParser = bodyParser.urlencoded({ extended: true });

function genToken(length) {
    let key = ""
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

    for (let i = 0; i < length; i++) {
        key += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return key
  }

let invis = ["blacklisted", "commands"]

restapi.get("/settings/:guild/:token", async function(req, res) {
  let verify = await bot.db.fetch(`verification_${req.params.guild}`);
  if(!verify) {
    verify = {
      code: genToken(7)
    }
    bot.db.set(`verification_${req.params.guild}`, verify)
    res.send(`An error occured. Please try again later.`)
    return;
  }
  if(req.params.token !== verify.code) return res.send(`Invalid session. Please start a new session.`)
  var html='';
  html += "<body>"
  let g = req.params.guild
  html += `<form action='/settings/update/${g}'  method='post' name='form1'>`;
  let entry = await bot.db.fetch(`config_${req.params.guild}`);
  if(!entry) {
    bot.db.set(`config_${req.params.guild}`, bot.standard)
    res.send(`An error occured. Please try again.`)
    return;
  }
  Object.entries(entry).forEach(([key, value]) => {
    if(invis.includes(key)) return;
    html += `${key} : <input type="text" name="${key}" value='${value}'>`
    html += "<br>"
  })
  html += "<input type='submit' value='submit'>";
  html += "</form>";
  html += "</body>";
  res.send(html);
  bot.db.set(`verification_${req.params.guild}`, genToken(7), {target: ".code"})
})

let toparse = ["cmdcooldown", "cooldown", "antispam"]

restapi.post("/settings/update/:guild", function(req, res) {
  bot.db.set(`verification_${req.params.guild}`, genToken(7), {target: ".code"})
  let write = {}
  Object.entries(req.body).forEach(([key, value]) => {
    if(toparse.includes(key)) parseInt(key)
    write[key] = value
  })
  bot.db.set(`config_${req.params.guild}`, write)
  res.send(`Successfully edited the settings.`)
})

//**************************************

const fs = require('fs');
bot.functions = require("./functions.js")
//-- All the required modules that we need to use later on.

let no_perms = "```I am sorry, but you do not have the correct permissions to run this command.```"

bot.commands = new Discord.Collection();
bot.aliases = new Discord.Collection()

bot.reload = command => {
    //This reloads the given command by clearing it from cache
    return new Promise((resolve, reject) => {
            try {
                delete require.cache[require.resolve(`./commands/${command}`)];
    let cmd = require(`./commands/${command}`);
    bot.commands.delete(command);
    bot.aliases.forEach((cmd, alias) => {
        if (cmd === command) bot.aliases.delete(alias);
});
    bot.commands.set(command, cmd);
    cmd.config.aliases.forEach(alias => {
        bot.aliases.set(alias, cmd.help.name);
});
    resolve();
} catch (e) {
        reject(e);
    }
});
};

bot.elevation = async (message) => {
	var permlevel = 0;
	if(!message.guild) {
		permlevel = 0;
	} else {
    bot.fetchUser(message.author.id)
  let modRole = await bot.db.fetch(`config_${message.guild.id}`, {target: 'modrole'});
  let modID = message.guild.roles.find("name", modRole);
  if(modID && message.member.roles.has(modID.id)) permlevel = 2;
  let adminRole = await bot.db.fetch(`config_${message.guild.id}`, {target: 'adminrole'});
  let adminID = message.guild.roles.find("name", adminRole);
  if(adminID && message.member.roles.has(adminID.id)) permlevel = 4;
  if(message.member.hasPermission("ADMINISTRATOR")) permlevel = 6;
	if(message.author.id === message.guild.owner.id) permlevel = 8;
	if(config.developers.includes(message.author.id)) permlevel = 10;
	if(config.owner === message.author.id) permlevel = 100;
}
return permlevel;
}


fs.readdir("./commands/", (err, files) => {
	if(err) console.error(err);

	let jsfiles = files.filter(f => f.split(".").pop() === "js");
	if(jsfiles.length <= 0) {
		console.log("No commands to load!");
		return;
	}

	console.log(`Loading ${jsfiles.length} commands!`);

	jsfiles.forEach((f, i) => {
		let props = require(`./commands/${f}`);
		bot.commands.set(props.help.name, props);
		props.config.aliases.forEach(alias => {
			bot.aliases.set(alias, props.help.name);
		});
	});
});


bot.on("ready", () => {
  console.log(`Online!`)
  bot.user.setActivity(`${bot.standard.prefix}prefix`)
   bot.setInterval(() => {
  for(let i in bot.mutes) {
    let time = bot.mutes[i].time;
    let guildId = bot.mutes[i].guild;
    let guild = bot.guilds.get(guildId);
    if(guild === undefined) continue;
    let member = guild.members.get(i);
    if(member === undefined) continue;
    let mutedRole = guild.roles.find(r => r.name === "Muted");
    if(!mutedRole) continue;

    if(Date.now() > time) {
      console.log(`${i} is now able to be unmuted!`);

      member.removeRole(mutedRole.id);

      delete bot.mutes[i];

      fs.writeFile("./mutes.json", JSON.stringify(bot.mutes, null, 4), err => {
        if(err) throw err;
        console.log(`I have unmuted ${member.user.tag}.`);
      });
    }
  }
}, 5000)
})

let cmdcool = {}

var authors = [];
var warned = [];
var banned = [];
var messagelog = [];
var todelete = [];

var spamconf = {
  warnBuffer: 5,
  maxBuffer: 10,
  warningMessage: "You're sending messages way too quickly. Calm down!",
  banMessage: "Got muted for spamming.",
  maxDuplicatesWarning: 5,
  maxDuplicatesBan: 8
}

bot.on("message", async message => {
  if(message.author.bot) return;
  let perms = await bot.elevation(message)
  
  if(message.content === `${bot.standard.prefix}prefix`) {
    let entry = await bot.db.fetch(`config_${message.guild.id}`);
    if(!entry) {
      message.channel.send(`The set prefix is **${bot.standard.prefix}**. You can view all the commands with **${bot.standard.prefix}help**, or view detailed help on a certain command with **${bot.standard.prefix}help [command]**`)
      bot.db.set(`config_${message.guild.id}`, bot.standard)
    } else {
      message.channel.send(`The set prefix is **${entry.prefix}**. You can view all the commands with **${entry.prefix}help**, or view detailed help on a certain command with **${entry.prefix}help [command]**`)
  }
  }
  
  bot.functions.cmdHandler(message, bot, perms, no_perms, bot.db, fs, cmdcool)
})

bot.on("message", async message => {
  if(!message.guild) return;
  let perms = await bot.elevation(message);
  if(perms > 2) return;
  let thisConf = await bot.db.fetch(`config_${message.guild.id}`);
  var matched;
  if(!thisConf) {
    bot.db.set(`config_${message.guild.id}`, bot.standard)
    return;
  }
  if(perms)
  var now = Date.now()
  authors.push({
    "time": now,
    "author": message.author.id
  })
  messagelog.push({
    "message": message.content,
    "author": message.author.id
  })
  todelete.push({
    "id": message.id,
    "author": message.author.id,
    "time": now
  })

  var msgMatch = 0;

  for(var i = 0; i < messagelog.length; i++) {
    if(messagelog[i].author === message.author.id && messagelog[i].message === message.content) {
      msgMatch++
    }
  }

  setInterval(() => {
    for(var i = 0; i< messagelog.length; i++) {
      if(messagelog[i].author === message.author.id) {
        messagelog.splice(i)
      }
    }
  }, 20000)

  if(msgMatch === spamconf.maxDuplicatesWarning && !warned.includes(message.author.id)) {
    warn(message, message.author.id)
    let messagecount = parseInt(msgMatch, 10)
  message.channel.fetchMessages({ limit: 100 })
  .then(messages => {
    let msgArray = messages.array()
    msgArray = msgArray.filter(m => m.author.id === message.author.id)
    msgArray.length = messagecount + 1
    msgArray.forEach(msg => {
      msg.delete()
    })
  })
  }

  if(msgMatch === spamconf.maxDuplicatesBan && !banned.includes(message.author.id)) {
    ban(message, message.author.id)
    let messagecount = parseInt(msgMatch, 10)
  message.channel.fetchMessages({ limit: 100 })
  .then(messages => {
    let msgArray = messages.array()
    msgArray = msgArray.filter(m => m.author.id === message.author.id)
    msgArray.length = messagecount + 1
    msgArray.forEach(msg => {
      msg.delete()
    })
  })
  }

  matched = 0;

  for (var i = 0; i < authors.length; i++) {
    if(authors[i].time > now - thisConf.antispam && authors[i].author === message.author.id) {
      matched++;
      if(matched === spamconf.warnBuffer && !warned.includes(message.author.id)) {
        warn(message, message.author.id)
      } else if(matched === spamconf.maxBuffer) {
          ban(message, message.author.id)
      }
    } else if(authors[i].time < now - thisConf.antispam && authors[i].author === message.author.id) {
      authors.splice(i);
      warned.splice(warned.indexOf(authors[i]));
      banned.splice(warned.indexOf(authors[i]));
    }
    if(messagelog.length >= 200) {
      messagelog.shift()
    }
  }
})

function warn(message, userid) {
  warned.push(message.author.id);
  message.channel.send(message.author + " " + spamconf.warningMessage);
}

function ban(message, userid) {
  for (var i = 0; i < messagelog.length; i++) {
    if (messagelog[i].author == message.author.id) {
      messagelog.splice(i);
    }
  }

  for(var i = 0; i < authors.length; i++) {
    if(authors[i].author === message.author.id) {
      authors.splice(i)
    }
  }

  for(var i = 0; i < warned.length; i++) {
    if(warned[i] === message.author.id) {
      warned.splice(i)
    }
  }

  banned.push(message.author.id);

  var user = message.channel.guild.members.find(member => member.user.id === message.author.id);

  var role = message.guild.roles.find("name", "Muted")

if(!role) return;
  if (user) {
    user.addRole(role).catch(err => console.error(err))
    message.channel.send(`${message.author} got muted for spamming.`)

    bot.mutes[user.id] = {
      guild: message.guild.id,
      time: Date.now() + 86400000
    }

    fs.writeFile("./mutes.json", JSON.stringify(bot.mutes, null, 4), err => {
      if(err) throw err;
    });
 }
}

bot.on("guildMemberAdd", (member) => {
  let guild = member.guild;
  bot.db.fetch(`config_${guild.id}`).then(i => {
    if(!i) return;
    let channel = bot.channels.get(i.joinChannel);
    if(!channel || channel === undefined) return;
    if(!i.welcomemessage) {
      bot.db.set(`config_${guild.id}`, bot.standard.welcomeMessage, {target: ".welcomemessage"})
      return;
    }
    channel.send(i.welcomemessage.split("{user}").join(member).split("{server}").join(guild.name).split("{username}").join(member.username).split("{usertag}").join(member.user.tag)).catch(e => {
      //lol
    })
  })
})

bot.login(config.token)
