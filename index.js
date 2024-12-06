import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const dbFolder = './files';
const dbFiles = ['db.json', 'db1.json', 'db2.json', 'db3.json', 'db4.json', 'db5.json'];
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB limit per file
const MEMORY_CACHE = {}; // In-memory cache for database files

const app = express();
app.use(express.json());

// Initialize database files in memory
async function initializeCache() {
  for (const dbFile of dbFiles) {
    const filePath = path.join(dbFolder, dbFile);
    try {
      const fileData = await fs.readFile(filePath, 'utf8');
      MEMORY_CACHE[dbFile] = JSON.parse(fileData);
    } catch {
      MEMORY_CACHE[dbFile] = []; // Initialize as empty array if file doesn't exist
      await fs.writeFile(filePath, JSON.stringify([], null, 2), 'utf8');
    }
  }
}

// Save cache to files periodically
async function saveCacheToFiles() {
  for (const dbFile of dbFiles) {
    const filePath = path.join(dbFolder, dbFile);
    if (MEMORY_CACHE[dbFile]) {
      await fs.writeFile(filePath, JSON.stringify(MEMORY_CACHE[dbFile], null, 2), 'utf8');
    }
  }
}

// Clean the first database file if all files exceed size limit
async function cleanDatabase() {
  const firstFile = dbFiles[0];
  const filePath = path.join(dbFolder, firstFile);

  let data = MEMORY_CACHE[firstFile];
  while (JSON.stringify(data).length > MAX_FILE_SIZE / 2) {
    data.shift(); // Remove oldest entries
  }

  MEMORY_CACHE[firstFile] = data;
  console.log(`${firstFile} cleaned to maintain size limit.`);
}

// GET route to fetch all data in horizontal format
app.get('/', async (req, res) => {
  try {
    const allData = [];
    for (const dbFile of dbFiles) {
      allData.push(...(MEMORY_CACHE[dbFile] || []));
    }
    res.json(allData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST route to add data
app.post('/', async (req, res) => {
  try {
    const newData = req.body;

    // Find the first available file to store the new data
    for (const dbFile of dbFiles) {
      const currentData = MEMORY_CACHE[dbFile] || [];
      if (JSON.stringify(currentData).length < MAX_FILE_SIZE) {
        currentData.push(newData);
        MEMORY_CACHE[dbFile] = currentData;
        return res.sendStatus(200);
      }
    }

    // If all files are full, clean the first file and retry
    await cleanDatabase();
    MEMORY_CACHE[dbFiles[0]].push(newData);
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start server and initialize cache
const port = process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  await initializeCache();
  setInterval(saveCacheToFiles, 5000); // Save cache to files every 5 seconds
});
