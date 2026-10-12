// OPTIONAL: online mode with Firebase (works when the site is hosted on the internet).
// Leave FIREBASE_CONFIG as null to use the local server (start-server.bat) on the restaurant WiFi.
//
// To enable: create a free project at https://console.firebase.google.com, add a Web app,
// enable Cloud Firestore, then paste the config object here. See README.md for details.
window.FIREBASE_CONFIG = null;
/* Example:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};
*/

// Staff PIN for the kitchen screen in Firebase mode (in local-server mode the PIN is set in server.ps1).
window.STAFF_PIN = "1234";
