import { Redirect } from 'expo-router';

/**
 * OAuth deep-link landing route. The in-app browser session normally captures this URL itself;
 * if the OS opens the app via the link instead, send the user to the right place.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
