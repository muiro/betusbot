'use strict';

const config = {
  channels: ['#botzoo'],
  server: 'localhost',
  dbhost: 'localhost',
  dbport: 5984,
  nick: 'betusbot',
  nickpass: 'z:@=W.YL3RKl=ddpFfonm4?>=$3IA&V0vSG3T',
  email: 'muiro@muiro.net',
  admin: 'funslug'
}

const 
  irc = require('irc'),
  logger = require('winston'),
  Q = require('q');


logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {timestamp: true, colorize: true});


var client = new irc.Client(config.server, config.nick, {
  channels: config.channels,
  autoConnect: false,
  userName: config.nick,
  realName: config.nick,
  port: 6667,
  debug: false,
  showErrors: false,
  autoRejoin: true,
  secure: false,
  selfSigned: false,
  certExpired: false,
  floodProtection: false,
  floodProtectionDelay: 1000,
  sasl: false,
  stripColors: false,
  channelPrefixes: "&#",
  messageSplit: 512
});

client.on('error', function(error){
  logger.log('error', "[" + config.nick + "] " + JSON.stringify(error));
});

client.addListener('notice', function (from, to, message) {
  logger.log('info','[' + config.nick + '] from: ' + from + ', to: ' + to + ' ' + message);
  if(message.indexOf("is not a registered nickname") >= 0) {
    logger.log('info','[BGs] nick not registered. Attempting to register now...');
    client.say('nickserv','register ' + config.nickpass + ' ' + config.email);
  }
});

client.addListener('message', function (from, to, message) {
  logger.log('info', '[' + config.nick + '] ' + from + ' => ' + to + ': ' + message);
});

client.addListener('pm', function (from, message) {
  if (from === "funslug" && message === "quit") {
    client.disconnect("Quitting", function() {
      logger.log('info', "[" + config.nick + "] disconnected");
    });
  } else if ((/^regnick /).test(message)) {
    var params = message.split(' ');
    client.say('nickserv','verify register ' + config.nick + ' ' + params[1]);
  }
});


var loadPlugins = function () {
  logger.log('info', "[" + config.nick + "] loading plugins..");
  require('./plugins/users.js')(config, client, logger);
  require('./plugins/bgs.js')(config, client, logger);
}();

client.connect(3, function() {
  logger.log("info","[" + config.nick + "] Connected to server, ready for commands");
  client.say('nickserv','identify ' + config.nickpass);
});




