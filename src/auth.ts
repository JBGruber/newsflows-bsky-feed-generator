import express from 'express'
import { verifyJwt, AuthRequiredError, parseReqNsid } from '@atproto/xrpc-server'
import { DidResolver } from '@atproto/identity'
import jwt from 'jsonwebtoken'

export const validateAuth = async (
  req: express.Request,
  serviceDid: string,
  didResolver: DidResolver,
): Promise<string> => {
  const { authorization = '' } = req.headers
  if (!authorization.startsWith('Bearer ')) {
    throw new AuthRequiredError()
  }
  const jwt = authorization.replace('Bearer ', '').trim()
  const nsid = parseReqNsid(req)
  const parsed = await verifyJwt(jwt, serviceDid, nsid, async (did: string) => {
    return didResolver.resolveAtprotoKey(did)
  })
  return parsed.iss
}


export const extractDidFromAuth = async (
  req: express.Request,
): Promise<string> => {
  const { authorization = '' } = req.headers
  if (!authorization.startsWith('Bearer ')) {
    throw new AuthRequiredError()
  }
  
  const token = authorization.replace('Bearer ', '').trim()
  
  try {
    // Decode the JWT without verifying (passing true as the second parameter)
    const decoded = jwt.decode(token, { complete: true })
    
    if (!decoded || typeof decoded !== 'object' || !decoded.payload) {
      throw new Error('Invalid JWT format')
    }
    
    // Extract the issuer (which is the DID)
    const did = decoded.payload.iss
    
    if (!did || typeof did !== 'string') {
      throw new Error('JWT missing issuer (iss) claim')
    }
    
    return did
    
  } catch (error) {
    console.error('Error extracting DID from JWT:', error)
    throw new AuthRequiredError('Invalid authentication token')
  }
}