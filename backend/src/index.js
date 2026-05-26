require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./database');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const operationsRoutes = require('./routes/operations');
const fieldsRoutes = require('./routes/fields');
const inspectionsRoutes = require('./routes/inspections');
const reportsRoutes = require('./routes/reports');
const capabilityRoutes = require('./routes/capability');

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
app.use('/api/capability', capabilityRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve static frontend (factory floor access via http://server:3001)
const publicPath = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  app.get('*', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Eroare internă server' });
});

app.listen(PORT, () => {
  console.log(`QualiTrace API running on http://localhost:${PORT}`);
});
