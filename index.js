import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

const db = await open({
    filename: 'chat.db',
    driver: sqlite3.Database
})

await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
    );
`)

const app = express();
const server = createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {}
});

const _dirname = dirname(fileURLToPath(import.meta.url));

app.get("/", (req, res) => {
    res.sendFile(join(_dirname, "index.html"));
});

io.on("connection", async (socket) => {
    console.log("a user connected");
    socket.on('chat message', async (msg) => {
        console.log('Msg received from client: ' + msg);
        console.log('Sending message to client');

        let result;
        try {
            result = await db.run('INSERT INTO messages (content) VALUES (?)', msg);
        } catch (e) {
            return;
        }
        io.emit('chat message', msg, result.lastID);
    });

    if (!socket.recovered) {
        try {
            await db.each('SELECT id, content FROM messages WHERE id > ?',
                [socket.handshake.auth.serverOffset || 0],
                (_err, row) => {
                    socket.emit('chat message', row.content, row.id);
                }
            )
        } catch (e) {

        }
    }

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(3000, () => {
    console.log("server running at port 3000");
});
