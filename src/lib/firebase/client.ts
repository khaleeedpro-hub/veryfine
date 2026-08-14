import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import config from '../../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const dbId = (config as any).firestoreDatabaseId || (config as any).databaseId || 'ai-studio-veryfineinvestus-57aad29a-d7de-45e5-b2a3-09f72df87a39';
export const auth = getAuth(app);
export const db = getFirestore(app, dbId);
