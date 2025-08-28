import React, { useEffect, useMemo, useState, useRef } from 'react'
import './Search.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import MovieDetailsPanel from '../../components/MovieDetailsPanel/MovieDetailsPanel'
import { searchMovies, fetchMovieDetailBySlug } from '../../services/phimapi'
import { fetchTmdbById, buildTmdbImagePath } from '../../services/tmdb'

const Search = () => {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchHistory, setSearchHistory] = useState([])
  const [filters, setFilters] = useState({
    category: '',
    country: '',
    year: '',
    sort_lang: ''
  })
  
  // MovieDetailsPanel state
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [movieDetail, setMovieDetail] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  
  const searchInputRef = useRef(null)
  const title = useMemo(() => 'Tìm kiếm', [])

  // Load search history from localStorage
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]')
    setSearchHistory(history.slice(0, 5)) // Top 5 searches
  }, [])

  // Search movies effect
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!keyword.trim()) { 
        setItems([])
        setShowSuggestions(false)
        return 
      }
      
      try {
        setLoading(true)
        setError('')
        
        const searchParams = { 
          keyword: keyword.trim(), 
          page, 
          limit: 30,
          ...filters
        }
        
        const data = await searchMovies(searchParams)
        const list = Array.isArray(data?.items || data?.data) ? (data.items || data.data) : []
        
        // Only show movies with TMDB for better quality
        const moviesWithTmdb = list.filter(it => it?.tmdb?.id)
        
        const enriched = await Promise.all(moviesWithTmdb.map(async (it) => {
          const tmdbId = it?.tmdb?.id
          const mediaType = it?.type === 'series' ? 'tv' : 'movie'
          try {
            const tmdb = await fetchTmdbById(tmdbId, mediaType)
            return {
              ...it,
              _tmdb: tmdb,
              _poster: buildTmdbImagePath(tmdb?.poster_path, 'w342') || it?.poster_url || '',
              _backdrop: buildTmdbImagePath(tmdb?.backdrop_path, 'w780') || it?.thumb_url || '',
            }
          } catch (e) {
            return {
              ...it,
              _tmdb: null,
              _poster: it?.poster_url || '',
              _backdrop: it?.thumb_url || '',
            }
          }
        }))
        
        if (!cancelled) {
          setItems(enriched)
          setShowSuggestions(false)
          
          // Save to search history
          if (keyword.trim()) {
            const newHistory = [keyword.trim(), ...searchHistory.filter(h => h !== keyword.trim())].slice(0, 5)
            setSearchHistory(newHistory)
            localStorage.setItem('searchHistory', JSON.stringify(newHistory))
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Tìm kiếm thất bại')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    
    const timeoutId = setTimeout(run, 500) // Debounce search
    return () => { 
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [keyword, page, filters])

  // Handle movie card click
  const handleMovieClick = async (movie) => {
    setSelectedMovie(movie)
    setMovieDetail(null)
    setShowDetails(true)
    
    if (!movie?.slug) return
    
    try {
      setDetailLoading(true)
      const detail = await fetchMovieDetailBySlug(movie.slug)
      setMovieDetail(detail)
    } catch (e) {
      console.error('Error fetching movie details:', e)
    } finally {
      setDetailLoading(false)
    }
  }

  // Handle search input changes
  const handleSearchChange = (value) => {
    setKeyword(value)
    setPage(1)
    
    if (value.trim()) {
      // Generate suggestions from search history
      const filtered = searchHistory.filter(h => 
        h.toLowerCase().includes(value.toLowerCase())
      )
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setKeyword(suggestion)
    setShowSuggestions(false)
    searchInputRef.current?.focus()
  }

  // Clear search
  const clearSearch = () => {
    setKeyword('')
    setItems([])
    setPage(1)
    setShowSuggestions(false)
    searchInputRef.current?.focus()
  }

  // Handle filter change
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }))
    setPage(1)
  }

  return (
    <div className='search-page'>
      <Navbar />
      <div className='search-container'>
        <h2>{title}</h2>
        
        {/* Search Bar with Suggestions */}
        <div className='search-bar-container'>
          <div className='search-bar'>
            <input 
              ref={searchInputRef}
              placeholder='Tìm kiếm phim, diễn viên, đạo diễn...' 
              value={keyword} 
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setShowSuggestions(suggestions.length > 0)}
            />
            {keyword && (
              <button className='search-clear' onClick={clearSearch}>
                ✕
              </button>
            )}
          </div>
          
          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className='search-suggestions'>
              {suggestions.map((suggestion, idx) => (
                <div 
                  key={idx} 
                  className='suggestion-item'
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  🔍 {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className='search-filters'>
          <select 
            value={filters.category} 
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="">Tất cả thể loại</option>
            <option value="hanh-dong">Hành động</option>
            <option value="kinh-di">Kinh dị</option>
            <option value="tinh-cam">Tình cảm</option>
            <option value="hai-huoc">Hài hước</option>
            <option value="phieu-luu">Phiêu lưu</option>
          </select>
          
          <select 
            value={filters.country} 
            onChange={(e) => handleFilterChange('country', e.target.value)}
          >
            <option value="">Tất cả quốc gia</option>
            <option value="han-quoc">Hàn Quốc</option>
            <option value="nhat-ban">Nhật Bản</option>
            <option value="trung-quoc">Trung Quốc</option>
            <option value="my">Mỹ</option>
            <option value="viet-nam">Việt Nam</option>
          </select>
          
          <select 
            value={filters.sort_lang} 
            onChange={(e) => handleFilterChange('sort_lang', e.target.value)}
          >
            <option value="">Tất cả ngôn ngữ</option>
            <option value="vietsub">Vietsub</option>
            <option value="thuyet-minh">Thuyết minh</option>
            <option value="long-tieng">Lồng tiếng</option>
          </select>
          
          <select 
            value={filters.year} 
            onChange={(e) => handleFilterChange('year', e.target.value)}
          >
            <option value="">Tất cả năm</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <option value="2022">2022</option>
            <option value="2021">2021</option>
            <option value="2020">2020</option>
          </select>
        </div>

        {/* Search Results */}
        {error && <div className='search-error'>{error}</div>}
        
        {keyword && !loading && items.length === 0 && !error && (
          <div className='search-no-results'>
            Không tìm thấy kết quả cho "{keyword}"
          </div>
        )}
        
        {loading ? (
          <div className='search-loading'>
            <div className='loading-spinner'></div>
            <p>Đang tìm kiếm...</p>
          </div>
        ) : (
          <div className='search-grid'>
            {items.map((movie, idx) => (
              <div 
                className='search-card' 
                key={movie?.slug || idx}
                onClick={() => handleMovieClick(movie)}
              >
                <div className='search-thumb'>
                  <img 
                    src={movie?._poster || movie?._backdrop || ''} 
                    alt={movie?.name || movie?.origin_name || 'movie'} 
                    loading='lazy' 
                  />
                  <div className='search-overlay'>
                    <button className='search-play-btn'>▶</button>
                  </div>
                </div>
                <div className='search-meta'>
                  <p className='search-title'>{movie?.name || movie?.origin_name || movie?._tmdb?.title}</p>
                  <p className='search-year'>{movie?.year || movie?._tmdb?.release_date?.split('-')[0]}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {items.length > 0 && (
          <div className='search-pagination'>
            <button 
              disabled={page <= 1} 
              onClick={() => setPage(p => Math.max(1, p-1))}
              className='pagination-btn'
            >
              ← Trang trước
            </button>
            <span className='pagination-info'>Trang {page}</span>
            <button 
              onClick={() => setPage(p => p+1)}
              className='pagination-btn'
            >
              Trang sau →
            </button>
          </div>
        )}
      </div>
      
      {/* Movie Details Panel */}
      <MovieDetailsPanel 
        open={showDetails} 
        onClose={() => setShowDetails(false)} 
        movie={selectedMovie} 
        detail={movieDetail} 
      />
      
      <Footer />
    </div>
  )
}

export default Search


