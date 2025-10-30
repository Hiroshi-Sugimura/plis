const Database = require('better-sqlite3');
const db = new Database('test.db');

db.prepare('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)').run();
db.prepare('INSERT INTO users (name) VALUES (?)').run('Alice');
console.log(db.prepare('SELECT * FROM users').all());
