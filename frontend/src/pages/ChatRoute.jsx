import Chat from './Chat';
import Inbox from './Inbox';
import useIsDesktop from '../utils/useIsDesktop';

// /chat/:listingId opens the two-pane Messages page on wide screens
// and the full-screen chat on phones
export default function ChatRoute() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <Inbox /> : <Chat />;
}