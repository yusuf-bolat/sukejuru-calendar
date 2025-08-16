// API endpoint to securely provide OpenAI API key
export default function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get the API key from environment variables
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }
  
  // Return the API key
  res.status(200).json({ 
    apiKey: apiKey,
    configured: true 
  });
}
