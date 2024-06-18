const fs = require("fs");
const mysql = require("mysql2");
const { parse } = require("csv-parse");
const multer = require("multer");
const express = require("express");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(cors());

const upload = multer({ dest: "uploads/" });

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "aksattask2",
});

connection.connect((err) => {
  if (err) {
    console.error("Error in the connection:", err);
    return;
  }
  console.log("Database Connected");
});

const BATCH_SIZE = 1000; // Number of records to insert in one batch

app.post("/submit", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Please provide a file.",
    });
  }

  const filePath = req.file.path;
  const validRecords = [];
  const duplicateRecords = [];

  fs.createReadStream(filePath)
    .pipe(parse({ columns: true }))
    .on("data", (record) => {
      if (record.name && record.email && record.contact) {
        validRecords.push(record);
      }
    })
    .on("end", async () => {
      try {
        const emails = validRecords.map((record) => record.email);
        const checkQuery = `SELECT email FROM information WHERE email IN (?)`;

        connection.query(checkQuery, [emails], (checkErr, results) => {
          if (checkErr) {
            console.error("Error checking for duplicate emails:", checkErr);
            return res.status(500).json({
              error: "Error checking for duplicate emails.",
            });
          }

          const existingEmails = new Set(results.map((result) => result.email));
          const uniqueRecords = validRecords.filter(
            (record) => !existingEmails.has(record.email)
          );
          duplicateRecords.push(
            ...validRecords.filter((record) => existingEmails.has(record.email))
          );

          if (uniqueRecords.length > 0) {
            insertInBatches(uniqueRecords, BATCH_SIZE, (insertErr, insertedCount) => {
              if (insertErr) {
                console.error("Error inserting records:", insertErr);
                return res.status(500).json({
                  error: "Error inserting records.",
                });
              }

              updateDuplicateRecords(duplicateRecords, (updateErr, updatedCount) => {
                if (updateErr) {
                  console.error("Error updating records:", updateErr);
                  return res.status(500).json({
                    error: "Error updating records.",
                  });
                }

                console.log(`Inserted ${insertedCount} records, updated ${updatedCount} records`);
                return res.status(200).json({
                  message: "Form data submitted successfully!",
                  inserted: insertedCount,
                  updated: updatedCount,
                  duplicates: duplicateRecords,
                });
              });
            });
          } else {
            updateDuplicateRecords(duplicateRecords, (updateErr, updatedCount) => {
              if (updateErr) {
                console.error("Error updating records:", updateErr);
                return res.status(500).json({
                  error: "Error updating records.",
                });
              }

              return res.status(200).json({
                message: "No new records inserted.",
                updated: updatedCount,
                duplicates: duplicateRecords,
              });
            });
          }
        });
      } catch (err) {
        console.error("Error processing file:", err);
        res.status(500).json({ error: "Error processing file." });
      } finally {
        fs.unlinkSync(filePath); // Clean up the uploaded file
      }
    });
});

function insertInBatches(records, batchSize, callback) {
  let index = 0;
  let insertedCount = 0;

  function insertBatch() {
    const batch = records.slice(index, index + batchSize);
    if (batch.length === 0) {
      return callback(null, insertedCount);
    }

    const values = batch.map((record) => [record.name, record.email, record.contact]);
    const insertQuery = `INSERT INTO information (name, email, contact) VALUES ?`;

    connection.query(insertQuery, [values], (insertErr, result) => {
      if (insertErr) {
        return callback(insertErr, insertedCount);
      }

      insertedCount += result.affectedRows;
      index += batchSize;
      insertBatch();
    });
  }

  insertBatch();
}

function updateDuplicateRecords(records, callback) {
  let index = 0;
  let updatedCount = 0;

  function updateBatch() {
    const batch = records.slice(index, index + BATCH_SIZE);
    if (batch.length === 0) {
      return callback(null, updatedCount);
    }

    const updatePromises = batch.map((record) => {
      const updateQuery = `UPDATE information SET name = ?, contact = ? WHERE email = ?`;
      return new Promise((resolve, reject) => {
        connection.query(
          updateQuery,
          [record.name, record.contact, record.email],
          (updateErr, result) => {
            if (updateErr) {
              return reject(updateErr);
            }
            updatedCount += result.affectedRows;
            resolve();
          }
        );
      });
    });

    Promise.all(updatePromises)
      .then(() => {
        index += BATCH_SIZE;
        updateBatch();
      })
      .catch((updateErr) => callback(updateErr, updatedCount));
  }

  updateBatch();
}

app.get("/fetch", (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const fetchQuery = `SELECT * FROM information LIMIT ?, ?`;
  connection.query(fetchQuery, [offset, parseInt(limit)], (err, results) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.status(500).json({
        error: "Error fetching data.",
      });
    }

    const countQuery = `SELECT COUNT(*) AS total FROM information`;
    connection.query(countQuery, (countErr, countResult) => {
      if (countErr) {
        console.error("Error counting data:", countErr);
        return res.status(500).json({
          error: "Error counting data.",
        });
      }

      const total = countResult[0].total;
      res.status(200).json({
        message: "Data fetched successfully!",
        data: results,
        total,
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
