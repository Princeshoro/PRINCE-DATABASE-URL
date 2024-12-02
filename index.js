import express from 'express';
import fs from 'fs/promises'; 
import path from 'path';
import { EventEmitter } from 'events';

const dbFolder = './files';
const dbFiles = ['db.json', 'db1.json', 'db2.json', 'db3.json', 'db4.json', 'db5.json'];
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB file size limit for each file

class Stater extends EventEmitter {
  constructor(props) {
    super(props);
    this.state = true;
  }

  setState(newState) {
    this.state = newState || false;
    this.emit('set', newState);
  }

  waitForTrue() {
    return new Promise((resolve) => {
      const check = () => {
        if (this.state) {
          this.off('set', check);
          resolve();
        }
      };
      this.on('set', check);
      check();
    });
  }
}

const isOpen = new Stater();

const app = express();

// Middleware to parse JSON requests
app.use(express.json());

// Function to clean a database file if it exceeds the size limit
async function cleanDatabase(filePath) {
  try {
    const fileData = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileData);

    if (Array.isArray(data)) {
      // Remove oldest entries for array data
      while (JSON.stringify(data).length > MAX_FILE_SIZE / 2) {
        data.shift();
      }
    } else if (typeof data === 'object') {
      // Remove oldest keys for object data
      const keys = Object.keys(data);
      while (JSON.stringify(data).length > MAX_FILE_SIZE / 2) {
        delete data[keys.shift()];
      }
    }

    // Write cleaned data back to the file
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`${filePath} cleaned to maintain size limit.`);
  } catch (error) {
    console.error(`Error cleaning ${filePath}:`, error);
  }
}

// Function to get the current database file
async function getCurrentDatabaseFile() {
  for (const dbFile of dbFiles) {
    const filePath = path.join(dbFolder, dbFile);
    try {
      const stats = await fs.stat(filePath);
      if (stats.size < MAX_FILE_SIZE) {
        return filePath;
      }
    } catch {
      // File doesn't exist; create it
      await fs.writeFile(filePath, JSON.stringify([], null, 2), 'utf8');
      return filePath;
    }
  }

  // If all files are full, return the first file (and clean it)
  console.log('All database files exceeded size. Cleaning the first file...');
  const firstFilePath = path.join(dbFolder, dbFiles[0]);
  await cleanDatabase(firstFilePath);
  return firstFilePath;
}

// GET route to fetch data from all database files
app.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  await isOpen.waitForTrue();
  isOpen.setState(false);

  try {
    const allData = [];
    for (const dbFile of dbFiles) {
      const filePath = path.join(dbFolder, dbFile);
      try {
        const fileData = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(fileData);
        allData.push(...(Array.isArray(data) ? data : [data]));
      } catch {
        // If the file doesn't exist or is empty, skip it
        console.log(`Skipping empty or non-existent file: ${dbFile}`);
      }
    }
    res.send(allData);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Internal Server Error',
    });
  } finally {
    isOpen.setState(true);
  }
});

// POST route to add data to the current database file
app.post('/', async (req, res) => {
  if (req.headers['content-type'] !== 'application/json') {
    return res.status(401).json({
      error: 'Invalid Type',
      message: 'Content-Type must be application/json',
    });
  }

  await isOpen.waitForTrue();
  isOpen.setState(false);

  try {
    const filePath = await getCurrentDatabaseFile();

    // Read existing data
    let existingData = [];
    try {
      const fileData = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(fileData);
    } catch {
      existingData = [];
    }

    // Append new data
    if (Array.isArray(existingData)) {
      existingData.push(req.body);
    } else {
      existingData = [existingData, req.body];
    }

    // Write updated data back to the file
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2), 'utf8');
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Internal Server Error',
    });
  } finally {
    isOpen.setState(true);
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
