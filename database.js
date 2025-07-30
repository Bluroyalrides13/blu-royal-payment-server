const sqlite3 = require('sqlite3').verbose();

class Database {
  constructor(dbPath = './bookings.db') {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
      } else {
        console.log('Connected to SQLite database');
        this.createTables();
      }
    });
  }

  createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paymentIntentId TEXT UNIQUE,
        serviceType TEXT,
        fromLocation TEXT,
        toLocation TEXT,
        customerEmail TEXT,
        amount REAL,
        status TEXT DEFAULT 'pending',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  saveBooking(bookingData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO bookings (
          paymentIntentId, 
          serviceType, 
          fromLocation, 
          toLocation, 
          customerEmail, 
          amount
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        bookingData.paymentIntentId,
        bookingData.bookingDetails.serviceType,
        bookingData.bookingDetails.fromLocation,
        bookingData.bookingDetails.toLocation || null,
        bookingData.customerEmail,
        bookingData.amount,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );

      stmt.finalize();
    });
  }

  updateBookingStatus(paymentIntentId, status) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE bookings SET status = ? WHERE paymentIntentId = ?`,
        [status, paymentIntentId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  async getAllBookings() {
  return new Promise((resolve, reject) => {
    this.db.all('SELECT * FROM bookings ORDER BY createdAt DESC', [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}
close() {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

module.exports = Database;
