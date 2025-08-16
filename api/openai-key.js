// Vercel serverless function to provide OpenAI API key
module.exports = (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get the API key from environment variables
  const apiKey = process.env.OPENAI_API_KEY;
  
  // Debug logging (will show in Vercel function logs)
  console.log('Environment check:', {
    hasApiKey: !!apiKey,
    keyLength: apiKey ? apiKey.length : 0,
    startsWithSk: apiKey ? apiKey.startsWith('sk-') : false
  });
  
  if (!apiKey) {
    console.log('API key missing from environment');
    return res.status(500).json({ 
      error: 'OpenAI API key not configured',
      debug: 'Environment variable OPENAI_API_KEY is missing'
    });
  }
  
  // Return the API key
  console.log('API key found, returning to client');
  return res.status(200).json({ 
    apiKey: apiKey,
    configured: true,
    debug: 'API key successfully retrieved from environment'
  });
};
