'use strict';

const 
  request = require('request'),
  Q = require('q'),
  views = require('./bgs_views.js');;

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
    .then(function(args){
      return Q.nfcall(request.get, 'http://' +  config.dbhost + ':' + config.dbport + '/bgs/_design/bgs');
    })
    .then(function(args) {
      var doc = "";
      if(args[0].statusCode === 404) {
        doc = { views: {} };
      } else if (args[0].statusCode === 200) {
        doc = JSON.parse(args[1]);
      }

      if (JSON.stringify(doc.views.by_user) != JSON.stringify(views.by_user)) {
        doc.views.by_user = views.by_user;
        var options = {
          method: "PUT",
          url: 'http://' +  config.dbhost + ':' + config.dbport + '/bgs/_design/bgs',
          json: doc
        };
        return Q.nfcall(request, options);
      } 
    })
    .then(function(args) {
      logger.log("info", "[BGs] All DB's good, adding listeners for bg commands");    
      client.addListener('message', function(from, to, message){listener(from, to, message, client);});
      pruneAll();
      var pruning = setInterval(pruneAll,86400000);
      pruning.unref();
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
  } else if ((/^!bgoptout/).test(message)) {
    bgoptout(from, to, message, client);
  } else if ((/^!last /).test(message) || (/^!lastbgs /).test(message)) {
    
  } else if ((/^!esta1c /).test(message) || (/^!ea1c /).test(message)) {
    
  } else if ((/^!estbg /).test(message) || (/^!eag /).test(message) || (/^!ebg /).test(message)) {
    
  } else if ((/^!disclaimer /).test(message)) {
    
  }else if ((/^!prune /).test(message)) {
    prune(from, to, message, client);
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
      saveBG(from, user, bg_value, date);
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
      //bot_logger.log('info', "[BGs] " + JSON.stringify(user) + " has not opted in. Not saving bg.");
      throw "User not opted in, not saving bg.";
    } else if (args[0].statusCode === 200) {
      //console.log(args);
      //return args;
      var this_user = JSON.parse(args[1]);
      if (this_user.bgoptin === true) {
        //good time for a call to pruneUser();
        var bgdoc = {
          bg: bg,
          user: user.username,
          date: new Date().toISOString()
        };
        var options = {
          method: "PUT",
          url: 'http://' +  bot_config.dbhost + ':' + bot_config.dbport + '/bgs/' + UUID(),
          json: bgdoc
        };
        return Q.nfcall(request, options);
      } else {
        throw "User not opted in, not saving bg.";
      }
    }
  })
  .then(function(args){
    if (args[0].statusCode === 201) {
      bot_logger.log("info","[BGs] saved bg for user " + user.username);
    } else {
      throw "Unabled to save bg. " + args[0];
    }
  })
  // .catch(function(err) {
  //     bot_logger.log("error", "[BGs] problem  " + err.code);
  // })
  .done();
}

function UUID() {
    var uuid = (function () {
        var i,
            c = "89ab",
            u = [];
        for (i = 0; i < 36; i += 1) {
            u[i] = (Math.random() * 16 | 0).toString(16);
        }
        u[8] = u[13] = u[18] = u[23] = "-";
        u[14] = "4";
        u[19] = c.charAt(Math.random() * 4 | 0);
        return u.join("");
    })();
    return {
        toString: function () {
            return uuid;
        },
        valueOf: function () {
            return uuid;
        }
    };
}

function bgoptout(from, to, message, client) {
  let params = message.split(" ");

  let user = users.getUser(from);

  let usage = "bgoptout";

  if (user.username != "" && user.username != null && user.username != undefined) {
      Q.nfcall(request.get, 'http://' +  bot_config.dbhost + ':' + bot_config.dbport + '/users/' + user.username)
      .then(function(args){
        if (args[0].statusCode === 200) {
          var this_user = JSON.parse(args[1]);
          this_user.bgoptin = false;
          this_user.bgcount = 0;
          this_user.bgunits = "";
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
          client.say(from, "BGs will no longer be logged.");
          //call pruneUser()
        } else {
          throw args;
        }
      })
      .catch(function(err) {
        client.say(from, "Could not update your BG settings.");
        bot_logger.log("error", "[BGs] bgoptout problem  " + err.code);
      })
      .done();
  } else {
    client.say(from, "Please identify or register first.");
  }
}

function pruneAll() {
  //spins through and prunes all users
   bot_logger.log("info", "[BGs] pruneAll pruning all users");
  var options = {
    method: "GET",
    url: 'http://' +  bot_config.dbhost + ':' + bot_config.dbport + '/users/_all_docs',
  };
  Q.nfcall(request,options)
  .then(function(args){
    if (args[0].statusCode === 200) {
      var users = JSON.parse(args[1]).rows; 
      users.shift(); //first doc is the design document
      //console.log(users);
      if (users.length > 0) {
        users.forEach(function(element){
          pruneUser(element.id);
        });
      } else {
        throw "No users to prune";
      }
    } else {
      throw "Could not get users";
    }
  })
  .catch(function(err) {
    if (typeof err === "object") {
      bot_logger.log("error", "[BGs] pruneAll problem: " + err.code);
    } else {
      bot_logger.log("error", "[BGs] pruneAll problem: " + err);
    }
  })
  .done();
}

function pruneUser(user) {
  //prunes a single user's bg's based on their settings
  bot_logger.log("info", "[BGs] pruneUser pruning " + user);
  var this_user = null;
  if (user != "" && user != null && user != undefined) {
    Q.nfcall(request.get, 'http://' +  bot_config.dbhost + ':' + bot_config.dbport + '/users/' + user)
    .then(function(args){
      if (args[0].statusCode === 200) {
        this_user = JSON.parse(args[1]);
        var options = {
          method: "GET",
          url: 'http://' +  bot_config.dbhost + ':' + bot_config.dbport + '/bgs/_design/bgs/_view/by_user',
          qs: {
            startkey: JSON.stringify(this_user._id),
            endkey: JSON.stringify(this_user._id)
          }
        };
        return Q.nfcall(request,options);
      } else {
        bot_logger.log("info", "[BGs] pruneUser unable to get BG settings for " + user);
        throw args;
      }
    })
    .then(function(args){
      if (args[0].statusCode === 200) {
        var results = JSON.parse(args[1]).rows;
        if (results.length > 0) {
          results = results.sort(function(a, b){
            return new Date(b.value.date).getTime() - new Date(a.value.date).getTime();
          });
          var toDelete = [];
          if (this_user.bgunits === "entries") {
            var counter = 0;
            results.forEach(function(element){
              if (counter >= this_user.bgcount) {
                toDelete.push(element);
              } else {
                counter++;
              }
            });
          } else if (this_user.bgunits === "days") {
            var cutoff = new Date(new Date().setDate(new Date().getDate()-this_user.bgcount));
            results.forEach(function(element){
              if (new Date(element.value.date).getTime() < cutoff.getTime()) {
                toDelete.push(element);
              }
            });
          } else {
            return;
          }

          var itemsToDelete = toDelete.length;

          if (toDelete.length > 0) {
            function deleteBG(deletions){
              return Q.resolve("stuff")
              .then(function(value){
                if (deletions.length === 0) {
                  bot_logger.log("info", "[BGs] pruneUser removed " + itemsToDelete + " BGs for user " + user);
                  return deletions;
                } else {
                  var options = {
                    method: "DELETE",
                    url: 'http://' +  bot_config.dbhost + ':' + bot_config.dbport + '/bgs/' + deletions[0].value._id + "?rev=" + deletions[0].value._rev
                  }; 
                  request(options,function(error, response, body){
                    deletions.shift();
                    return deleteBG(deletions);
                  });
                }
              })
              .catch(function(err) {
                bot_logger.log("error", "[BGs] deleteBG problem  " + err.code);
              });
            };

            deleteBG(toDelete);
          } else {
            bot_logger.log("info", "[BGs] pruneUser no BGs to delete for user " + user + ". Doing no deletions.");
          }

          
        } else {
          bot_logger.log("info", "[BGs] pruneUser no BGs for user " + user + ". Doing no deletions.");
        }
        

      } else {
        throw "Unabled get bgs for user. " + args[0];
      }
    })
    .catch(function(err) {
      bot_logger.log("error", "[BGs] pruneUser problem  " + err.code);
    })
    .done();
  } else {
    bot_logger.log("error", "[BGs] pruneUser problem: no user passed");
  }
}

function prune(from, to, message, client) {
  let params = message.split(" ");

  let user = users.getUser(params[1]);

  let usage = "prune <user>";

  pruneUser(user.username);
}