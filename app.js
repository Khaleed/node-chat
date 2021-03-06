var express = require("express");
var app = express();
var server = require("http").Server(app);
var path = require("path");
// serve static files via express
app.use(express.static(path.join(__dirname, "public")));
var publicDir = "./public/";
// define route
app.get("/", function(request, response) {
    response.sendFile(publicDir + "index.html");
});
var port = process.env.port || 3000;
// require socket.io and pass server
var io = require("socket.io")(server);
// interface to talk to mongodb
var mongoose = require("mongoose");
// create node_chat db
mongoose.connect("mongodb://localhost/node_chat", function(err) {
    if (err) {
        console.error(err);
    } else {
        console.log("mongdodb connection created");
    }
});
// map Schema to MongoDB collection
var chatSchema = mongoose.Schema({
    user: String,
    msg: String,
    updated: {
        type: Date,
        default: Date.now
    }
});
// compile Schema into a model
// instances of model represent documents
// which can be saved or retrieved from db
var Messages = mongoose.model("Message", chatSchema);
var usernames = [];
io.on("connection", function(client) {
    console.log("Socket.io connection established");
    client.on("join", function(nick, callback) {
        var query = Messages.find({}).sort("-updated").limit(10).exec(function(err, results) {
            if (err) {
                console.error(err);
            } else {
                client.emit("old msg", results);
            }
        });
        //check if usernames is not in array
        if (usernames.indexOf(nick) === -1) {
            callback(true);
            // make nick as property of client's socket
            client.nickname = nick;
            // push nick associated with each socket into usernames array
            usernames.push(client.nickname);
            // emit all nicknames to users
            io.emit("nicks", usernames);
        } else {
            callback(false);
        }
    });
    // listen for messages from client
    client.on("messages", function(data) {
        // create a new instance of Messages model
        var chatMsg = new Messages({
            user: client.nickname,
            msg: data
        });
        // save messages on MongoDB
        chatMsg.save(function(err) {
            if (err) {
                console.error(err);
            } else {
                // emit new messages to all clients
                io.emit("new messages", {
                    user: client.nickname,
                    msg: data
                });
            }
        });
    });
    client.on("disconnect", function() {
        console.log(client.nickname + " logged off");
        var start = usernames.indexOf(client.nickname);
        // check if client has the property nickname
        if (client.nickname) {
            // remove nick from usernames array
            usernames.splice(start, 1);
            // emit updated list of nicks
            io.emit("nicks", usernames);
            // if client doesn't have nickname property, do nothing
        } else {
            return;
        }
    });
});
server.on("listening", function() {
    console.log("OK, the server is listening ");
});
// listen to port or whatever is in process.env.port
server.listen(port, function() {
    console.log("listening on port " + port);
});