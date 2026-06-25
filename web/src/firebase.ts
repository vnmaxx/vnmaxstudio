import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDPZdmgh4-pvbzyqik4uGci_0Pvc-xkpGg',
  authDomain: 'studio-ia-cd03a.firebaseapp.com',
  projectId: 'studio-ia-cd03a',
  storageBucket: 'studio-ia-cd03a.firebasestorage.app',
  messagingSenderId: '426018851278',
  appId: '1:426018851278:web:538cacabf60a0c42c7039f',
  measurementId: 'G-N7WKMR2825',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
