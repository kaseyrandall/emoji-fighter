// Google Analytics for the website only: the app store builds collect no
// data (and so need no tracking disclosures). Same calls as react-ga4.
import ReactGA from 'react-ga4';
import { isNative } from './native';

type EventArgs = Parameters<typeof ReactGA.event>[0];
type SendArgs = Parameters<typeof ReactGA.send>[0];

const analytics = {
  initialize: (id: string) => {
    if (!isNative) ReactGA.initialize(id);
  },
  event: (e: EventArgs) => {
    if (!isNative) ReactGA.event(e);
  },
  send: (s: SendArgs) => {
    if (!isNative) ReactGA.send(s);
  },
};

export default analytics;
