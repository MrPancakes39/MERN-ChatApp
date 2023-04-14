const express = require("express");
const mongoose = require("mongoose");
// const cookieParser = require("cookie-parser"); //cookie ia a piece of data that a server sends in the http response
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const cors = require("cors"); // refers to the situations when a frontend running in a browser has JS code that communicates with a backend and backend has different origin than the frontend
const bcrypt = require("bcrypt");
const User = require("./models/User");
const Message = require("./models/Message");
const ws = require("ws");
const fs = require("fs");

dotenv.config();
mongoose
    .connect(process.env.MONGO_URL)
    .then(() => console.log("MongoDB Connected!"))
    .catch((err) => {
        if (err) throw err;
    });
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

const app = express();
app.use(cors());
app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(express.json());
// app.use(cookieParser());

async function getUserDataFromRequest(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies?.token;
        if (token) {
            jwt.verify(token, jwtSecret, {}, (err, userData) => {
                if (err) throw err;
                resolve(userData);
            });
        } else {
            reject("No token!");
        }
    });
}

app.get("/test", (req, res) => {
    res.json("Test ok");
});

app.get("/messages/:userId", async (req, res) => {
    const { userId } = req.params;
    const userData = await getUserDataFromRequest(req);
    const ourUserId = userData.userId;
    const messages = await Message.find({
        sender: { $in: [userId, ourUserId] },
        recipient: { $in: [userId, ourUserId] },
    }).sort({ createdAt: 1 }); //to view the last message that it is the last one
    res.json(messages);
}); //fetching history messages from the database

app.get("/people", async (req, res) => {
    const users = await User.find({}, { _id: 1, username: 1 }); //grab all users
    res.json(users);
});

app.get("/profile", (req, res) => {
    //grab the token from our cookie
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json("No token!");
    }
    const userData = jwt.verify(token, jwtSecret, {});
    return res.json(userData);
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await User.findOne({ username });
    if (foundUser) {
        const passOk = bcrypt.compareSync(password, foundUser.password);
        if (passOk) {
            const token = jwt.sign(
                { userId: foundUser._id, username },
                jwtSecret,
                {}
            );
            return res
                .cookie("token", token, { sameSite: "none", secure: true })
                .json({
                    id: foundUser._id,
                });
        }
    }
});

app.post("/logout", (req, res) => {
    return res
        .cookie("token", "", { sameSite: "none", secure: true })
        .json("ok");
});

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await User.findOne({ username });
    if (foundUser) {
        return res.status(400).json("Username taken");
    }
    try {
        const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
        const createdUser = await User.create({
            username: username,
            password: hashedPassword,
        });
        const token = jwt.sign(
            { userId: createdUser._id, username },
            jwtSecret,
            {}
        );
        console.log(token);
        return res
            .cookie("token", token, { sameSite: "none", secure: false })
            .status(201)
            .json({
                id: createdUser._id,
            });
    } catch (err) {
        console.error(err);
        return res.status(500).json("error");
    }
});

const PORT = process.env.PORT || 4040;
const server = app.listen(PORT); //for websocket server

const wss = new ws.WebSocketServer({ server });
wss.on("connection", (connection, req) => {
    function notifyAboutOnlinePeople() {
        [...ws.clients].forEach((client) => {
            client.send(
                JSON.stringify({
                    online: [
                        ...wss.clients.map((c) => ({
                            userId: c.userId,
                            username: c.username,
                        })),
                    ],
                })
            );
        });
    }

    connection.isAlive = true; //after someone is connected

    //timeout to ping that person a set amount of time
    connection.timer = setInterval(() => {
        connection.ping();
        connection.deathTimer = setTimeout(() => {
            connection.isAlive = false;
            clearInterval(connection.timer);
            connection.terminate();
            notifyAboutOnlinePeople();
        }, 1000);
    }, 5000);

    connection.on("pong", () => {
        clearTimeout(connection.deathTimer);
    });

    //read username and id from the cookie for this connection
    const cookies = req.headers.cookie; //inside this cookie, a token that we have to grab to be able to send and receive messages
    if (cookies) {
        const tokenCookieString = cookies
            .split(";")
            .find((str) => str.startsWith("token"));
        // console.log(tokenCookieString);
        if (tokenCookieString) {
            const token = tokenCookieString.split("m")[1];
            if (token) {
                //console.log(token);
                jwt.verify(token, jwtSecret, {}, (err, userData) => {
                    if (err) throw err;
                    //console.log(userData);
                    const { userId, username } = userData;
                    connection.userId = userId;
                    connection.username = username;
                }); //to decode the token
            }
        }
    }
    connection.on("message", async (message) => {
        const messageData = JSON.parse(message.toString());
        //console.log(messageData);
        const { recipient, text, file } = messageData;
        let filename = null;
        if (file) {
            console.log("size", file.data.length);
            const parts = file.name.split(".");
            const ext = parts[parts.length - 1];
            const filename = Date.now() + "." + ext;
            const path = __dirname + "/uploads/" + filename;
            const bufferData = new (file.data.split(",")[1], "base64")();
            fs.writeFile(path, bufferData, () => {
                console.log("file saved:" + path);
            });
        }
        if (recipient && (text || file)) {
            const messageDoc = await Message.create({
                sender: connection.userId,
                recipient,
                text,
                file: file ? filename : null,
            });

            console.log("created message");

            [...wss.clients]
                .filter((c) => c.userId === recipient)
                .forEach((c) =>
                    c.send(
                        JSON.stringigy({
                            text,
                            sender: connection.userId,
                            recipient,
                            file: file ? filename : null,
                            _id: messageDoc._id, //from our database
                        })
                    )
                );
            //filter incase user connected to many devices
            //stringify because we need to send objects
        }
    });

    //notify everyone about online people when someone connects

    //console.log('connected');
    //connection.send('hello');
    //console.log([...wss.clients].length); //to see how many connections we have
    //console.log([...wss.clients].map(c => c.username)); //who are the clients

    notifyAboutOnlinePeople();
});
