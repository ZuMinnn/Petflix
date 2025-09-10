// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { addDoc, getFirestore, collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, onSnapshot, where, limit, startAfter } from "firebase/firestore";
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

// ============ MOVIE DATABASE FUNCTIONS ============

// Lấy danh sách phim từ database
const getMovies = async (limitCount = 50, orderByField = 'modified', orderDirection = 'desc') => {
    try {
        const moviesRef = collection(db, 'movies');
        const q = query(
            moviesRef, 
            orderBy(orderByField, orderDirection), 
            limit(limitCount)
        );
        const querySnapshot = await getDocs(q);
        
        const movies = [];
        querySnapshot.forEach((doc) => {
            movies.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return movies;
    } catch (error) {
        console.error('❌ Error getting movies:', error);
        return [];
    }
};

// Cache cho tìm kiếm
let moviesCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 phút

// Function để clear cache
const clearMoviesCache = () => {
    moviesCache = null;
    cacheTimestamp = 0;
};

// Tìm kiếm phim trong database với cache
const searchMovies = async (keyword, limitCount = 20) => {
    try {
        if (!keyword || keyword.trim() === '') {
            return [];
        }

        // Kiểm tra cache
        const now = Date.now();
        if (!moviesCache || (now - cacheTimestamp) > CACHE_DURATION) {
            
            // Lấy phim với pagination
            const moviesRef = collection(db, 'movies');
            const allMovies = [];
            let lastDoc = null;
            const batchSize = 1000; // Firestore limit
            const maxBatches = 8; // Tối đa 8,000 phim để tránh timeout
            
            for (let i = 0; i < maxBatches; i++) {
                let q;
                if (lastDoc) {
                    q = query(
                        moviesRef,
                        orderBy('modified', 'desc'),
                        startAfter(lastDoc),
                        limit(batchSize)
                    );
                } else {
                    q = query(
                        moviesRef,
                        orderBy('modified', 'desc'),
                        limit(batchSize)
                    );
                }
                
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) break;
                
                querySnapshot.forEach((doc) => {
                    allMovies.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
                
                // Nếu lấy được ít hơn batchSize thì đã hết dữ liệu
                if (querySnapshot.docs.length < batchSize) break;
            }
            
            moviesCache = allMovies;
            cacheTimestamp = now;
        }

        // Filter trong JavaScript - tìm kiếm toàn diện
        const keywordLower = keyword.toLowerCase().trim();
        const filteredMovies = moviesCache.filter(movie => {
            // Tìm kiếm trong tên phim
            const nameMatch = movie.name && movie.name.toLowerCase().includes(keywordLower);
            const originNameMatch = movie.origin_name && movie.origin_name.toLowerCase().includes(keywordLower);
            
            // Tìm kiếm trong mô tả
            const contentMatch = movie.content && movie.content.toLowerCase().includes(keywordLower);
            
            // Tìm kiếm trong diễn viên
            const actorsMatch = movie.actors && Array.isArray(movie.actors) && 
                movie.actors.some(actor => actor.toLowerCase().includes(keywordLower));
            
            // Tìm kiếm trong đạo diễn
            const directorsMatch = movie.directors && Array.isArray(movie.directors) && 
                movie.directors.some(director => director.toLowerCase().includes(keywordLower));
            
            // Tìm kiếm trong thể loại
            const categoryMatch = movie.category && Array.isArray(movie.category) && 
                movie.category.some(cat => 
                    cat.name && cat.name.toLowerCase().includes(keywordLower) ||
                    cat.slug && cat.slug.toLowerCase().includes(keywordLower)
                );
            
            // Tìm kiếm trong quốc gia
            const countryMatch = movie.country && Array.isArray(movie.country) && 
                movie.country.some(country => 
                    country.name && country.name.toLowerCase().includes(keywordLower) ||
                    country.slug && country.slug.toLowerCase().includes(keywordLower)
                );
            
            // Tìm kiếm trong tags
            const tagsMatch = movie.tags && Array.isArray(movie.tags) && 
                movie.tags.some(tag => tag.toLowerCase().includes(keywordLower));
            
            // Tìm kiếm trong năm
            const yearMatch = movie.year && movie.year.toString().includes(keywordLower);
            
            
            return nameMatch || originNameMatch || contentMatch || actorsMatch || 
                   directorsMatch || categoryMatch || countryMatch || tagsMatch || yearMatch;
        });

        // Nếu không tìm thấy kết quả, thử tìm kiếm trực tiếp
        if (filteredMovies.length === 0) {
            
            try {
                const moviesRef = collection(db, 'movies');
                const q = query(
                    moviesRef,
                    orderBy('modified', 'desc'),
                    limit(1000)
                );
                const querySnapshot = await getDocs(q);
                
                const directResults = [];
                querySnapshot.forEach((doc) => {
                    const movie = {
                        id: doc.id,
                        ...doc.data()
                    };
                    
                    // Tìm kiếm trực tiếp
                    const nameMatch = movie.name && movie.name.toLowerCase().includes(keywordLower);
                    const originNameMatch = movie.origin_name && movie.origin_name.toLowerCase().includes(keywordLower);
                    
                    if (nameMatch || originNameMatch) {
                        directResults.push(movie);
                    }
                });
                
                return directResults.slice(0, limitCount);
            } catch (directError) {
                console.error('❌ Lỗi tìm kiếm trực tiếp:', directError);
            }
        }

        return filteredMovies.slice(0, limitCount);
    } catch (error) {
        console.error('❌ Error searching movies:', error);
        return [];
    }
};

// Lấy chi tiết phim từ database
const getMovieDetails = async (slug) => {
    try {
        const detailsRef = doc(db, 'movieDetails', slug);
        const detailsDoc = await getDocs(detailsRef);
        
        if (detailsDoc.exists()) {
            return {
                id: detailsDoc.id,
                ...detailsDoc.data()
            };
        }
        
        return null;
    } catch (error) {
        console.error(`❌ Error getting movie details for ${slug}:`, error);
        return null;
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
    clearAllWatchHistory,
    // Movie database functions
    getMovies,
    searchMovies,
    getMovieDetails,
    clearMoviesCache
};