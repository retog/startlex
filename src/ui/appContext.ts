/**
 * Application-wide service singletons, wired once. React components get
 * them via this module; the core never imports React or the web services.
 */
import { WebAudioScheduler } from '../audio/webAudioScheduler';
import { IndexedDbSessionRepository } from '../storage/indexedDbRepository';

export const scheduler = new WebAudioScheduler();
export const repository = new IndexedDbSessionRepository();
