import React, { useEffect, useMemo, useState, useRef } from 'react'
import './Search.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import MovieDetailsPanel from '../../components/MovieDetailsPanel/MovieDetailsPanel'
import { fetchMovieDetailBySlug } from '../../services/phimapi'
import { fetchTmdbById, buildTmdbImagePath } from '../../services/tmdb'
import { searchMovies as searchMoviesInDB, getMovies, clearMoviesCache } from '../../firebase'

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
  
  const searchInputRef = useRef(null)
  const title = useMemo(() => 'Tìm kiếm', [])

  // Function để clear cache và tìm kiếm lại
  const clearCacheAndSearch = async () => {
    clearMoviesCache();
    
    // Retry search
    if (keyword.trim()) {
      setLoading(true);
      setError('');
      
      try {
        const result = await searchMovies({ 
          keyword, 
          page, 
          limit: 30, 
          category: filters.category, 
          country: filters.country, 
          year: filters.year, 
          sort_lang: filters.sort_lang 
        });
        
        setItems(result.items);
        setPage(result.pagination.currentPage);
        
        if (result.items.length === 0) {
          setError(`Không tìm thấy phim nào với từ khóa "${keyword}"`);
        }
      } catch (error) {
        console.error('❌ Lỗi khi tìm kiếm:', error);
        setError('Có lỗi xảy ra khi tìm kiếm. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Hàm tìm kiếm từ Firebase database
  const searchMovies = async ({ keyword, page = 1, limit = 30, category = '', country = '', year = '', sort_lang = '' } = {}) => {
    try {
      
      if (!keyword || keyword.trim() === '') {
        // Nếu không có keyword, lấy phim mới nhất
        const movies = await getMovies(limit * page, 'modified', 'desc');
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedMovies = movies.slice(startIndex, endIndex);
        
        return {
          items: paginatedMovies,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(movies.length / limit),
            totalItems: movies.length
          }
        };
      }

      // Tìm kiếm trong database
      let movies = await searchMoviesInDB(keyword, limit * 3); // Lấy nhiều hơn để filter
      
      if (movies && movies.length > 0) {
        // Lọc theo các tiêu chí
        let filteredMovies = movies;
        
        // Lọc theo thể loại
        if (category) {
          filteredMovies = filteredMovies.filter(movie => 
            movie.category && Array.isArray(movie.category) && 
            movie.category.some(cat => cat.slug === category)
          );
        }
        
        // Lọc theo quốc gia
        if (country) {
          filteredMovies = filteredMovies.filter(movie => 
            movie.country && Array.isArray(movie.country) && 
            movie.country.some(c => c.slug === country)
          );
        }
        
        // Lọc theo năm
        if (year) {
          filteredMovies = filteredMovies.filter(movie => 
            movie.year === parseInt(year)
          );
        }
        
        // Lọc theo ngôn ngữ
        if (sort_lang) {
          filteredMovies = filteredMovies.filter(movie => 
            movie.lang && Array.isArray(movie.lang) && 
            movie.lang.some(l => l.slug === sort_lang)
          );
        }
        
        // Sắp xếp theo thời gian cập nhật
        filteredMovies.sort((a, b) => {
          const aTime = a.modified || a.updatedAt || 0;
          const bTime = b.modified || b.updatedAt || 0;
          return bTime - aTime;
        });
        
        // Phân trang
        const itemsPerPage = limit;
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedMovies = filteredMovies.slice(startIndex, endIndex);
        
        return {
          items: paginatedMovies,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(filteredMovies.length / itemsPerPage),
            totalItems: filteredMovies.length
          }
        };
      }
      
      // Nếu không tìm thấy, trả về kết quả rỗng
      return {
        items: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0
        }
      };
      
    } catch (error) {
      console.error('❌ Lỗi khi tìm kiếm:', error);
      return {
        items: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0
        }
      };
    }
  }

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
      
      // Tránh tìm kiếm với từ khóa quá ngắn
      if (keyword.trim().length < 2) {
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
        
        // Enrich movies with TMDB data if available, otherwise use original data
        const enriched = await Promise.all(list.map(async (it) => {
          const tmdbId = it?.tmdb?.id
          const mediaType = it?.type === 'series' ? 'tv' : 'movie'
          
          if (tmdbId) {
            try {
              const tmdb = await fetchTmdbById(tmdbId, mediaType)
              return {
                ...it,
                _tmdb: tmdb,
                _poster: buildTmdbImagePath(tmdb?.poster_path, 'w342') || it?.poster_url || '',
                _backdrop: buildTmdbImagePath(tmdb?.backdrop_path, 'w780') || it?.thumb_url || '',
              }
            } catch {
              return {
                ...it,
                _tmdb: null,
                _poster: it?.poster_url || '',
                _backdrop: it?.thumb_url || '',
              }
            }
          } else {
            // Use original data if no TMDB
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
            const currentHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]')
            const newHistory = [keyword.trim(), ...currentHistory.filter(h => h !== keyword.trim())].slice(0, 5)
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
    
    const timeoutId = setTimeout(run, 800) // Debounce search - tăng thời gian để tránh gọi quá nhiều
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
      const detail = await fetchMovieDetailBySlug(movie.slug)
      setMovieDetail(detail)
    } catch (e) {
      console.error('Error fetching movie details:', e)
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
            <div className='no-results-content'>
              <h3>Không tìm thấy kết quả cho "{keyword}"</h3>
              
                
            
              {/* <button 
                className='retry-search-btn'
                onClick={clearCacheAndSearch}
              >
                🔄 Thử lại với cache mới
              </button> */}
            </div>
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
                    <div className='search-meta'>
                      <h3 className='search-title'>{movie?.name || movie?.origin_name || movie?._tmdb?.title || movie?._tmdb?.name}</h3>
                      <p className='search-year'>{movie?.year || movie?._tmdb?.release_date?.split('-')[0]}</p>
                      {movie?.quality && <span className='search-quality'>{movie.quality}</span>}
                    </div>
                    <button className='search-play-btn'>▶</button>
                  </div>
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
            
            <div className='page-numbers'>
              {Array.from({length: Math.min(5, Math.ceil(items.length / 30))}, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={`page-${pageNum}`}
                    className={`page-btn ${pageNum === page ? 'active' : ''}`}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
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


