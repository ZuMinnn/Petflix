import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './WatchHistory.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import MovieDetailsPanel from '../../components/MovieDetailsPanel/MovieDetailsPanel'
import { fetchMovieDetailBySlug } from '../../services/phimapi'
import { auth, getUserWatchHistory, subscribeToWatchHistory, deleteFromWatchHistory, clearAllWatchHistory, saveWatchProgress } from '../../firebase'
import { useAuthState } from 'react-firebase-hooks/auth'

const WatchHistory = () => {
  const navigate = useNavigate()
  const [user] = useAuthState(auth)
  const [watchHistory, setWatchHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [movieDetail, setMovieDetail] = useState(null)
  const [showDetails, setShowDetails] = useState(false)

  // Load watch history and setup real-time subscription
  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    loadWatchHistory()

    // Setup real-time subscription
    const unsubscribe = subscribeToWatchHistory(user.uid, (history) => {
      setWatchHistory(history)
    })

    return () => {
      unsubscribe()
    }
  }, [user, navigate])

  const loadWatchHistory = async () => {
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
  }

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
    
    // Debug Firebase (new system)
    if (user) {
      try {
        const firebaseHistory = await getUserWatchHistory(user.uid)
        
        alert(`
LocalStorage (old): ${progressKeys.length} entries
Firebase (new): ${firebaseHistory.length} entries
Xem console để biết chi tiết.`)
      } catch (e) {
        console.error('Error loading Firebase history:', e)
        alert(`
LocalStorage (old): ${progressKeys.length} entries
Firebase (new): Error loading
Xem console để biết chi tiết.`)
      }
    } else {
      alert(`Chưa đăng nhập! LocalStorage (old): ${progressKeys.length} entries`)
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
              🔄 Làm mới
            </button>
            <button onClick={debugLocalStorage} className='debug-btn'>
              🐛 Debug
            </button>
            <button onClick={createTestData} className='test-btn'>
              🧪 Test Data
            </button>
            <button onClick={manualSaveProgress} className='manual-btn'>
              💾 Manual Save
            </button>
            {watchHistory.length > 0 && (
              <button onClick={clearHistory} className='clear-btn'>
                🗑️ Xóa tất cả
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
                    <div className='history-poster'>
                      <div className='history-placeholder'>
                        📺
                      </div>
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
                          ℹ️ Chi tiết
                        </button>
                      </div>
                    </div>
                    <div className='history-info'>
                      <h3 className='history-title'>{item.title || 'Không rõ tên'}</h3>
                      <p className='history-episode'>
                        Tập: {item.episodeSlug || 'N/A'}
                      </p>
                      <p className='history-progress'>
                        Đã xem: {formatProgress(item.currentTime, item.duration)}
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
