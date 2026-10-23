import { OAuth2Client } from 'google-auth-library';

let clientInstance = null;

const getOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientInstance) {
    clientInstance = new OAuth2Client(clientId);
  }
  return clientInstance;
};

/**
 * Verifies a Google ID token and returns the normalized payload.
 *
 * @param {string} idToken - The Google ID token string received from the client.
 * @param {object} [options] - Verification options.
 * @param {string} [options.clientId] - Optional override for Google Client ID.
 * @param {object} [options.customVerifier] - Optional custom verifier for unit testing.
 * @returns {Promise<{ sub: string, email: string, email_verified: boolean, name?: string, picture?: string }>}
 */
export const verifyGoogleIdToken = async (idToken, { clientId, customVerifier } = {}) => {
  if (!idToken || typeof idToken !== 'string') {
    const error = new Error('Google identity token is required.');
    error.status = 400;
    throw error;
  }

  // Allow custom verifier injection (e.g. for deterministic unit tests)
  if (customVerifier) {
    return customVerifier(idToken);
  }

  const expectedClientId = clientId || process.env.GOOGLE_CLIENT_ID;
  if (!expectedClientId) {
    const error = new Error('GOOGLE_CLIENT_ID is not configured on the server.');
    error.status = 503;
    throw error;
  }

  const client = getOAuthClient();
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: expectedClientId,
    });
  } catch (verifyError) {
    const error = new Error('Invalid or expired Google identity token.');
    error.status = 401;
    throw error;
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    const error = new Error('Invalid Google identity payload.');
    error.status = 401;
    throw error;
  }

  return {
    sub: payload.sub,
    email: payload.email ? payload.email.toLowerCase().trim() : '',
    email_verified: Boolean(payload.email_verified),
    name: payload.name || payload.given_name || '',
    picture: payload.picture || '',
  };
};

export default {
  verifyGoogleIdToken,
};
