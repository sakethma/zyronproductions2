const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign({ uid: "uid-1784139915410-851", email: "sakethma007@gmail.com", role: "admin" }, process.env.JWT_SECRET);

const req1 = http.get('http://localhost:3000/api/admin/analytics', { headers: { Authorization: `Bearer ${token}` } }, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Analytics Response:', data));
});

const req2 = http.get('http://localhost:3000/api/admin/events', { headers: { Authorization: `Bearer ${token}` } }, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Events Response:', data));
});
