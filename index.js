import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const dbFolder = './files';
const dbFiles = ['db.json', 'db1.json', 'db2.json', 'db3.json', 'db4.json', 'db5.json'];
const app = express();

app.use(express.json()); // Middleware to parse JSON requests

// Function to read all database files and prepare data for vertical output
async function readDatabaseFiles() {
  const verticalData = {};
  for (const dbFile of dbFiles) {
    const filePath = path.join(dbFolder, dbFile);
    try {
      const fileData = await fs.readFile(filePath, 'utf8');
      const parsedData = JSON.parse(fileData);
      verticalData[dbFile] = Array.isArray(parsedData) ? parsedData : [parsedData];
    } catch {
      // If the file is empty or non-existent, initialize it with an empty array
      await fs.writeFile(filePath, JSON.stringify([], null, 2), 'utf8');
      verticalData[dbFile] = [];
    }
  }
  return verticalData;
}

// GET route to fetch database content in vertical format with stylish emojis
app.get('/', async (req, res) => {
  try {
    const verticalData = await readDatabaseFiles();
    const response = {};
    for (const [fileName, data] of Object.entries(verticalData)) {
      response[`📁 ${fileName}`] = data.length
        ? data.map((entry, index) => `✨ ${index + 1}: ${JSON.stringify(entry, null, 2)}`)
        : ['🚫 No data found'];
    }
    res.json(response);
  } catch (error) {
    console.error('Error reading database files:', error);
    res.status(500).json({ error: 'Internal Server Error 😢' });
  }
});

// POST route to add data to the current database file
app.post('/', async (req, res) => {
  if (req.headers['content-type'] !== 'application/json') {
    return res.status(400).json({
      error: 'Invalid Type ❌',
      message: 'Content-Type must be application/json 🛠️',
    });
  }

  try {
    const filePath = path.join(dbFolder, dbFiles[0]); // Simplified to use the first file for demonstration
    const fileData = await fs.readFile(filePath, 'utf8');
    const parsedData = JSON.parse(fileData);

    // Append new data
    if (Array.isArray(parsedData)) {
      parsedData.push(req.body);
    } else {
      parsedData = [parsedData, req.body];
    }

    // Write updated data back to the file
    await fs.writeFile(filePath, JSON.stringify(parsedData, null, 2), 'utf8');
    res.status(200).json({ message: 'Data added successfully ✅' });
  } catch (error) {
    console.error('Error writing to database:', error);
    res.status(500).json({ error: 'Internal Server Error 😢' });
  }
});

// Initialize server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port} 🌟`);
});
