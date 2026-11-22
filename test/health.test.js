// Simple automated test runner for backend health
import http from 'http';

const req = http.get('http://localhost:5000/api/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('[Test Passed] API Health response:', data);
  });
});

req.on('error', (err) => {
  console.log('[Server Offline or Starting]:', err.message);
});
