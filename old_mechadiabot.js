'use strict';

const config = {
  channels: ['#botwar'],
  server: 'irc.freenode.net',
  dbhost: 'localhost',
  dbport: 5984  
}

const 
  irc = require('irc'),
  request = require('request'),
  Q = require('q');

var client = new irc.Client(config.server, 'slampig', {
  channels: config.channels,
  autoConnect: false
});

Q.nfcall(request.get, 'http://' +  config.dbhost + ':' + config.dbport + '/users')
  .then(function(args) {
    if (args[0].statusCode === 404) {
      //create database
      console.log("users database not found. Creating now.");
      return Q.nfcall(request.put, 'http://' + config.dbhost + ':' + config.dbport + '/users');
    } else {
      //return promise and check bg's database
      return args[0];
    }
  })
  .then(function(args) {
    return Q.nfcall(request.get, 'http://' +  config.dbhost + ':' + config.dbport + '/bgs');
  })
  .then(function(args) {
    if (args[0].statusCode === 404) {
      //create database
      console.log("bgs database not found. Creating now.");
      return Q.nfcall(request.put, 'http://' + config.dbhost + ':' + config.dbport + '/bgs');
    } else {
      return args[0];
    }
  })
  .then(function(args) {
    loadPlugins();
  })
  .catch(function(err) {
    console.log("problem accessing or creating database. Check configs. Error code: " + err.code);
  })
.done();

//request.get('http://' + config.dbhost + ':' + config.dbport + '/users', function(err, res, body) {
  //if (!err) {
    //console.log(res.statusCode);
    //console.log(JSON.parse(body));
    //if(res.statusCode === 404) {
    //  //create users database
      //request.put('http://' + config.dbhost + ':' + config.dbport + '/users', function(err, res, body) {
        //if(!err && res.statusCode == 201) {
          ////check bgs database
	  ////return promise?
        //} else {
          //console.log("Colud not create the users database.");
          ////reject promise?
        //}
      //});
    //} else {
      ////check bgs database
      ////return promise?
    //}
  //} else {
    //console.log("Could not connect to couchdb server. Please check config.");
    ////reject promise?
  //}
//});



function loadPlugins () {
  console.log("loading plugins");
}

//client.connect(3, function() {
//  console.log("Connected, ready for commands");
//});

client.addListener('message', function (from, to, message) {
  console.log(from + ' => ' + to + ': ' + message);
});

client.addListener('pm', function (from, message) {
  console.log(from + ' => ME: ' + message );
  if (from === "funslug" && message === "quit") {
    client.disconnect("Quitting", function() {
      console.log("disconnected");
    });
  }
});
