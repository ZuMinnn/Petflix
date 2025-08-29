// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { addDoc, getFirestore, collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { toast } from "react-toastify";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBM0oxHuOUhjNcuIqJtyS6sz7vPDzW1bDU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "petflix-b7e10.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "petflix-b7e10",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "petflix-b7e10.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "534529916099",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:534529916099:web:0eb92a8dbae7d999edf676"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

//signUP Func
const signup = async (name, email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await addDoc(collection(db, "users"), {
      uid: user.uid,
      name,
      authProvider:"local",
      email
    });
  } catch (error) {
    console.error("Error signing up:", error);
    toast.error(error.code.split('/')[1].split('-').join(" ") );
  }
};
//login Func
const login = async (email, password) => {
    try {
        await signInWithEmailAndPassword(auth,email,password);
    } catch (error) {
        toast.error(error.code.split('/')[1].split('-').join(" ") );
    }
}

const logout =  () => {
    try {
         signOut(auth);
    } catch (error) {
        console.error("Error logging out:", error);
    }
};

// Get user data from Firestore
const getUserData = async (uid) => {
    try {
        if (!uid) return null;
        
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("uid", "==", uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data();
        }
        return null;
    } catch (error) {
        console.error("Error getting user data:", error);
        return null;
    }
};

// ============ WATCH HISTORY FUNCTIONS ============

// Save watch progress for a user
const saveWatchProgress = async (userId, movieSlug, episodeSlug, progressData) => {
    try {
        if (!userId || !movieSlug || !episodeSlug) {
            console.error('Missing required data for saving watch progress');
            return;
        }

        const docRef = doc(db, 'users', userId, 'watchHistory', movieSlug);
        const payload = {
            ...progressData,
            movieSlug,
            episodeSlug,
            updatedAt: new Date().getTime(),
            lastWatched: new Date()
        };

        await setDoc(docRef, payload, { merge: true });
    } catch (error) {
        console.error('❌ Error saving watch progress:', error);
    }
};

// Get all watch history for a user
const getUserWatchHistory = async (userId) => {
    try {
        if (!userId) {
            console.error('No user ID provided');
            return [];
        }

        const historyRef = collection(db, 'users', userId, 'watchHistory');
        const q = query(historyRef, orderBy('updatedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const history = [];
        querySnapshot.forEach((doc) => {
            history.push({
                id: doc.id,
                ...doc.data()
            });
                });
        
        return history;
    } catch (error) {
        console.error('❌ Error loading watch history:', error);
        return [];
    }
};

// Listen to real-time watch history updates
const subscribeToWatchHistory = (userId, callback) => {
    try {
        if (!userId) {
            console.error('No user ID provided for subscription');
            return () => {};
        }

        const historyRef = collection(db, 'users', userId, 'watchHistory');
        const q = query(historyRef, orderBy('updatedAt', 'desc'));
        
        return onSnapshot(q, (querySnapshot) => {
            const history = [];
            querySnapshot.forEach((doc) => {
                history.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            callback(history);
        });
    } catch (error) {
        console.error('❌ Error setting up watch history subscription:', error);
        return () => {};
    }
};

// Delete a specific movie from watch history
const deleteFromWatchHistory = async (userId, movieSlug) => {
    try {
        if (!userId || !movieSlug) {
            console.error('Missing user ID or movie slug');
            return;
        }

        const docRef = doc(db, 'users', userId, 'watchHistory', movieSlug);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('❌ Error deleting from watch history:', error);
    }
};

// Clear all watch history for a user
const clearAllWatchHistory = async (userId) => {
    try {
        if (!userId) {
            console.error('No user ID provided');
            return;
        }

        const historyRef = collection(db, 'users', userId, 'watchHistory');
        const querySnapshot = await getDocs(historyRef);
        
        const deletePromises = [];
        querySnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });

        await Promise.all(deletePromises);
    } catch (error) {
        console.error('❌ Error clearing watch history:', error);
    }
};

export { 
    auth, 
    db, 
    signup, 
    login, 
    logout,
    getUserData,
    saveWatchProgress,
    getUserWatchHistory,
    subscribeToWatchHistory,
    deleteFromWatchHistory,
    clearAllWatchHistory
};