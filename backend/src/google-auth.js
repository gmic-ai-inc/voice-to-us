// Verifies a Google access_token returned by Google Identity Services'
// initTokenClient flow, and returns the user's verified email + name.
//
// Two HTTP calls:
//   1. tokeninfo  — verifies the token belongs to OUR OAuth client
//                   (audience check) and isn't expired.
//   2. userinfo   — fetches the email + name attached to that token.

export async function verifyGoogleAccessToken(accessToken) {
  if (!accessToken) throw new Error('Missing access_token');

  const expectedAudience = process.env.GOOGLE_CLIENT_ID;
  if (!expectedAudience) {
    throw new Error('GOOGLE_CLIENT_ID not configured on server');
  }

  // Audience check — confirm the token was issued to our OAuth client and
  // isn't expired. Without this, anyone could submit a token they obtained
  // for a different application and we'd accept it.
  const tokenInfoUrl =
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`;
  const tokenInfoResp = await fetch(tokenInfoUrl);
  if (!tokenInfoResp.ok) {
    const body = await tokenInfoResp.text().catch(() => '');
    throw new Error(`tokeninfo ${tokenInfoResp.status}: ${body.slice(0, 200)}`);
  }
  const tokenInfo = await tokenInfoResp.json();
  if (tokenInfo.aud !== expectedAudience) {
    throw new Error(`audience mismatch (got ${tokenInfo.aud})`);
  }
  if (Number(tokenInfo.exp || 0) < Math.floor(Date.now() / 1000)) {
    throw new Error('access_token expired');
  }

  // Profile fetch — email + name come from the userinfo endpoint.
  const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userInfoResp.ok) {
    const body = await userInfoResp.text().catch(() => '');
    throw new Error(`userinfo ${userInfoResp.status}: ${body.slice(0, 200)}`);
  }
  const userInfo = await userInfoResp.json();

  return {
    email: userInfo.email,
    emailVerified: userInfo.email_verified === true,
    name: userInfo.name,
    sub: userInfo.sub,
  };
}
