'use strict';

const 
  request = require('request'),
  Q = require('q'),
  views = require('./bgs_views.js');;

var bg_memory = new Array();
var bgs_module = {
  test: "test"
};


let 
  plugins = null,
  bot_config = null,
  bot_logger = null;

module.exports = function(config, client, logger, bot_plugins) {
  logger.log('info', "[BGs] plugin init");
  plugins = bot_plugins;
  bot_config = config;
  bot_logger = logger;

  var help = [];
  for (var key in bgs_module) {
    var object = {
      command: key,
      usage: bgs_module[key].usage,
      description: bgs_module[key].description
    };

    if (object.usage || object.description) {
      help.push(object);
    }
  }

  var plugin = {
    help: help
  };

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

  return plugin;

};


function listener(from, to, message, client) {
  var params = message.split(" ");
  if ((/^!bg /).test(message) || !isNaN(params[0])) { 
    bgs_module.bg(from, to, message, client);
  } else if ((/^!bgoops/).test(message)) {
    bgs_module.bgoops(from, to, message, client);
  } else if ((/^!bgoptin/).test(message)) {
    bgs_module.bgoptin(from, to, message, client);
  } else if ((/^!bgoptout/).test(message)) {
    bgs_module.bgoptout(from, to, message, client);
  } else if ((/^!last/).test(message) || (/^!lastbgs/).test(message)) {
    bgs_module.lastbgs(from, to, message, client);
  } else if ((/^!esta1c/).test(message) || (/^!ea1c/).test(message)) {
    bgs_module.esta1c(from, to, message, client);
  } else if ((/^!estbg/).test(message) || (/^!eag/).test(message) || (/^!ebg/).test(message)) {
    bgs_module.estbg(from, to, message, client);
  } else if ((/^!disclaimer/).test(message)) {
    bgs_module.disclaimer(from, to, message, client);
  }else if ((/^!prune /).test(message)) {
    prune(from, to, message, client);
  }
}

bgs_module.bg = function bg(from, to, message, client) {
  let 
    usage = "bg <test result>",
    description = "Stores your blood sugar so it can be recalled later with lastbgs." +
      " It also prints a conversion from milligrams per decileter, used in the United States," +
      " to millimoles per liter, used in Europe, or the corresponding reverse conversion.";

  var user = plugins.users.getUser(from);

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
};
bgs_module.bg.usage = "bg <test result>";
bgs_module.bg.description = "Stores your blood sugar so it can be recalled later with lastbgs." +
  " It also prints a conversion from milligrams per decileter, used in the United States," +
  " to millimoles per liter, used in Europe, or the corresponding reverse conversion."


bgs_module.bgoptin = function bgoptin(from, to, message, client) {
  let params = message.split(" ");

  let user = plugins.users.getUser(from);

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

};
bgs_module.bgoptin.usage = "bgoptin <count> {days|entries}";
bgs_module.bgoptin.description = "Instructs the bot to retain your BGs in a persistent database according to your prefered settings.";

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
  .catch(function(err) {
      bot_logger.log("error", "[BGs] problem  " + err.code);
  })
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

bgs_module.bgoptout = function bgoptout(from, to, message, client) {
  let params = message.split(" ");

  let user = plugins.users.getUser(from);

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
};
bgs_module.bgoptout.usage = "bgoptout";
bgs_module.bgoptout.description = "Instructs the bot to stop recording your BGs in the database. Removes all stored BGs.";

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
      var prune_users = JSON.parse(args[1]).rows; 
      prune_users.shift(); //first doc is the design document
      //console.log(users);
      if (prune_users.length > 0) {
        prune_users.forEach(function(element){
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

  let user = plugins.users.getUser(params[1]);

  let usage = "prune <user>";

  pruneUser(user.username);
}

bgs_module.disclaimer = function disclaimer(from, to, message, client) {
  var disclaimer = "Remember that none of us are medical professionals in any way." +
    " Please consult your physician or healthcare provider when in doubt. Thank you.";
  if (to.indexOf("#") >= 0) {
    client.say(to, disclaimer);
  } else {
    client.say(from, disclaimer);
  }
};
bgs_module.disclaimer.usage = "disclaimer";
bgs_module.disclaimer.description = "Displays a helpful disclaimer for medical advice given in the channel.";





bgs_module.esta1c = function esta1c(from, to, message, client) {
  var params = message.split(" ");

  if (params.length >= 2) {
    var bg_value = Number(params[1]);
      if (bg_value != 0) {
      var converted = "";
      if(bg_value <= 18) {
        converted = ["BG ", bg_value, " mmol/L ", 
          "(", (bg_value * 18.0182).toFixed(0), " mg/dL)", 
          " ~= A1C ", (((bg_value * 18.0182) + 46.7) / 28.7).toFixed(1), "%"].join('');
      } else {
        converted = ["BG ", bg_value, " mg/dL ", 
          "(", (bg_value / 18.0182).toFixed(0), " mmol/L)", 
          " ~= A1C ", ((bg_value + 46.7) / 28.7).toFixed(1), "%"].join('');
      }
      if (to.indexOf("#") >= 0) {
        client.say(to, converted);
      } else {
        client.say(from, converted);
      }
    }
  } else {
    if (to.indexOf("#") >= 0) {
      client.say(to, "Usage: " + bgs_module.esta1c.usage);
    } else {
      client.say(from, "Usage: " + bgs_module.esta1c.usage);
    }
  } 
};
bgs_module.esta1c.usage = "esta1c <average BG>";
bgs_module.esta1c.description = 'Estimates what the results of a glycated hemoglobin (HbA1C) test would be if the patient averaged' +
  ' a given blood sugar. For example, a consistent 154 mg/dL glucose (8.6 mmol/L) would produce an A1C of 7.0% (51 mmol/mol).' +
  ' Americans measure the percent of all hemoglobin that is glycated ("DCCT", named after a famous clinical trial, or "NGSP",' +
  ' a standards program set up to match measurements against DCCT), while Europeans measure the proportion of molecular weight' +
  ' ("IFCC", named after a chemistry body).';


bgs_module.estbg = function estbg(from, to, message, client) {
  var params = message.split(" ");

  if (params.length >= 2) {
    var a1c_value = Number(params[1]);
      if (a1c_value != 0) {
      var converted = ["HbA1C ", a1c_value, 
        " ~= ", ((a1c_value * 28.7) - 46.7).toFixed(1), " mg/dL or ", (((a1c_value * 28.7) - 46.7) / 18.0182).toFixed(1), " mmol/L."].join('');
      if (to.indexOf("#") >= 0) {
        client.say(to, converted);
      } else {
        client.say(from, converted);
      }
    }
  } else {
    if (to.indexOf("#") >= 0) {
      client.say(to, "Usage: " + bgs_module.estbg.usage);
    } else {
      client.say(from, "Usage: " + bgs_module.estbg.usage);
    }
  } 
};
bgs_module.estbg.usage = "estbg <HbA1C>";
bgs_module.estbg.description = 'Estimates what the average blood sugar over the past 60-90 days was for a patient with the given' +
  ' glycated hemoglobin (HbA1C) level. As sugar circulates in the blood, it causes small changes to the hemoglobin in red blood cells.' +
  ' These changes can be detected and give a window into the amount of glucose present over the lifetime of the cells.For example,' +
  ' an A1C of 7.0% (51 mmol/L) reflects an average glucose of 154 mg/dL (8.6 mmol/L). Americans measure the percent of all hemoglobin' +
  ' that is glycated ("DCCT", named after a famous clinical trial, or "NGSP", a standards program set up to match measurements against DCCT),' +
  ' while Europeans measure the proportion of molecular weight ("IFCC", named after a chemistry body).';


bgs_module.lastbgs = function lastbgs(from, to, message, client) {
  var params = message.split(" ");
  var bgs_to_display = 5;
  var bgs = [];
  if(params[1]) {
    bgs_to_display = Number(params[1]);
  }

  let user = plugins.users.getUser(from);

  if (user.username != "") {
    var options = {
      method: "GET",
      url: 'http://' +  bot_config.dbhost + ':' + bot_config.dbport + '/bgs/_design/bgs/_view/by_user',
      qs: {
        startkey: JSON.stringify(user.username),
        endkey: JSON.stringify(user.username)
      }
    };
    Q.nfcall(request,options)
    .then(function(args){
      if (args[0].statusCode === 200) {
        var results = JSON.parse(args[1]).rows;
        if (results.length > 0) {
          results.sort(function(a, b){
            return new Date(b.value.date).getTime() - new Date(a.value.date).getTime();
          }).slice(0, bgs_to_display).forEach(function(entry){
            var bg_date = new Date(entry.value.date);
            bgs.push("[" + (bg_date.getMonth() + 1) + "/" + bg_date.getDate() + " " + bg_date.getHours() + ":" + bg_date.getMinutes() + "] " + "\u0002" + entry.value.bg + "\u000F");
          });
          if (to.indexOf("#") >= 0) {
            client.say(to, bgs.join(", "));
          } else {
            client.say(from, bgs.join(", "));
          }
        } else {
          throw "No bgs for user";
        }
      } else {
        throw "Could not get bgs for user";
      }
    })
    .catch(function(err){
      bot_logger.log("error","[BGs] lastbgs error: " + err);
    })
    .done();
  } else {

    var memory_bg = bg_memory.slice(0);
    memory_bg.sort(function(a, b){
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }).slice(0, bgs_to_display).forEach(function(entry){
      if (entry.user === from) {
        var bg_date = new Date(entry.date);
        bgs.push("[" + (bg_date.getMonth() + 1) + "/" + bg_date.getDate() + " " + bg_date.getHours() + ":" + bg_date.getMinutes() + "] " + "\u0002" + entry.bg + "\u000F");
      }
    });
    if (to.indexOf("#") >= 0) {
      client.say(to, bgs.join(", "));
    } else {
      client.say(from, bgs.join(", "));
    }
  }

};
bgs_module.lastbgs.usage = "lastbgs [number to display]";
bgs_module.lastbgs.description = "Displays the last 5 recorded BG's, from database if identified or from memory if not. Optionally specifiy" +
  " the number of BG's to display.";

bgs_module.bgoops = function bgoops(from, to, message, client) {
  let user = plugins.users.getUser(from);

  if (user.username != "") {
    var options = {
      method: "GET",
      url: 'http://' +  bot_config.dbhost + ':' + bot_config.dbport + '/bgs/_design/bgs/_view/by_user',
      qs: {
        startkey: JSON.stringify(user.username),
        endkey: JSON.stringify(user.username)
      }
    };
    Q.nfcall(request,options)
    .then(function(args){
      if (args[0].statusCode === 200) {
        var results = JSON.parse(args[1]).rows;
        if (results.length > 0) {
          var toDelete = results.sort(function(a, b){
            return new Date(a.value.date).getTime() - new Date(b.value.date).getTime();
          })[0];
          var options = {
            method: "DELETE",
            url: 'http://' +  bot_config.dbhost + ':' + bot_config.dbport + '/bgs/' + toDelete.value._id + "?rev=" + toDelete.value._rev
          }; 
          return Q.nfcall(request, options);
        } else {
          throw "No bgs for user";
        }
      } else {
        throw "Could not get bgs for user";
      }
    })
    .then(function(args){
      return true;
    })
    .catch(function(err){
      bot_logger.log("error","[BGs] bgoops error: " + err);
    })
    .done();
  } else {
    bg_memory.splice(bg_memory.map(function(e){
      return e.user;
    }).lastIndexOf(from), 1);
  }
};
bgs_module.bgoops.usage = "bgoops";
bgs_module.bgoops.description = "Removes the last bg logged.";