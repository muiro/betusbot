'use strict';

const 
  request = require('request'),
  Q = require('q');

var bg_memory = [];

let 
  users = null,
  bot_config = null,
  bot_logger = null;

module.exports = function(config, client, logger, users_module) {
  logger.log('info', "[BGs] plugin init");
  users = users_module;
  bot_config = config;
  bot_logger = logger;

  Q.nfcall(request.get, 'http://' +  config.dbhost + ':' + config.dbport + '/users')
    .then(function(args) {
      if (args[0].statusCode === 404) {
        //create database
        logger.log('info', "[BGs] users database not found. Creating now.");
        return Q.nfcall(request.put, 'http://' + config.dbhost + ':' + config.dbport + '/users');
      } else {
        return args[0];
      }
    })
    .then(function(args) {
      return Q.nfcall(request.get, 'http://' +  config.dbhost + ':' + config.dbport + '/bgs');
    })
    .then(function(args) {
      if (args[0].statusCode === 404) {
        //create database
        logger.log("info", "[BGs] bgs database not found. Creating now.");
        return Q.nfcall(request.put, 'http://' + config.dbhost + ':' + config.dbport + '/bgs');
      } else {
        return args[0];
      }
    })
    .then(function(args) {
      logger.log("info", "[BGs] All DB's good, adding listeners for bg commands");    
      client.addListener('message', function(from, to, message){listener(from, to, message, client);});
    })
    .catch(function(err) {
      logger.log("error", "[BGs] problem accessing or creating database. Check configs. Error code: " + err.code);
    })
  .done();

}


function listener(from, to, message, client) {
  var params = message.split(" ");
  if ((/^!bg /).test(message) || !isNaN(params[0])) { 
    bg(from, to, message, client);
  } else if ((/^!bgoops /).test(message)) {

  } else if ((/^!bgoptin/).test(message)) {
    bgoptin(from, to, message, client);
  } else if ((/^!bgoptout /).test(message)) {
    bgoptout(from, to, message, client);
  } else if ((/^!last /).test(message) || (/^!lastbgs /).test(message)) {
    
  } else if ((/^!esta1c /).test(message) || (/^!ea1c /).test(message)) {
    
  } else if ((/^!estbg /).test(message) || (/^!eag /).test(message) || (/^!ebg /).test(message)) {
    
  } else if ((/^!disclaimer /).test(message)) {
    
  }
}

function bg(from, to, message, client) {

  var user = users.getUser(from);

  // needs to pass usage data if incomplete
  var params = message.split(" ");
  var bg_value = 0;
  if ((/^!bg/).test(message)) {
    if (!isNaN(params[1])) {
      bg_value = params[1];
    }
  } else if (!isNaN(params[0])) {
    bg_value = params[0];
  }

  if (bg_value != 0) {
    var converted = "";
    if(bg_value <= 18) {
      converted = bg_value + " mmol/L = " + (bg_value * 18.0182).toFixed(0) + " mg/dL.";
    } else {
      converted = bg_value + " mg/dL = " + (bg_value / 18.0182).toFixed(1) + " mmol/L.";
    }
    if (to.indexOf("#") >= 0) {
      client.say(to, converted);
    } else {
      client.say(from, converted);
    }

    var date = new Date();
    bg_memory.push({date: date.toJSON(), user: from, bg: bg_value}); 
    while (bg_memory.length > 50) {
      bg_memory.shift();
    }

    if (user.username != "") {
      //saveBG(from, user, bg, date);
    }


  }
}

function bgoptin(from, to, message, client) {
  let params = message.split(" ");

  let user = users.getUser(from);

  let usage = "bgoptin <count> {days|entries}";

  if (!isNaN(params[1]) && (params[2] == "days" || params[2] == "entries") ) {

    if (user.username != "" && user.username != null && user.username != undefined) {
      Q.nfcall(request.get, 'http://' +  bot_config.dbhost + ':' + bot_config.dbport + '/users/' + user.username)
      .then(function(args){
        if (args[0].statusCode === 200) {
          var this_user = JSON.parse(args[1]);
          this_user.bgoptin = true;
          this_user.bgcount = params[1];
          this_user.bgunits = params[2];
          var options = {
            method: "PUT",
            url: 'http://' +  bot_config.dbhost + ':' + bot_config.dbport + '/users/' + user.username,
            json: this_user
          };
          return Q.nfcall(request, options);
        } else {
          throw args;
        }
      })
      .then(function(args){
        if (args[0].statusCode === 201) {
          client.say(from, "BGs will be logged for " + params[1] + " " + params[2]);
        } else {
          throw args;
        }
      })
      .catch(function(err) {
        client.say(from, "Could not update your BG settings.");
        bot_logger.log("error", "[BGs] bgoptin problem  " + err.code);
      })
      .done();
    } else {
      client.say(from, "Please identify or register first.");
    }

  } else {
    client.say(from, usage);
  }

}

function saveBG(from, user, bg, date) {
  Q.nfcall(request.get, 'http://' +  bot_config.dbhost + ':' + bot_config.dbport + '/users/' + user.username)
  .then(function(args){
    if (args[0].statusCode === 404) {
      bot_logger.log('info', "[BGs] " + JSON.stringify(user) + " has not opted in. Not saving bg.");
      return args;
    } else if (args[0].statusCode === 200) {
      console.log(args);
      return args;
    }
  })
  .catch(function(err) {
      bot_logger.log("error", "[BGs] problem  " + err.code);
  })
  .done();
}

