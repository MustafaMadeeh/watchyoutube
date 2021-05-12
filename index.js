const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const ejs = require("ejs");
const http = require("http");
const socket = require("socket.io");
const { urlencoded } = require("express");
const formatMessage = require(__dirname + "/public/messages.js");
const { userJoin, getCurrentUser, userLeft, getRoomUsers } = require(__dirname +
  "/public/users.js");
  require('dotenv').config()


//sets up http, express, socket.io & bodyParser
const app = express();
const server = http.createServer(app);
const io = socket(server);
const botName = "iraqflix";

//Set up bodyparser
app.use(bodyParser.json()); 
app.use(
  bodyParser.urlencoded({
    // to support URL-encoded bodies
    extended: true,
  })
);
//Handles the rooms and socket connections.
io.on("connection", (socket) => {
  socket.on("joinRoom", ({ username, roomid }) => {
    const user = userJoin(socket.id, username, roomid);

    socket.join(user.room);

    //Welcome current users
    socket.emit(
      "message",
      formatMessage(
        botName,
        `اهلا بك في ${roomid} ارسل رساله ليعرفو بوجودك.`
      )
    );

    //broadcast when user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} أنضم الى الغرفة`)
      );

    //Send users and room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  //Listen for new video

  socket.on("newVideo", (newUrl) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("newVideo", newUrl);

    io.to(user.room).emit(
      "message",
      formatMessage(
        botName,
        `${user.username} قام بتشغيل فيديو جديد: <a href="${newUrl}">${newUrl}</a>`
      )
    );
  });

  //Listen for pause

  socket.on("pause", (playState) => {
    const user = getCurrentUser(socket.id);
    state = 2;
    io.to(user.room).emit("pause", state);

    io.to(user.room).emit(
      "message",
      formatMessage(botName, `${user.username} أوقف الفيديو`)
    );
  });

  //Listen for seek

  socket.on("seek", (seekTime) => {
    const user = getCurrentUser(socket.id);
    io.to(user.room).emit("seek", seekTime);

    let sec_num = parseInt(seekTime, 10);
    let hours = Math.floor(sec_num / 3600);
    let minutes = Math.floor((sec_num - hours * 3600) / 60);
    let seconds = sec_num - hours * 3600 - minutes * 60;
    if (hours < 10) hours = "0" + hours;
    if (minutes < 10) minutes = "0" + minutes;
    if (seconds < 10) seconds = "0" + seconds;

    io.to(user.room).emit(
      "message",
      formatMessage(
        botName,
        `${user.username} تخطى الى ${
          hours + ":" + minutes + ":" + seconds
        }
        `
      )
    );
  });

  //Listen for play
  socket.on("play", (playState) => {
    const user = getCurrentUser(socket.id);
    state = 1;
    io.to(user.room).emit("play", state);

    io.to(user.room).emit(
      "message",
      formatMessage(botName, `${user.username} قام بتشغيل الفيديو`)
    );
  });

  //  //Listen for buffer
  //   socket.on("buffering", (playState) => {
  //     const user = getCurrentUser(socket.id);
  //     state = 3;
  //     console.log(playState);
  //     io.to(user.room).emit("buffering", state);

  //     io.to(user.room).emit(
  //       "message",
  //       formatMessage(botName, `${user.username} is buffering`)
  //     );
  //   });

  //Listen for chat message
  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("message", formatMessage(user.username, msg));
  });

  //Runs when client disconnects
  socket.on("disconnect", () => {
    const user = userLeft(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} غادر الغرفة`)
      );
      //Send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

//sets up port & support for static files

const PORT = process.env.PORT || 5000;

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/create", (req, res) => {
  res.render("create");
});

app.get("/room", (req, res) => {
  res.render("room");
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/contact", (req, res) => {
  res.render("contact");
});

app.post("/contact", (req, res) => {
  const name = req.body.contactName;
  const email = req.body.contactEmail;
  const message = req.body.contactMessage;
  const hostEmail = process.env.HOST_EMAIL
  const hostPass = process.env.HOST_PASS
  var transporter = nodemailer.createTransport({
    service: 'Hotmail',
    auth: {
      user: hostEmail,
      pass: hostPass
    }
  });
  
  var mailOptions = {
    from: hostEmail,
    to: hostEmail,
    subject: `WatchWithFriends Email from ${name}`,
    html: `
    <p><b>Sender name:</b> ${name}</p>
    <p><b>Sender email:</b> ${email}</p>
    <p><b>Message contents:</b> ${message}</p> 
    `
  };
  
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } 
  });

  res.redirect("/");
});

server.listen(PORT, () => console.log(`Server hosted on port ${PORT}`));
