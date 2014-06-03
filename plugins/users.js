'use strict';

const 
  request = require('request'),
  Q = require('q'),
  views = require('./users_views.js');

let identified = [];
var users_module = {
  test: "test"
};


function listener(from, to, message, client, logger, config) {
  //console.log(JSON.stringify(message));
  if ((/^register/).test(message.args[1])) { 
    users_module.register(from, to, message, client, logger, config);
  } else if ((/^identify/).test(message.args[1])) {
    users_module.identify(from, to, message, client, logger, config);
  } else if ((/^hostmask/).test(message.args[1])) {
    users_module.hostmask(from, to, message, client, logger, config);
  } else if ((/^whoami/).test(message.args[1])) {
    users_module.whoami(from, to, message, client, logger, config);
  }
};

users_module.register = function register(from, to, message, client, logger, config) {

  this.usage = "test";
  var params = message.args[1].split(" ");
  if (params.length >= 3) {
    let 
      username = params[1],
      password = params[2];

    Q.nfcall(request.get, 'http://' +  config.dbhost + ':' + config.dbport + '/users/' + username)
    .then(function(args) {
      if (args[0].statusCode === 404) {
        var options = {
          method: "PUT",
          url: 'http://' +  config.dbhost + ':' + config.dbport + '/users/' + username,
          json: { "password": password, "hostmasks": [] }
        };
        return Q.nfcall(request, options);
      } else if (args[0].statusCode === 200) {
        return args;
      } else {
        throw args;
      }
    })
    .then(function(args) {
      if (args[0].statusCode === 200) {
        client.say(from, username + " is already registered.");
        return 1;
      } else if (args[0].statusCode === 201) {
        client.say(from, username + " registered.");
        identified.push({username: username, nick: from});
        return 1;
      } else {
        throw args[0];
      }
    })
    .catch(function(err) {
      logger.log("error", "[users] Error registering user: " + JSON.stringify(err));
      client.say(from, JSON.stringify(err))
    })
    .done();
  } else {
    client.say(from,"Usage: register <username> <password>");
  }
};
users_module.register.usage = "register <username> <password>";
users_module.register.description = "Registering with diabot allows you to use the flair features and," + 
  " if you've opted into data collection and set a hostmask, lets your BG information follow nickname changes." +
  " It also allows awaxa to consider you for additional privileges. However, it is not compulsary," +
  " and most members of the channel aren't registered there. Once you've registered," +
  " you can identify yourself to have access to these features.";



users_module.identify = function identify (from, to, message, client, logger, config) {
  var params = message.args[1].split(" ");
  if (params.length >= 3) {
    let 
      username = params[1],
      password = params[2];

    if (identified.map(function(e){return e.nick;}).indexOf(from) == -1 ) {
      Q.nfcall(request.get, 'http://' +  config.dbhost + ':' + config.dbport + '/users/' + username)
      .then(function(args) {
        if (args[0].statusCode === 404) {
          client.say(from, "User " + username + " was not found.");
          return 0;
        } else if (args[0].statusCode === 200) {
          var user = JSON.parse(args[1]);
          if (password === user.password) {
            client.say(from, "Identified as " + username);
            identified.push({username: username, nick: from});
            return 1;
          } else {
            client.say(from, "Incorrect password for " + username);
            return 0;
          }
        } else {
          throw args;
        }
      })
      .catch(function(err) {
        logger.log("error", "[users] Error identifying user: " + JSON.stringify(err));
        client.say(from, JSON.stringify(err))
      })
      .done();
    } else {
      client.say(from, username + " already identified.");
      return 0;
    }

  } else {
    client.say(from,"Usage: identify <username> <password>");
  }
};
users_module.identify.usage = "identify <username> <password>";
users_module.identify.description = "Identify to the bot in order to log BGs.";

users_module.hostmask = function hostmask (from, to, message, client, logger, config) { 
  let 
    params = message.args[1].split(" "),
    username = "";

  if (params.length >= 3) {
    username = identified[identified.map(function(e){return e.nick;}).indexOf(from)];
    if (username != undefined) {
      username = username.username;
    }
    if (username != null && username != undefined && username != "") {
      if (params[1] === "add" || params[1] === "remove") {
        Q.nfcall(request.get, 'http://' +  config.dbhost + ':' + config.dbport + '/users/' + username)
        .then(function(args) {
          if (args[0].statusCode === 404) {
            client.say(from, "User " + username + " was not found.");
            return 0;
          } else if (args[0].statusCode === 200) {
            var user = JSON.parse(args[1]);
            if (params[1] === "add") {
              user.hostmasks.push(params[2]);
              var options = {
                method: "PUT",
                url: 'http://' +  config.dbhost + ':' + config.dbport + '/users/' + username,
                json: user
              };
              return Q.nfcall(request, options);
            } else if (params[1] === "remove") {
              while (user.hostmasks.indexOf(params[2]) > -1) {
                user.hostmasks.splice(user.hostmasks.indexOf(params[2]),1);
              }
              var options = {
                method: "PUT",
                url: 'http://' +  config.dbhost + ':' + config.dbport + '/users/' + username,
                json: user
              };
              return Q.nfcall(request, options);
            }
          } else {
            throw args;
          }
        })
        .then(function(args){
          console
          if (args[0].statusCode === 201) {
            if (params[1] === "add") {
              client.say(from, "hostmask added");
            } else if (params[1] === "remove") {
              client.say(from, "hostmask removed");
            }
            
          } else {
            client.say(from, JSON.stringify(args[0]));
            logger.log("error", "[users] Error modifying hostmask: " + JSON.stringify(args[0]) + " error");
          }
        })
        .catch(function(err) {
          logger.log("error", "[users] Error modifying hostmask: " + JSON.stringify(err) + " error");
          client.say(from, JSON.stringify(err))
        })
        .done();

      } else {
         client.say(from,"Usage: hostmask <add|remove> <password>!<ident>@<example.org>");
      }
    } else {
      client.say(from, "Please identify first.");
    }
  } else {
    client.say(from,"Usage: hostmask <add|remove> <password>!<ident>@<example.org>");
  }
};
users_module.hostmask.usage = "hostmask <add|remove> <password>!<ident>@<example.org>";
users_module.hostmask.description = "Adds a host mask that automatically identifies you when joining the channel.";

function joinListener(channel, nick, message, client, logger, config) {
  client.whois(nick, function(info) {
    if (info.nick != config.nick) {
      var options = {
        method: "GET",
        url: 'http://' +  config.dbhost + ':' + config.dbport + '/users/_design/users/_view/by_hostmask',
        qs: {
          startkey: JSON.stringify(info.nick + "!" + info.user + "@" + info.host),
          endkey: JSON.stringify(info.nick + "!" + info.user + "@" + info.host + "\ufff0")
        }
      }; 

      request(options,function(error, response, body){
        if (error) {
          logger.log('error', '[users] Error in joinListener: ' + JSON.stringify(err));
          return;
        } 

        if (response.statusCode === 200) {
          body = JSON.parse(body);
          if (body.rows.length > 0) {
            identified.push({username: body.rows[0].id, nick: info.nick});
          }
        } else {
          logger.log('error', "[users] Error in joinListener: " + JSON.stringify(body));
        } 
      });
    } 
  });
}

function partListener(channel, nick, reason, message, client, logger, config) {
  while (identified.map(function(e){return e.nick;}).indexOf(nick) > -1) {
    identified.splice(identified.map(function(e){return e.nick;}).indexOf(nick),1);
  }
}

users_module.whoami = function whoami(from, to, message, client, logger, config) {
  if (identified.map(function(e){return e.nick;}).indexOf(from) > -1 ) {
    var user = identified[identified.map(function(e){return e.nick;}).indexOf(from)];
    client.say(from, "You are " + user.username);
  } else {
    client.say(from,"You are not identified.");
  }
};
users_module.whoami.usage = "whoami";
users_module.whoami.description = "Displays the user you are identified as.";


module.exports = function(config, client, logger) {
  logger.log('info', "[users] plugin init");

  var help = [];
  for (var key in users_module) {
    var object = {
      command: key,
      usage: users_module[key].usage,
      description: users_module[key].description
    };

    if (object.usage || object.description) {
      help.push(object);
    }
  }

  var plugin = {
    isRegUser: function(nick) {
      if (identified.map(function(e){return e.nick;}).indexOf(nick) > -1 ) {
        return true;
      } else {
        return false;
      }
    },
    getUser: function(nick) {
      if (identified.map(function(e){return e.nick;}).indexOf(nick) > -1 ) {
        return identified[identified.map(function(e){return e.nick;}).indexOf(nick)];
      } else {
        var blank = new Object();
        blank.username = "";
        blank.nick = nick;
        return blank;
      }
    },
    help: help
  };

  Q.nfcall(request.get, 'http://' +  config.dbhost + ':' + config.dbport + '/users')
    .then(function(args) {
      if (args[0].statusCode === 404) {
        //create database
        logger.log('info', "[users] users database not found. Creating now.");
        return Q.nfcall(request.put, 'http://' + config.dbhost + ':' + config.dbport + '/users');
      } else {
        return args[0];
      }
    })
    .then(function(args){
      return Q.nfcall(request.get, 'http://' +  config.dbhost + ':' + config.dbport + '/users/_design/users');
    })
    .then(function(args) {
      var doc = "";
      if(args[0].statusCode === 404) {
        doc = { views: {} };
      } else if (args[0].statusCode === 200) {
        doc = JSON.parse(args[1]);
      }

      if (JSON.stringify(doc.views.by_hostmask) != JSON.stringify(views.by_hostmask)) {
        doc.views.by_hostmask = views.by_hostmask;
        var options = {
          method: "PUT",
          url: 'http://' +  config.dbhost + ':' + config.dbport + '/users/_design/users',
          json: doc
        };
        return Q.nfcall(request, options);
      } 
    })
    .then(function(args) {
      logger.log("info", "[users] All DB's good, adding listeners for commands");    
      client.addListener('pm', function(from, to, message){listener(from, to, message, client, logger, config);});
      client.addListener('join', function(channel, nick, message){joinListener(channel, nick, message, client, logger, config);});
      client.addListener('part', function(channel, nick, reason, message){partListener(channel, nick, reason, message, client, logger, config);});
    })
    .catch(function(err) {
      logger.log("error", "[users] problem accessing or creating database. Check configs. Error code: " + err.code);
    })
  .done();

  return plugin;

};
