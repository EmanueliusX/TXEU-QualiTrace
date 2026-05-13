require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb } = require('./database');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const operationsRoutes = require('./routes/operations');
const fieldsRoutes = require('./routes/fields');
const inspectionsRoutes = require('./routes/inspections');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Initialize DB
getDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/fields', fieldsRoutes);
app.use('/api/inspections', inspectionsRoutes);
app.use('/api/reports', reportsRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Eroare internă server' });
});

app.listen(PORT, () => {
  console.log(`QualiTrace API running on http://localhost:${PORT}`);
});
