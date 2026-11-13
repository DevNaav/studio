import { auth } from './firebase';

/** Returns the signed-in user's Firebase ID token, for calling AI server actions. */
export async function getIdTokenOrThrow(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to use AI features.');
  return user.getIdToken();
}
