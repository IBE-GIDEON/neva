import { NevaApp } from '@/neva/NevaApp';

/** Every in-app URL (/chats, /explore/…, /settings/…) renders the Neva web client, which routes panels on the client. */
export default function Page() {
  return <NevaApp />;
}
