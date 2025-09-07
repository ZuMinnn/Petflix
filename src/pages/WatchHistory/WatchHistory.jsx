import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import './WatchHistory.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import MovieDetailsPanel from '../../components/MovieDetailsPanel/MovieDetailsPanel'
import { fetchMovieDetailBySlug } from '../../services/phimapi'
import { auth, getUserWatchHistory, subscribeToWatchHistory, deleteFromWatchHistory, clearAllWatchHistory, saveWatchProgress } from '../../firebase'
import { useAuthState } from 'react-firebase-hooks/auth'

// Global cache để tránh gọi API trùng lặp
const posterCache = new Map()
const loadingQueue = new Set()

// Rate limiter để tránh spam API
let lastApiCall = 0
const API_DELAY = 1000 // 1 giây giữa mỗi API call

// Cache key cho localStorage
const CACHE_KEY = 'moviePosterCache'
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 ngày

// Load cache từ localStorage
const loadCacheFromStorage = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      const now = Date.now()
      
      // Filter out expired entries
      const validEntries = Object.entries(parsed).filter(([, value]) => {
        return value.timestamp && (now - value.timestamp) < CACHE_EXPIRY
      })
      
      // Convert back to Map
      validEntries.forEach(([key, value]) => {
        posterCache.set(key, value.url)
      })
      
      // Update localStorage with only valid entries
      if (validEntries.length !== Object.keys(parsed).length) {
        const validCache = Object.fromEntries(
          validEntries.map(([key, value]) => [key, value])
        )
        localStorage.setItem(CACHE_KEY, JSON.stringify(validCache))
      }
    }
  } catch (error) {
    console.error('Error loading poster cache:', error)
  }
}

// Save cache to localStorage
const saveCacheToStorage = (movieSlug, posterUrl) => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    const cache = cached ? JSON.parse(cached) : {}
    
    cache[movieSlug] = {
      url: posterUrl,
      timestamp: Date.now()
    }
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    console.error('Error saving poster cache:', error)
  }
}

// Initialize cache from localStorage
loadCacheFromStorage()

// Clear old cache entries
const clearOldCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      const now = Date.now()
      
      // Keep only entries newer than 7 days
      const validEntries = Object.entries(parsed).filter(([, value]) => {
        return value.timestamp && (now - value.timestamp) < CACHE_EXPIRY
      })
      
      const validCache = Object.fromEntries(validEntries)
      localStorage.setItem(CACHE_KEY, JSON.stringify(validCache))
      
      // Update in-memory cache
      posterCache.clear()
      validEntries.forEach(([key, value]) => {
        posterCache.set(key, value.url)
      })
      
      return validEntries.length
    }
  } catch (error) {
    console.error('Error clearing old cache:', error)
  }
  return 0
}

const MoviePoster = ({ movieSlug, title, index = 0 }) => {
  const [posterUrl, setPosterUrl] = useState(null)
  const [imageError, setImageError] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadPosterWithDelay = async () => {
      if (!movieSlug || posterCache.has(movieSlug) || loadingQueue.has(movieSlug)) {
        // Nếu đã có cache hoặc đang loading, sử dụng cache
        const cached = posterCache.get(movieSlug)
        if (cached) {
          setPosterUrl(cached)
        }
        return
      }

      // Thêm delay dựa trên index để tránh gọi API cùng lúc
      const delay = index * 800 + Math.random() * 500 // Stagger loading
      
      setTimeout(async () => {
        if (loadingQueue.has(movieSlug)) return
        
        loadingQueue.add(movieSlug)
        setLoading(true)

        try {
          // Rate limiting
          const now = Date.now()
          const timeSinceLastCall = now - lastApiCall
          if (timeSinceLastCall < API_DELAY) {
            await new Promise(resolve => setTimeout(resolve, API_DELAY - timeSinceLastCall))
          }
          lastApiCall = Date.now()

          const detail = await fetchMovieDetailBySlug(movieSlug)
          let url = null
          
          if (detail?.movie?.poster_url) {
            url = detail.movie.poster_url
          } else if (detail?.movie?.thumb_url) {
            url = detail.movie.thumb_url
          }

          if (url) {
            posterCache.set(movieSlug, url)
            saveCacheToStorage(movieSlug, url)
            setPosterUrl(url)
          } else {
            posterCache.set(movieSlug, 'error')
            setImageError(true)
          }
        } catch (error) {
          console.error(`Error loading poster for ${movieSlug}:`, error)
          posterCache.set(movieSlug, 'error')
          setImageError(true)
        } finally {
          setLoading(false)
          loadingQueue.delete(movieSlug)
        }
      }, delay)
    }

    loadPosterWithDelay()
  }, [movieSlug, index])

  const handleImageError = () => {
    setImageError(true)
    posterCache.set(movieSlug, 'error')
  }

  if (loading) {
    return (
      <div className='history-poster'>
        <div className='history-placeholder loading-placeholder'>
          ⏳
        </div>
      </div>
    )
  }

  if (!posterUrl || imageError || posterCache.get(movieSlug) === 'error') {
    return (
      <div className='history-poster'>
        <div className='history-placeholder'>
          📺
        </div>
      </div>
    )
  }

  return (
    <div className='history-poster'>
      <img 
        src={posterUrl} 
        alt={title || 'Movie poster'} 
        className='history-poster-image'
        onError={handleImageError}
        loading="lazy"
      />
    </div>
  )
}

const WatchHistory = () => {
  const navigate = useNavigate()
  const [user] = useAuthState(auth)
  const [watchHistory, setWatchHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [movieDetail, setMovieDetail] = useState(null)
  const [showDetails, setShowDetails] = useState(false)

  const loadWatchHistory = useCallback(async () => {
    try {
      setLoading(true)
      
      if (!user) {
        setWatchHistory([])
        return
      }
      
      const history = await getUserWatchHistory(user.uid)
      
      setWatchHistory(history)
    } catch (error) {
      console.error('❌ Error loading watch history:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Load watch history and setup real-time subscription
  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    // Clean up old cache entries on mount
    clearOldCache()

    loadWatchHistory()

    // Setup real-time subscription
    const unsubscribe = subscribeToWatchHistory(user.uid, (history) => {
      setWatchHistory(history)
    })

    return () => {
      unsubscribe()
    }
  }, [user, navigate, loadWatchHistory])

  // Clear all watch history
  const clearHistory = async () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử xem phim?')) {
      try {
        if (!user) return
        
        await clearAllWatchHistory(user.uid)
        setWatchHistory([])
        
      } catch (error) {
        console.error('❌ Error clearing history:', error)
      }
    }
  }

  // Remove single movie from history
  const removeFromHistory = async (movieSlug) => {
    try {
      if (!user) return
      
      await deleteFromWatchHistory(user.uid, movieSlug)
      
      // Update state
      setWatchHistory(prev => prev.filter(item => item.movieSlug !== movieSlug))
      
    } catch (error) {
      console.error('❌ Error removing from history:', error)
    }
  }

  // Continue watching
  const continueWatching = (historyItem) => {
    const state = {
      title: historyItem.title,
      movieSlug: historyItem.movieSlug,
      episodeSlug: historyItem.episodeSlug,
      returnPath: '/watch-history'
    }
    
    navigate('/watch', { state })
  }

  // View movie details
  const viewMovieDetails = async (historyItem) => {
    setSelectedMovie({
      slug: historyItem.movieSlug,
      name: historyItem.title
    })
    setMovieDetail(null)
    setShowDetails(true)
    
    try {
      const detail = await fetchMovieDetailBySlug(historyItem.movieSlug)
      setMovieDetail(detail)
    } catch (error) {
      console.error('Error fetching movie details:', error)
    }
  }

  // Format watch time
  const formatWatchTime = (updatedAt) => {
    if (!updatedAt) return 'Không rõ'
    
    const now = Date.now()
    const diff = now - updatedAt
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))
    
    if (days > 0) return `${days} ngày trước`
    if (hours > 0) return `${hours} giờ trước`
    if (minutes > 0) return `${minutes} phút trước`
    return 'Vừa xem'
  }

  // Format progress
  const formatProgress = (currentTime, duration) => {
    if (!duration || duration <= 0) return '0%'
    const percent = Math.round((currentTime / duration) * 100)
    return `${Math.min(100, Math.max(0, percent))}%`
  }

  // Debug Firebase + localStorage
  const debugLocalStorage = async () => {
    // Debug localStorage (old system)
    const progressKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('watchProgress:')) {
        progressKeys.push(key)
      }
    }
    
    // Debug poster cache
    const posterCacheData = localStorage.getItem(CACHE_KEY)
    const posterCacheCount = posterCacheData ? Object.keys(JSON.parse(posterCacheData)).length : 0
    
    // Debug Firebase (new system)
    if (user) {
      try {
        const firebaseHistory = await getUserWatchHistory(user.uid)
        
        alert(`
LocalStorage (old): ${progressKeys.length} entries
Firebase (new): ${firebaseHistory.length} entries
Poster Cache: ${posterCacheCount} entries
Xem console để biết chi tiết.`)
      } catch (e) {
        console.error('Error loading Firebase history:', e)
        alert(`
LocalStorage (old): ${progressKeys.length} entries
Firebase (new): Error loading
Poster Cache: ${posterCacheCount} entries
Xem console để biết chi tiết.`)
      }
    } else {
      alert(`Chưa đăng nhập! 
LocalStorage (old): ${progressKeys.length} entries
Poster Cache: ${posterCacheCount} entries`)
    }
  }

  // Clear poster cache
  const clearPosterCache = () => {
    if (window.confirm('Bạn có chắc muốn xóa cache hình ảnh poster? Điều này sẽ làm chậm lần tải tiếp theo.')) {
      try {
        localStorage.removeItem(CACHE_KEY)
        posterCache.clear()
        alert('✅ Đã xóa cache poster thành công!')
      } catch (error) {
        console.error('Error clearing poster cache:', error)
        alert('❌ Lỗi khi xóa cache poster!')
      }
    }
  }

  // Create test data
  const createTestData = async () => {
    if (!user) {
      alert('Vui lòng đăng nhập trước!')
      return
    }

    const testEntries = [
      {
        movieSlug: 'john-wick-4',
        episodeSlug: 'tap-1',
        data: {
          currentTime: 1800, // 30 minutes
          duration: 3600, // 1 hour
          title: 'John Wick 4 - Tập 1'
        }
      },
      {
        movieSlug: 'avengers-endgame',
        episodeSlug: 'full-movie',
        data: {
          currentTime: 5400, // 1.5 hours
          duration: 10800, // 3 hours
          title: 'Avengers Endgame - Full Movie'
        }
      },
      {
        movieSlug: 'spider-man-homecoming',
        episodeSlug: 'episode-5',
        data: {
          currentTime: 900, // 15 minutes
          duration: 2400, // 40 minutes
          title: 'Spider-Man Homecoming - Episode 5'
        }
      }
    ]

    try {
      for (const entry of testEntries) {
        await saveWatchProgress(user.uid, entry.movieSlug, entry.episodeSlug, entry.data)
      }
      
      alert('🔥 Đã tạo test data lên Firebase! Click "Làm mới" để xem.')
      loadWatchHistory()
    } catch (error) {
      console.error('❌ Error creating test data:', error)
      alert('Lỗi tạo test data!')
    }
  }

  // Manual test to save current movie being viewed
  const manualSaveProgress = async () => {
    if (!user) {
      alert('Vui lòng đăng nhập trước!')
      return
    }

    const movieSlug = `test-movie-${Date.now()}`
    const episodeSlug = 'episode-1'
    const testData = {
      currentTime: 300, // 5 minutes
      duration: 1800, // 30 minutes
      title: `Test Movie - ${new Date().toLocaleTimeString()}`
    }
    
    try {
      await saveWatchProgress(user.uid, movieSlug, episodeSlug, testData)
      alert('🔥 Đã lưu test progress lên Firebase! Click "Làm mới" để xem.')
      loadWatchHistory()
    } catch (error) {
      console.error('❌ Error saving manual progress:', error)
      alert('Lỗi lưu test progress!')
    }
  }

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <div className='watch-history-page'>
      <Navbar />
      
      <div className='watch-history-container'>
        {/* Header */}
        <div className='history-header'>
          <button onClick={() => navigate('/')} className='back-btn'>
            ← Trang chủ
          </button>
          <h1>Phim đã xem</h1>
          <div className='history-actions'>
            <button onClick={loadWatchHistory} className='refresh-btn'>
               Làm mới
            </button>
            <button onClick={debugLocalStorage} className='debug-btn'>
              🐛 Debug
            </button>
            <button onClick={clearPosterCache} className='clear-cache-btn'>
              🗑️ Clear Cache
            </button>
            <button onClick={createTestData} className='test-btn'>
              🧪 Test Data
            </button>
            <button onClick={manualSaveProgress} className='manual-btn'>
              💾 Manual Save
            </button>
            {watchHistory.length > 0 && (
              <button onClick={clearHistory} className='clear-btn'>
                 Xóa tất cả
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className='history-loading'>
            <div className='loading-spinner'></div>
            <p>Đang tải lịch sử xem phim...</p>
          </div>
        ) : (
          <>
            {/* History Grid */}
            {watchHistory.length > 0 ? (
              <div className='history-grid'>
                                 {watchHistory.map((item, index) => (
                   <div key={item.id || item.movieSlug || index} className='history-card'>
                    <div className='history-poster-container'>
                      <MoviePoster 
                        movieSlug={item.movieSlug} 
                        title={item.title}
                        index={index}
                      />
                      <div className='history-progress-bar'>
                        <div 
                          className='history-progress-fill'
                          style={{ width: formatProgress(item.currentTime, item.duration) }}
                        ></div>
                      </div>
                      <div className='history-overlay'>
                        <button 
                          className='continue-btn'
                          onClick={() => continueWatching(item)}
                        >
                          ▶ Tiếp tục
                        </button>
                        <button 
                          className='details-btn'
                          onClick={() => viewMovieDetails(item)}
                        >
                           Chi tiết
                        </button>
                      </div>
                    </div>
                    <div className='history-info'>
                      <h3 className='history-title'>{item.title || 'Không rõ tên'}</h3>
                      <p className='history-episode'>
                        Tậ nep: {item.episodeSlug || 'N/A'}
                      </p>
                      <p className='history-progress'>
                        Đã xem
                      </p>
                      <p className='history-time'>
                        {formatWatchTime(item.updatedAt)}
                      </p>
                      <button 
                        className='remove-btn'
                        onClick={() => removeFromHistory(item.movieSlug)}
                      >
                        ✕ Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='history-empty'>
                <div className='empty-icon'>📺</div>
                <h2>Chưa có phim nào trong lịch sử</h2>
                <p>Bắt đầu xem phim để theo dõi tiến độ của bạn</p>
                
                <div className='debug-info'>
                  <h3>🔧 Debug Steps:</h3>
                  <ol>
                    <li>Click <strong>"🐛 Debug"</strong> để kiểm tra localStorage</li>
                    <li>Click <strong>"🧪 Test Data"</strong> để tạo dữ liệu mẫu</li>
                    <li>Hoặc đi xem phim thật và quay lại</li>
                  </ol>
                  <p><strong>Lưu ý:</strong> Chỉ phim có movieSlug và episodeSlug mới được track</p>
                </div>
                
                <div className='action-buttons'>
                  <button 
                    onClick={() => navigate('/simple-movies?page=1')} 
                    className='browse-btn'
                  >
                    Khám phá phim
                  </button>
                  <button 
                    onClick={createTestData} 
                    className='test-data-btn'
                  >
                    🧪 Tạo dữ liệu test
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      <Footer />
      
      {/* Movie Details Panel */}
      <MovieDetailsPanel 
        open={showDetails} 
        onClose={() => setShowDetails(false)} 
        movie={selectedMovie} 
        detail={movieDetail} 
      />
    </div>
  )
}

export default WatchHistory
