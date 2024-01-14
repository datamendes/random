const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const socketIo = require('socket.io');
const http = require('http');
const sharedsession = require('express-socket.io-session');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const sessionMiddleware = session({
  secret: 'some secret',
  resave: false,
  saveUninitialized: false
});

app.use(sessionMiddleware);

passport.use(new SteamStrategy({
    returnURL: 'http://localhost:3000/auth/steam/return',
    realm: 'http://localhost:3000/',
    apiKey: '9E11201C82E49E32FFE23D3EB3B61C72' // Replace with your actual Steam API key
  },
  (identifier, profile, done) => {
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.sendFile(__dirname + '/chat.html');
  } else {
    res.sendFile(__dirname + '/login.html');
  }
});

app.get('/auth/steam', passport.authenticate('steam'), (req, res) => {});
app.get('/auth/steam/return',
  passport.authenticate('steam', { failureRedirect: '/login.html' }),
  (req, res) => res.redirect('/')
);

io.use(sharedsession(sessionMiddleware, {
  autoSave: true
}));

let onlineUsers = {};

io.on('connection', (socket) => {
    const steamUser = socket.handshake.session.passport?.user;
    if (steamUser) {
        const username = steamUser.displayName || 'Steam User';
        const steamId = steamUser.id || 'unknown';
        onlineUsers[socket.id] = { username, steamId };

        io.emit('online users', Object.values(onlineUsers).map(user => user.username));
    }

    socket.on('chat message', (msg) => {
        if(onlineUsers[socket.id]) {
            io.emit('chat message', { 
                user: onlineUsers[socket.id].username, 
                steamId: onlineUsers[socket.id].steamId, 
                message: msg 
            });
        }
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('online users', Object.values(onlineUsers).map(user => user.username));
    });
});

server.listen(3000, () => console.log('listening on *:3000'));
