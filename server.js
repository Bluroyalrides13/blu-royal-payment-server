
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const Database = require('./database');
require('dotenv').config();

const app = express();
app.use(express.json());

// PRODUCTION-READY CORS CONFIGURATION
app.use(cors({
  origin: [
    'https://www.bluroyalrides.com',
    'https://bluroyalrides.com', 
    'https://djblubloods.wixsite.com/blu-royal-rides',
    'https://blu-royal-rides.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'file://',
    null
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// REQUEST LOGGING
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51RigOrH5fnESKVai99NcFyaKX47FRbsV6rsApZT0B2HS6FkYn7z005RaTgeMN15ooNyM7veu4RC5O3lwogzJqVfe00xYb4wEwY');

// Initialize Database
const database = new Database();

// HEALTH CHECK ENDPOINT
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Blu Royal Rides Payment Server',
    version: '1.0.0'
  });
});

// Create Payment Intent Route with database integration
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { 
      amount, 
      customerEmail, 
      bookingDetails 
    } = req.body;

    // Create a PaymentIntent with more metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        customerEmail: customerEmail,
        bookingType: bookingDetails.serviceType,
        pickupLocation: bookingDetails.fromLocation
      },
      receipt_email: customerEmail
    });

    // Save booking to database
    await database.saveBooking({
      paymentIntentId: paymentIntent.id,
      amount,
      customerEmail,
      bookingDetails
    });

    // Send the client secret and additional info
    res.status(200).json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata
    });
  } catch (error) {
    console.error('Payment Intent Error:', error);
    res.status(500).json({ 
      error: 'Failed to create payment intent',
      details: error.message 
    });
  }
});

// Confirm Payment Route
app.post('/confirm-payment', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    // Retrieve the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Update booking status in database
    if (paymentIntent.status === 'succeeded') {
      await database.updateBookingStatus(paymentIntentId, 'completed');

      res.status(200).json({ 
        message: 'Payment successful',
        paymentDetails: {
          id: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          status: paymentIntent.status,
          metadata: paymentIntent.metadata
        }
      });
    } else {
      await database.updateBookingStatus(paymentIntentId, 'failed');

      res.status(400).json({ 
        message: 'Payment not completed',
        status: paymentIntent.status 
      });
    }
  } catch (error) {
    console.error('Payment Confirmation Error:', error);
    res.status(500).json({ 
      error: 'Failed to confirm payment',
      details: error.message 
    });
  }
});

// Test route for database
app.get('/test-bookings', async (req, res) => {
  try {
    const bookings = await database.getAllBookings();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ERROR HANDLING MIDDLEWARE
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 3002;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  database.close();
  server.close(() => {
    console.log('Server and database connection closed');
    process.exit(0);
  });
});
