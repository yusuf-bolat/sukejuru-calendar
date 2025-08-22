import { NextApiRequest } from 'next'
import { supabase } from './supabaseClient'

export async function authenticateRequest(req: NextApiRequest) {
  const authHeader = req.headers.authorization
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized - No token provided')
  }
  
  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    throw new Error('Unauthorized - Invalid token')
  }
  
  return user
}

export function withAuth(handler: (req: NextApiRequest, res: any, user: any) => Promise<any>) {
  return async (req: NextApiRequest, res: any) => {
    try {
      const user = await authenticateRequest(req)
      return await handler(req, res, user)
    } catch (error: any) {
      return res.status(401).json({ error: error.message })
    }
  }
}
